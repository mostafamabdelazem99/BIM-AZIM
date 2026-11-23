# BIM-AZIM Licensing / Roster

A lightweight "request a license" flow: anyone can submit a username + email from the website
or from inside the Revit/Navisworks ribbon. The admin (mostafa.m.abdelazem99@gmail.com) is
notified automatically and accepts or rejects each request by hand. Approved users appear in a
public roster (count + username list, never emails) on the website.

There is no key issuance or validation here — this does not gate or lock any tool. It's a
registration/roster system, not a DRM system.

## Why a Google Form

No custom backend to host, patch, or pay for. A Google Form:
- Accepts submissions from a plain HTTP POST — a website's `fetch()`/form submit, or a native
  .NET `HttpClient.PostAsync`, hit the same public `formResponse` endpoint a browser does. No API
  key required.
- Can email the owner automatically on every response (Settings → Responses → "Get email
  notifications for new responses") — this *is* the "send me an email for acceptance or reject"
  requirement, no extra code needed.
- Links to a Google Sheet, which can be published to the web as CSV and fetched client-side for
  the website's live roster.

## One-time setup (do this once, as mostafa.m.abdelazem99@gmail.com)

1. Go to [forms.google.com](https://forms.google.com) and create a new form titled
   **"BIM-AZIM License Request"**.
2. Add exactly two questions, in this order:
   - **Username** — Short answer, required.
   - **Email** — Short answer, required, with response validation set to "Email".
3. Settings (gear icon) → **Responses** tab → turn on **"Get email notification for new
   responses"**. This is the step that actually emails you on every submission.
4. Leave **"Collect email addresses"** and **"Limit to 1 response"** OFF — the form's own Email
   question covers that, and requests shouldn't require the submitter to sign into Google.
5. Responses tab (on the form itself) → click the green Sheets icon → **"Create a new
   spreadsheet"**. This creates a linked Sheet with columns `Timestamp`, `Username`, `Email`.
6. In that Sheet, add a 4th column header in **D1: `Status`**. After you review each request by
   email, type `Approved` or `Rejected` in that row's Status cell — this is what controls whether
   a user shows up in the public roster.
7. In the Sheet: **File → Share → Publish to web** → under "Link", choose the response sheet/tab
   (often named "Form responses 1") → format **CSV** → **Publish**. Copy the resulting URL.
8. From the Form editor: **Send** button → the link icon → copy the public form URL (a
   `forms.gle/...` short link or the full `docs.google.com/forms/d/e/.../viewform` link both
   work).

## Wiring it into BIM-AZIM

Give the two URLs from steps 7 and 8 to a BIM-AZIM Claude session, which can:
- Open the public form URL and extract the hidden `entry.NNNNNN` field IDs automatically (no
  manual dev-tools digging required).
- Fill in the placeholders in:
  - [`server`](../server) is not involved — this flow is website + native plugins only.
  - [`website/index.html`](../website/index.html) — the `#license` section's iframe `src`.
  - [`website/script.js`](../website/script.js) — `LICENSE_CSV_URL`.
  - [`plugins/Revit/BimAzimPlugin/Core/LicenseService.cs`](../plugins/Revit/BimAzimPlugin/Core/LicenseService.cs)
    — `GoogleFormResponseUrl`, `EntryUsername`, `EntryEmail`.
  - [`plugins/Navisworks/BimAzimNavisPlugin/Core/NavisLicenseService.cs`](../plugins/Navisworks/BimAzimNavisPlugin/Core/NavisLicenseService.cs)
    — same three constants (must match the Revit plugin's exactly, since both submit into the
    same sheet).
- Rebuild both plugins and redeploy the website.

Until those placeholders are replaced, the website's roster card and both plugins' "Request
License" buttons fail gracefully (a clear error message / empty-state UI) rather than crashing.

## Why Revit and Navisworks, not Tekla or Unreal

- **Revit** already had a ribbon button and dialog for this (ported from BIM-Bot, pointed at
  BIM-Bot's own Firebase project and never wired to a visible button) — repointed at the Google
  Form and simplified down to just the request step (the original also had an "enter an
  activation key" step with no real key-issuing backend behind it, which has been removed).
- **Navisworks** had no equivalent UI; a new ribbon button (`LicenseRequestPlugin`) and dialog
  (`LicenseRequestForm`) were added following the same one-button-per-feature pattern as
  `ClashSnapshotsPlugin`.
- **Tekla**'s bridge is a headless HTTP service with no ribbon/UI surface of its own (see
  [`ARCHITECTURE.md`](ARCHITECTURE.md)), so there's nowhere to put this button without first
  building a Tekla-side UI extension — out of scope here.
- **Unreal**'s C++ editor plugin is unverified on real hardware and a separate product line; not
  touched for this pass.
