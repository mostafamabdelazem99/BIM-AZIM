using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace BimAzimNavisPlugin.Core
{
    /// <summary>
    /// Sends a "Request a License" submission (username + email) straight to the public
    /// BIM-AZIM license-request Google Form's response endpoint — the same POST a browser makes
    /// when it submits the form, no API key or backend of our own needed. The form's own
    /// "email the owner on every response" setting notifies the admin; approval/rejection
    /// happens by hand (see docs/LICENSING.md). Must stay in sync with the Revit plugin's
    /// BimAzimPlugin.Core.LicenseService — both submit into the same Google Sheet.
    /// </summary>
    public static class NavisLicenseService
    {
        // TODO(BIM-AZIM setup): replace with the real Google Form response URL and entry IDs —
        // see docs/LICENSING.md. Must match plugins/Revit/BimAzimPlugin/Core/LicenseService.cs.
        private const string GoogleFormResponseUrl =
            "https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/formResponse";
        private const string EntryUsername = "entry.REPLACE_WITH_USERNAME_ENTRY_ID";
        private const string EntryEmail = "entry.REPLACE_WITH_EMAIL_ENTRY_ID";

        private static readonly HttpClient _httpClient = new HttpClient();

        static NavisLicenseService()
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BimAzim-LicenseRequest");
            _httpClient.Timeout = TimeSpan.FromSeconds(15);
        }

        public static string GetDeviceUsername() => Environment.UserName;

        /// <summary>Submits the request; returns true only on an HTTP success status. Never throws.</summary>
        public static async Task<bool> RequestLicenseAsync(string username, string email)
        {
            try
            {
                var fields = new Dictionary<string, string>
                {
                    [EntryUsername] = username,
                    [EntryEmail] = email,
                };

                using (var content = new FormUrlEncodedContent(fields))
                {
                    var response = await _httpClient.PostAsync(GoogleFormResponseUrl, content);
                    NavisLogger.Log($"License request submitted: status={(int)response.StatusCode}");
                    return response.IsSuccessStatusCode;
                }
            }
            catch (Exception ex)
            {
                NavisLogger.LogError("License request submission failed", ex);
                return false;
            }
        }
    }
}
