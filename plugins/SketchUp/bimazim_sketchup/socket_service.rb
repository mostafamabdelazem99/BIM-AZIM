require 'socket'
require 'json'

module BimAzim
  module SketchUp
    # TCP socket server for SketchUp, speaking the same length-prefixed JSON-RPC 2.0 wire
    # protocol as the Revit/Navisworks/AutoCAD plugins ("Content-Length: N\n{json}") so
    # server/src/bridge/tcp-engine-client.ts works against it unchanged.
    #
    # SketchUp's Ruby runs single-threaded with no real background threads (confirmed against
    # the SketchUp Ruby API docs and prior art: a public "sketchup-mcp" extension uses the same
    # shape) — so this never blocks. A repeating UI.start_timer tick does a non-blocking accept
    # plus a non-blocking read on every connected client, processing whatever bytes showed up
    # since the last tick. Because the tick runs on SketchUp's own main thread, dispatching
    # straight into CommandExecutor from here is already safe — no extra marshaling needed,
    # unlike the Revit/AutoCAD plugins which must hop onto their host's thread explicitly.
    class SocketService
      CONTENT_LENGTH_HEADER = 'Content-Length: '.freeze
      PORT_SCAN_RANGE = 10
      TICK_SECONDS = 0.05

      attr_reader :port

      def initialize(preferred_port)
        @preferred_port = preferred_port
        @port = preferred_port
        @server = nil
        @clients = {} # socket => read buffer (String)
        @timer_id = nil
      end

      def running?
        !@server.nil?
      end

      def start
        return if running?

        (@preferred_port..(@preferred_port + PORT_SCAN_RANGE)).each do |candidate|
          begin
            @server = TCPServer.new('127.0.0.1', candidate)
            @port = candidate
            break
          rescue Errno::EADDRINUSE
            next
          end
        end

        unless @server
          warn "BIM-AZIM: could not bind any port in #{@preferred_port}-#{@preferred_port + PORT_SCAN_RANGE}"
          return
        end

        ServiceEndpoint.publish(@port, '0.1.0')
        @timer_id = UI.start_timer(TICK_SECONDS, true) { tick }
      end

      def stop
        return unless running?

        UI.stop_timer(@timer_id) if @timer_id
        @timer_id = nil
        @clients.each_key { |socket| socket.close rescue nil }
        @clients.clear
        @server.close rescue nil
        @server = nil
        ServiceEndpoint.clear
      end

      private

      def tick
        accept_new_clients
        @clients.each_key { |socket| pump_client(socket) }
      rescue StandardError => e
        warn "BIM-AZIM: socket tick error (non-fatal): #{e.message}"
      end

      def accept_new_clients
        loop do
          socket = @server.accept_nonblock
          @clients[socket] = +''
        rescue IO::WaitReadable, Errno::EAGAIN
          break
        rescue StandardError
          break
        end
      end

      def pump_client(socket)
        loop do
          chunk = socket.read_nonblock(65_536)
          @clients[socket] << chunk
          process_buffer(socket)
        rescue IO::WaitReadable, Errno::EAGAIN
          break
        rescue EOFError, Errno::ECONNRESET, IOError
          disconnect(socket)
          break
        end
      end

      def disconnect(socket)
        @clients.delete(socket)
        socket.close
      rescue StandardError
        nil
      end

      def process_buffer(socket)
        buffer = @clients[socket]
        loop do
          data = buffer.lstrip
          break if data.empty?

          json_str = nil

          if data.start_with?(CONTENT_LENGTH_HEADER)
            newline_idx = data.index("\n")
            break unless newline_idx

            length_str = data[CONTENT_LENGTH_HEADER.length...newline_idx].strip
            content_length = length_str.to_i
            if content_length <= 0
              warn "BIM-AZIM: invalid Content-Length: '#{length_str}'"
              buffer.replace('')
              break
            end

            payload_start = newline_idx + 1
            total_needed = payload_start + content_length
            break if data.bytesize < total_needed

            json_str = data.byteslice(payload_start, content_length)
            buffer.replace(data.byteslice(total_needed, data.bytesize - total_needed) || '')
          elsif data[0] == '{'
            end_idx = find_json_object_end(data)
            break unless end_idx

            json_str = data[0...end_idx]
            buffer.replace(data[end_idx..-1] || '')
          else
            next_brace = data.index('{')
            buffer.replace(next_brace ? data[next_brace..-1] : '')
            next
          end

          handle_message(socket, json_str) if json_str
        end
      end

      def find_json_object_end(data)
        depth = 0
        in_string = false
        escaped = false
        data.each_char.with_index do |c, i|
          if escaped
            escaped = false
            next
          end
          if c == '\\' && in_string
            escaped = true
            next
          end
          if c == '"'
            in_string = !in_string
            next
          end
          next if in_string

          if c == '{'
            depth += 1
          elsif c == '}'
            depth -= 1
            return i + 1 if depth.zero?
          end
        end
        nil
      end

      def handle_message(socket, json_str)
        request = JSON.parse(json_str)
        response = ServiceAuth.authorized?(request) ? process_request(request) : ServiceAuth.unauthorized_response(request)
        send_response(socket, response)
      rescue JSON::ParserError
        warn "BIM-AZIM: malformed JSON message skipped: #{json_str[0, 100]}"
      rescue StandardError => e
        warn "BIM-AZIM: error processing message: #{e.message}"
      end

      def process_request(request)
        id = (request['id'] || '0').to_s
        method = request['method'].to_s
        params = request['params'] || {}
        begin
          result = CommandExecutor.execute(method, params)
          { 'jsonrpc' => '2.0', 'id' => id, 'result' => result }
        rescue StandardError => e
          { 'jsonrpc' => '2.0', 'id' => id, 'error' => { 'code' => -32_000, 'message' => e.message } }
        end
      end

      def send_response(socket, response)
        body = JSON.generate(response)
        header = "Content-Length: #{body.bytesize}\n"
        socket.write(header)
        socket.write(body)
      rescue StandardError
        disconnect(socket)
      end
    end
  end
end
