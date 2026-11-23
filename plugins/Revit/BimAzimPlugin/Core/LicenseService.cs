using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace BimAzimPlugin.Core
{
    /// <summary>
    /// Sends a "Request a License" submission (username + email) straight to the public
    /// BIM-AZIM license-request Google Form's response endpoint — the same mechanism a
    /// browser uses when it submits the form, no API key needed. The Form auto-emails the
    /// admin on every submission; approval/rejection happens by hand (see docs/LICENSING.md).
    /// This does not gate or validate anything locally — there is no license key to check.
    /// </summary>
    public static class LicenseService
    {
        // ── Configuration ────────────────────────────────────
        // TODO(BIM-AZIM setup): these three placeholders must be replaced with the real
        // Google Form's response URL and field entry IDs once the form exists — see
        // docs/LICENSING.md for exactly how to find them (or ask BIM-AZIM's own Claude
        // session, which can extract them from the live form automatically).
        private const string GoogleFormResponseUrl =
            "https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/formResponse";
        private const string EntryUsername = "entry.REPLACE_WITH_USERNAME_ENTRY_ID";
        private const string EntryEmail = "entry.REPLACE_WITH_EMAIL_ENTRY_ID";

        // ── HTTP client (shared, long-lived) ─────────────────

        private static readonly HttpClient _httpClient = new HttpClient();

        static LicenseService()
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BimAzim-LicenseRequest");
            _httpClient.Timeout = TimeSpan.FromSeconds(15);
        }

        // ════════════════════════════════════════════════════
        // Machine Identification
        // ════════════════════════════════════════════════════

        /// <summary>
        /// Returns a stable, unique machine identifier derived from the
        /// Windows MachineGuid registry key, formatted as BIM-XXXX-XXXX-XXXX.
        /// </summary>
        public static string GetMachineId()
        {
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Cryptography"))
                {
                    var guid = key?.GetValue("MachineGuid")?.ToString() ?? "";

                    using (var sha = SHA256.Create())
                    {
                        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(guid));
                        var hex = BitConverter.ToString(hash).Replace("-", "").ToUpperInvariant();
                        return $"BIM-{hex.Substring(0, 4)}-{hex.Substring(4, 4)}-{hex.Substring(8, 4)}";
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to read MachineGuid from registry", ex);
                // Fallback: derive from machine name
                var fallback = Math.Abs(Environment.MachineName.GetHashCode());
                return $"BIM-{fallback:X4}-0000-0000".Substring(0, 17);
            }
        }

        /// <summary>Returns the current Windows user account name.</summary>
        public static string GetDeviceUsername() => Environment.UserName;

        /// <summary>Returns the Windows machine (computer) name.</summary>
        public static string GetMachineName() => Environment.MachineName;

        // ════════════════════════════════════════════════════
        // License Request
        // ════════════════════════════════════════════════════

        /// <summary>
        /// Submits a license request directly to the Google Form's public response endpoint —
        /// the same POST a browser makes when it submits the form, so no API key or backend of
        /// our own is needed. The form's own "email the owner on every response" setting is
        /// what actually notifies the admin; this call just gets the data there.
        /// </summary>
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
                    Logger.Log($"License request submitted: status={(int)response.StatusCode}");
                    return response.IsSuccessStatusCode;
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("License request submission failed", ex);
                return false;
            }
        }
    }
}
