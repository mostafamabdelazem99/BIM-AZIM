using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using BimAzimPlugin.Core;
using BimAzimPlugin.UI.Themes;

namespace BimAzimPlugin.UI
{
    /// <summary>
    /// "Request a License" dialog. Collects a username + email and submits them to the
    /// BIM-AZIM license-request Google Form (see LicenseService.RequestLicenseAsync) — the
    /// admin is notified automatically by the form and reviews requests by hand.
    /// Styled with DarkTheme for consistency with the rest of the plugin.
    /// </summary>
    public class ActivationWindow : Window
    {
        private readonly TextBox _usernameBox;
        private readonly TextBox _emailBox;
        private readonly TextBlock _statusLabel;
        private readonly Button _sendRequestBtn;

        public ActivationWindow()
        {
            Title = "Request a BIM-AZIM License";
            Width = 460;
            Height = 400;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            ResizeMode = ResizeMode.NoResize;
            DarkTheme.Apply(this);

            var stack = new StackPanel { Margin = new Thickness(28) };

            stack.Children.Add(new TextBlock
            {
                Text = "🔑 Request a License",
                FontSize = 22,
                FontWeight = FontWeights.Bold,
                Foreground = DarkTheme.FgLight,
                Margin = new Thickness(0, 0, 0, 4)
            });

            stack.Children.Add(new TextBlock
            {
                Text = $"BIM-AZIM v{BimAzimPlugin.Core.Application.Version}",
                FontSize = 12,
                Foreground = DarkTheme.FgDim,
                Margin = new Thickness(0, 0, 0, 16)
            });

            stack.Children.Add(new TextBlock
            {
                Text = "Submit your username and email to request a license. The admin is " +
                       "notified automatically and will accept or reject your request by email.",
                FontSize = 12,
                Foreground = DarkTheme.FgDim,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 20)
            });

            stack.Children.Add(DarkTheme.MakeLabel("Username", required: true));
            _usernameBox = DarkTheme.MakeTextBox(LicenseService.GetDeviceUsername(), "Your name or handle");
            _usernameBox.FontSize = 13;
            _usernameBox.Margin = new Thickness(0, 0, 0, 12);
            stack.Children.Add(_usernameBox);

            stack.Children.Add(DarkTheme.MakeLabel("Email", required: true));
            _emailBox = DarkTheme.MakeTextBox("", "you@company.com");
            _emailBox.FontSize = 13;
            _emailBox.Margin = new Thickness(0, 0, 0, 8);
            _emailBox.KeyDown += (s, e) => { if (e.Key == Key.Enter) OnSendRequest(s, e); };
            stack.Children.Add(_emailBox);

            _statusLabel = new TextBlock
            {
                Text = "",
                FontSize = 11,
                Foreground = DarkTheme.FgDim,
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 8, 0, 16)
            };
            stack.Children.Add(_statusLabel);

            var btnPanel = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };

            var closeBtn = DarkTheme.MakeCancelButton();
            closeBtn.Content = "Close";
            closeBtn.Click += (s, e) => Close();
            btnPanel.Children.Add(closeBtn);

            _sendRequestBtn = DarkTheme.MakePrimaryButton("📧 Send Request");
            _sendRequestBtn.Margin = new Thickness(10, 0, 0, 0);
            _sendRequestBtn.Click += OnSendRequest;
            btnPanel.Children.Add(_sendRequestBtn);

            stack.Children.Add(btnPanel);
            Content = stack;
        }

        /// <summary>
        /// Cheap sanity check only — the Google Form does its own validation. This just
        /// stops obviously empty or malformed input from being submitted.
        /// </summary>
        private static bool IsPlausibleEmail(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            if (value.IndexOf(' ') >= 0) return false;
            var at = value.IndexOf('@');
            if (at <= 0 || at != value.LastIndexOf('@') || at == value.Length - 1) return false;
            var domain = value.Substring(at + 1);
            return domain.Contains(".") && !domain.StartsWith(".") && !domain.EndsWith(".");
        }

        private async void OnSendRequest(object sender, RoutedEventArgs e)
        {
            var username = _usernameBox.Text?.Trim() ?? "";
            var email = _emailBox.Text?.Trim() ?? "";

            if (string.IsNullOrEmpty(username))
            {
                SetStatus("⚠️ Enter a username.", new SolidColorBrush(Color.FromRgb(0xF5, 0x9E, 0x0B)));
                _usernameBox.Focus();
                return;
            }
            if (!IsPlausibleEmail(email))
            {
                SetStatus("⚠️ Enter a valid email address.", new SolidColorBrush(Color.FromRgb(0xF5, 0x9E, 0x0B)));
                _emailBox.Focus();
                return;
            }

            SetStatus("Sending request...", DarkTheme.FgDim);
            _sendRequestBtn.IsEnabled = false;

            try
            {
                var ok = await LicenseService.RequestLicenseAsync(username, email);
                SetStatus(
                    ok
                        ? "✅ Request sent! The admin will review it and reply by email."
                        : "❌ Couldn't reach the license request form — check your internet connection and try again.",
                    new SolidColorBrush(ok ? Color.FromRgb(0x10, 0xB9, 0x81) : Color.FromRgb(0xEF, 0x44, 0x44)));
            }
            catch (Exception ex)
            {
                SetStatus($"❌ Failed to send request: {ex.Message}",
                    new SolidColorBrush(Color.FromRgb(0xEF, 0x44, 0x44)));
            }
            finally
            {
                _sendRequestBtn.IsEnabled = true;
            }
        }

        private void SetStatus(string text, Brush foreground)
        {
            _statusLabel.Text = text;
            _statusLabel.Foreground = foreground;
        }
    }
}
