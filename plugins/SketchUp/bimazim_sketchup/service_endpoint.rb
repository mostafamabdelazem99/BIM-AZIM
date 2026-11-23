require 'json'
require 'fileutils'
require 'time'

module BimAzim
  module SketchUp
    # Handshake file telling the MCP server which port this SketchUp session's socket service
    # bound to: %LOCALAPPDATA%\BimAzim\service-sketchup.json — same contract as the Revit/
    # Navisworks/AutoCAD plugins' ServiceEndpoint, read by server/src/bridge/handshake.ts.
    module ServiceEndpoint
      def self.root_directory
        base = ENV['LOCALAPPDATA'] || File.join(Dir.home, 'AppData', 'Local')
        File.join(base, 'BimAzim')
      end

      def self.file_path
        File.join(root_directory, 'service-sketchup.json')
      end

      def self.publish(port, plugin_version)
        FileUtils.mkdir_p(root_directory)
        payload = {
          'port' => port,
          'pid' => Process.pid,
          'host' => '127.0.0.1',
          'token' => ServiceAuth.token,
          'pluginVersion' => plugin_version,
          'startedAt' => Time.now.utc.iso8601
        }
        File.write(file_path, JSON.pretty_generate(payload))
      rescue StandardError => e
        warn "BIM-AZIM: failed to publish service endpoint (non-critical): #{e.message}"
      end

      def self.clear
        File.delete(file_path) if File.exist?(file_path)
      rescue StandardError
        nil
      end
    end
  end
end
