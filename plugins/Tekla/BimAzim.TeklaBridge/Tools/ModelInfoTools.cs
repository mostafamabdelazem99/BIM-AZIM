using Newtonsoft.Json.Linq;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge.Tools
{
    public sealed class ModelInfoTools
    {
        private readonly TeklaConnection _connection;

        public ModelInfoTools(TeklaConnection connection) => _connection = connection;

        public object GetModelInfo(JObject args)
        {
            _connection.RequireConnected();

            // VERIFY: Model.GetInfo(out ModelInfo) is the standard Open API call for model name/path;
            // field names on ModelInfo can differ slightly by Tekla version (ModelName vs Name).
            ModelInfo info;
            var model = _connection.Model;
            model.GetInfo(out info);

            return new
            {
                connected = true,
                modelName = info?.ModelName,
                modelPath = info?.ModelPath,
            };
        }
    }
}
