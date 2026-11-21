using System;
using System.Collections;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge
{
    /// <summary>
    /// Thin wrapper around Tekla.Structures.Model.Model — the Open API's remote connection to
    /// whichever Tekla Structures session is currently running on this machine. No in-process
    /// add-in is required for this to work (see plugins/Tekla/README.md).
    /// </summary>
    public sealed class TeklaConnection
    {
        private readonly Model _model = new Model();

        public bool IsConnected
        {
            get
            {
                try { return _model.GetConnectionStatus(); }
                catch { return false; }
            }
        }

        public Model Model => _model;

        public void RequireConnected()
        {
            if (!IsConnected)
                throw new ToolException("Not connected to Tekla Structures. Is Tekla Structures running with a model open?");
        }

        /// <summary>Look up a ModelObject by its GUID string (as returned to the AI client by other tools).</summary>
        public ModelObject GetByGuid(string guid)
        {
            RequireConnected();
            // VERIFY: Identifier(string) constructor from a GUID string, and Model.SelectModelObject(Identifier)
            // are the standard Tekla Open API pattern for GUID round-tripping — confirm against your version's
            // Tekla.Structures.Model.Identifier / Model API reference.
            var identifier = new Identifier(new Guid(guid));
            var obj = _model.SelectModelObject(identifier);
            if (obj == null)
                throw new ToolException($"No object found for GUID '{guid}'. It may have been deleted, or belong to a different model.");
            return obj;
        }

        public static string GuidOf(ModelObject obj) => obj.Identifier.GUID.ToString();

        public ArrayList GetSelectedRaw()
        {
            RequireConnected();
            var selector = new Tekla.Structures.Model.UI.ModelObjectSelector();
            var enumerator = selector.GetSelectedObjects();
            var list = new ArrayList();
            while (enumerator.MoveNext())
            {
                list.Add(enumerator.Current);
            }
            return list;
        }

        public bool Commit()
        {
            RequireConnected();
            return _model.CommitChanges();
        }
    }
}
