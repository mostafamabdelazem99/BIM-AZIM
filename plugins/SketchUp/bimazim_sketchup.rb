# BIM-AZIM for SketchUp — loader.
#
# SketchUp's extension convention: a single top-level .rb file (this one) registers an
# SketchupExtension pointing at a same-named support folder (bimazim_sketchup/) that holds the
# actual implementation. Install by copying both this file and the bimazim_sketchup/ folder into
# SketchUp's Plugins directory (Window > Extension Manager shows the path; install.ps1 copies
# both for you).

require 'sketchup.rb'
require 'extensions.rb'

module BimAzim
  module SketchUp
    unless file_loaded?(__FILE__)
      extension = ::SketchupExtension.new(
        'BIM-AZIM',
        File.join(File.dirname(__FILE__), 'bimazim_sketchup', 'main')
      )
      extension.description =
        'AI automation bridge for SketchUp — lets Claude, ChatGPT, and other MCP clients read ' \
        'and edit the active model over a local socket, the same protocol BIM-AZIM uses for ' \
        'Revit, Navisworks, and AutoCAD.'
      extension.version = '0.1.0'
      extension.creator = 'BIM-AZIM'
      extension.copyright = '2026'
      ::Sketchup.register_extension(extension, true)
      file_loaded(__FILE__)
    end
  end
end
