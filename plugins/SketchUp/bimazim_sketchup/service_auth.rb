require 'securerandom'
require 'fileutils'

module BimAzim
  module SketchUp
    # Shared secret every request must carry — reads/writes the SAME file as the Revit/
    # Navisworks/AutoCAD plugins' ServiceAuth classes, so one token covers every engine for this
    # Windows user. Whichever bridge starts first creates it.
    module ServiceAuth
      FIELD_NAME = 'auth'.freeze
      UNAUTHORIZED_CODE = -32001

      def self.file_path
        File.join(ServiceEndpoint.root_directory, 'auth.token')
      end

      def self.token
        @token ||= load_or_create
      end

      def self.authorized?(request)
        presented = request[FIELD_NAME]
        return false if presented.nil? || presented.empty?
        return true if fixed_time_equals(presented, token)

        @token = load_or_create
        fixed_time_equals(presented, @token)
      end

      def self.unauthorized_response(request)
        {
          'jsonrpc' => '2.0',
          'id' => (request['id'] || '0').to_s,
          'error' => {
            'code' => UNAUTHORIZED_CODE,
            'message' => 'Unauthorized: missing or invalid BIM-AZIM auth token. Reinstall BIM-AZIM and restart SketchUp.'
          }
        }
      end

      def self.load_or_create
        existing = try_read
        return existing if existing

        FileUtils.mkdir_p(ServiceEndpoint.root_directory)
        fresh = SecureRandom.hex(32)
        temp = "#{file_path}.#{SecureRandom.hex(8)}.tmp"
        File.write(temp, fresh)
        begin
          File.rename(temp, file_path) unless File.exist?(file_path)
          try_read || fresh
        rescue StandardError
          File.delete(temp) if File.exist?(temp)
          try_read || fresh
        end
      end

      def self.try_read
        return nil unless File.exist?(file_path)

        text = File.read(file_path).strip
        text.length >= 32 ? text : nil
      rescue StandardError
        nil
      end

      def self.fixed_time_equals(a, b)
        return false unless a.length == b.length

        diff = 0
        a.bytes.zip(b.bytes) { |x, y| diff |= (x ^ y) }
        diff.zero?
      end
    end
  end
end
