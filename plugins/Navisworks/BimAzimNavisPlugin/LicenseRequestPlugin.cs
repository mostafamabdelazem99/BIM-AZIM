using System;
using System.Windows.Forms;
using Autodesk.Navisworks.Api.Plugins;
using BimAzimNavisPlugin.Core;
using BimAzimNavisPlugin.UI;

namespace BimAzimNavisPlugin
{
    /// <summary>
    /// "Request License" ribbon button (Add-ins tab). Opens a small dialog collecting a
    /// username + email and submits them to the BIM-AZIM license-request Google Form — the
    /// admin is notified automatically and reviews requests by hand.
    /// </summary>
    [Plugin("BimAzimLicenseRequest", "BAZM",
        DisplayName = "Request License",
        ToolTip = "Submit your username and email to request a BIM-AZIM license — the admin is notified automatically and replies by email.")]
    [AddInPlugin(AddInLocation.AddIn, Icon = "icon16.ico", LargeIcon = "icon32.ico")]
    public class LicenseRequestPlugin : AddInPlugin
    {
        public override int Execute(string[] parameters)
        {
            try
            {
                using (var form = new LicenseRequestForm()) form.ShowDialog();
                return 0;
            }
            catch (Exception ex)
            {
                NavisLogger.LogError("Request License button failed", ex);
                MessageBox.Show(ex.Message, "BIM-AZIM — Request License", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
    }
}
