using System;
using System.Drawing;
using System.Windows.Forms;
using BimAzimNavisPlugin.Core;

namespace BimAzimNavisPlugin.UI
{
    /// <summary>
    /// "Request a License" dialog for the Navisworks ribbon button. Collects a username + email
    /// and submits them via NavisLicenseService — the admin is notified automatically by the
    /// Google Form and reviews requests by hand.
    /// </summary>
    public class LicenseRequestForm : Form
    {
        private readonly TextBox _username = new TextBox { Width = 260 };
        private readonly TextBox _email = new TextBox { Width = 260 };
        private readonly Label _status = new Label { AutoSize = true, Text = "" };
        private readonly Button _send = new Button { Text = "Send Request", Width = 110 };
        private readonly Button _close = new Button { Text = "Close", Width = 90 };

        public LicenseRequestForm()
        {
            Text = "BIM-AZIM — Request a License";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            AutoSize = true;
            AutoSizeMode = AutoSizeMode.GrowAndShrink;
            Padding = new Padding(14);

            _username.Text = NavisLicenseService.GetDeviceUsername();

            var intro = new Label
            {
                AutoSize = false,
                Width = 380,
                Height = 48,
                Text = "Submit your username and email to request a license. The admin is " +
                       "notified automatically and will accept or reject your request by email.",
            };

            var grid = new TableLayoutPanel { ColumnCount = 2, AutoSize = true, Dock = DockStyle.Fill };
            AddRow(grid, "", intro);
            AddRow(grid, "Username:", _username);
            AddRow(grid, "Email:", _email);
            AddRow(grid, "", _status);

            var buttons = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Dock = DockStyle.Fill };
            buttons.Controls.Add(_close);
            buttons.Controls.Add(_send);
            AddRow(grid, "", buttons);

            Controls.Add(grid);
            AcceptButton = _send;
            CancelButton = _close;

            _send.Click += OnSend;
            _close.Click += (s, e) => Close();
        }

        private static void AddRow(TableLayoutPanel grid, string label, Control control)
        {
            grid.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 6, 8, 0) });
            grid.Controls.Add(control);
        }

        private static bool IsPlausibleEmail(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            if (value.IndexOf(' ') >= 0) return false;
            var at = value.IndexOf('@');
            if (at <= 0 || at != value.LastIndexOf('@') || at == value.Length - 1) return false;
            var domain = value.Substring(at + 1);
            return domain.Contains(".") && !domain.StartsWith(".") && !domain.EndsWith(".");
        }

        private async void OnSend(object sender, EventArgs e)
        {
            var username = _username.Text?.Trim() ?? "";
            var email = _email.Text?.Trim() ?? "";

            if (string.IsNullOrEmpty(username))
            {
                _status.ForeColor = Color.DarkOrange;
                _status.Text = "Enter a username.";
                _username.Focus();
                return;
            }
            if (!IsPlausibleEmail(email))
            {
                _status.ForeColor = Color.DarkOrange;
                _status.Text = "Enter a valid email address.";
                _email.Focus();
                return;
            }

            _status.ForeColor = SystemColors.GrayText;
            _status.Text = "Sending request...";
            _send.Enabled = false;

            try
            {
                var ok = await NavisLicenseService.RequestLicenseAsync(username, email);
                _status.ForeColor = ok ? Color.SeaGreen : Color.Firebrick;
                _status.Text = ok
                    ? "Request sent! The admin will review it and reply by email."
                    : "Couldn't reach the license request form — check your internet connection and try again.";
            }
            catch (Exception ex)
            {
                _status.ForeColor = Color.Firebrick;
                _status.Text = $"Failed to send request: {ex.Message}";
            }
            finally
            {
                _send.Enabled = true;
            }
        }
    }
}
