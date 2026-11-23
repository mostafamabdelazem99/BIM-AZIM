# BIM-AZIM for SketchUp — entry point, loaded by the SketchupExtension in ../bimazim_sketchup.rb.

require 'sketchup.rb'
require_relative 'service_auth'
require_relative 'service_endpoint'
require_relative 'command_executor'
require_relative 'socket_service'

module BimAzim
  module SketchUp
    DEFAULT_PORT = 8095

    @service = nil

    def self.start_service
      @service ||= SocketService.new(DEFAULT_PORT)
      @service.start unless @service.running?
    end

    def self.stop_service
      @service&.stop
    end

    def self.service_running?
      @service&.running? || false
    end

    # Auto-start once SketchUp has finished loading, same auto-start behavior as the
    # Revit/Navisworks plugins. Wrapped in a timer so a slow-starting SketchUp session doesn't
    # race extension load.
    UI.start_timer(0.1, false) { start_service }

    unless file_loaded?(__FILE__)
      menu = UI.menu('Plugins').add_submenu('BIM-AZIM')
      menu.add_item('Start / Stop BIM-AZIM Service') do
        if service_running?
          stop_service
          UI.messagebox('BIM-AZIM service stopped. AI clients can no longer reach SketchUp.')
        else
          start_service
          UI.messagebox("BIM-AZIM service running on port #{@service.port}.")
        end
      end
      menu.add_item('BIM-AZIM Status') do
        status = service_running? ? "running on port #{@service.port}" : 'stopped'
        UI.messagebox("BIM-AZIM service is #{status}.")
      end
      file_loaded(__FILE__)
    end
  end
end
