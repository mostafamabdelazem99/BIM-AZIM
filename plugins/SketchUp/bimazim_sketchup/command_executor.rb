require 'sketchup.rb'

module BimAzim
  module SketchUp
    # Dispatches BIM-AZIM commands against Sketchup.active_model. Runs on SketchUp's own main
    # thread already (called from SocketService's UI.start_timer tick), so no extra thread
    # marshaling is needed here — unlike the Revit/AutoCAD plugins.
    module CommandExecutor
      def self.execute(method, params)
        return ping if method == 'ping'

        model = ::Sketchup.active_model
        raise "No active SketchUp model." unless model

        case method
        when 'sketchup_get_model_info' then get_model_info(model)
        when 'sketchup_get_entities' then get_entities(model, params)
        when 'sketchup_get_selection' then get_selection(model)
        when 'sketchup_create_edges' then create_edges(model, params)
        when 'sketchup_create_face' then create_face(model, params)
        when 'sketchup_create_group' then create_group(model, params)
        when 'sketchup_create_component_instance' then create_component_instance(model, params)
        when 'sketchup_get_components' then get_components(model)
        when 'sketchup_get_layers' then get_layers(model)
        when 'sketchup_create_layer' then create_layer(model, params)
        when 'sketchup_get_materials' then get_materials(model)
        when 'sketchup_move_entity' then move_entity(model, params)
        when 'sketchup_delete_entities' then delete_entities(model, params)
        when 'sketchup_get_scenes' then get_scenes(model)
        when 'sketchup_zoom_extents' then zoom_extents(model)
        when 'sketchup_export' then export_model(model, params)
        else
          raise "Unknown command: #{method}"
        end
      end

      def self.ping
        { 'version' => ::Sketchup.version, 'modelOpen' => !::Sketchup.active_model.nil? }
      end

      def self.get_model_info(model)
        {
          'title' => model.title,
          'path' => model.path,
          'units' => model.options['UnitsOptions'] && model.options['UnitsOptions']['LengthUnit'],
          'entityCount' => model.entities.length,
          'activeLayer' => model.active_layer&.name
        }
      end

      def self.get_entities(model, params)
        limit = (params['limit'] || 200).to_i
        type_filter = params['type']
        result = []
        model.entities.each do |e|
          break if result.length >= limit
          next if type_filter && e.class.name.split('::').last != type_filter

          result << entity_summary(e)
        end
        { 'entities' => result, 'count' => result.length }
      end

      def self.get_selection(model)
        { 'entities' => model.selection.map { |e| entity_summary(e) }, 'count' => model.selection.length }
      end

      def self.entity_summary(entity)
        summary = {
          'entityId' => entity.entityID,
          'type' => entity.class.name.split('::').last,
          'layer' => entity.layer&.name
        }
        begin
          bounds = entity.bounds
          summary['boundsMin'] = point_to_h(bounds.min)
          summary['boundsMax'] = point_to_h(bounds.max)
        rescue StandardError
          # Not every entity type (e.g. some construction helpers) has meaningful bounds.
        end
        summary
      end

      def self.create_edges(model, params)
        points = points_from_json(params['points'])
        raise 'points (>= 2) is required' if points.length < 2

        edges = model.entities.add_edges(points)
        { 'ok' => true, 'entityIds' => edges.map(&:entityID) }
      end

      def self.create_face(model, params)
        points = points_from_json(params['points'])
        raise 'points (>= 3) is required' if points.length < 3

        face = model.entities.add_face(points)
        { 'ok' => true, 'entityId' => face.entityID }
      end

      def self.create_group(model, params)
        entity_ids = params['entityIds']
        group =
          if entity_ids
            entities = entity_ids.map { |id| find_entity(model, id) }.compact
            model.entities.add_group(entities)
          else
            model.entities.add_group
          end
        { 'ok' => true, 'entityId' => group.entityID }
      end

      def self.create_component_instance(model, params)
        name = params['definitionName'] || raise('definitionName is required')
        definition = model.definitions[name]
        raise "No component definition named '#{name}' in this model." unless definition

        position = point_from_json(params['position'] || {})
        transform = Geom::Transformation.new(position)
        instance = model.entities.add_instance(definition, transform)
        { 'ok' => true, 'entityId' => instance.entityID }
      end

      def self.get_components(model)
        { 'components' => model.definitions.reject(&:group?).map { |d| { 'name' => d.name, 'instanceCount' => d.count_instances } } }
      end

      def self.get_layers(model)
        # SketchUp's UI has called these "Tags" since 2020; the Ruby API still exposes them via
        # Model#layers for backward compatibility, so this works across all supported versions.
        { 'layers' => model.layers.map { |l| { 'name' => l.name, 'visible' => l.visible? } } }
      end

      def self.create_layer(model, params)
        name = params['name'] || raise('name is required')
        layer = model.layers.add(name)
        { 'ok' => true, 'name' => layer.name }
      end

      def self.get_materials(model)
        { 'materials' => model.materials.map { |m| { 'name' => m.name, 'colorized' => !m.color.nil? } } }
      end

      def self.move_entity(model, params)
        entity = find_entity(model, params['entityId'])
        raise "No entity with id #{params['entityId']}" unless entity

        displacement = point_from_json(params['displacement'] || {})
        entity.transform!(Geom::Transformation.translation(displacement))
        { 'ok' => true, 'entityId' => entity.entityID }
      end

      def self.delete_entities(model, params)
        ids = params['entityIds'] || raise('entityIds is required')
        entities = ids.map { |id| find_entity(model, id) }.compact
        model.entities.erase_entities(entities) unless entities.empty?
        { 'ok' => true, 'deletedCount' => entities.length }
      end

      def self.get_scenes(model)
        { 'scenes' => model.pages.map(&:name) }
      end

      def self.zoom_extents(model)
        model.active_view.zoom_extents
        { 'ok' => true }
      end

      def self.export_model(model, params)
        path = params['path'] || raise('path is required')
        options = params['options'] || {}
        ok = model.export(path, options)
        { 'ok' => ok, 'path' => path }
      end

      # ── Helpers ──────────────────────────────────────────────────────────

      def self.find_entity(model, entity_id)
        return nil unless entity_id

        target = entity_id.to_i
        model.entities.find { |e| e.entityID == target }
      end

      def self.point_from_json(h)
        Geom::Point3d.new((h['x'] || 0).to_f, (h['y'] || 0).to_f, (h['z'] || 0).to_f)
      end

      def self.points_from_json(arr)
        raise 'points is required' unless arr

        arr.map { |h| point_from_json(h) }
      end

      def self.point_to_h(point)
        { 'x' => point.x.to_f, 'y' => point.y.to_f, 'z' => point.z.to_f }
      end
    end
  end
end
