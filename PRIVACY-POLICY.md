https://aliasbridge-privacy.crd.co

Last updated: `2025-11-30`

This Privacy Policy explains how Inspirex (“we”, “us”, or “our”) handles information when you use the Alias Bridge browser extension (the “Service”).

By installing or using Alias Bridge, you agree to this Privacy Policy.

## 1. Information We Process

We designed Alias Bridge to be privacy‑focused. We do not build profiles of your browsing behavior, and we do not sell your data.

Depending on how you use the Service, we process the following categories of information:

### Browser extension data (stored locally on your device)

- Your Addy.io API token.
- Your Alias Bridge settings, such as:
- Default alias domain and format.
- Custom alias rules (prefix/suffix patterns, separators, etc.).
- License information:
- Your license key for Pro features.
- A locally-generated instance identifier (used to label your license activation).
- Cached Addy.io account data needed for alias generation (e.g., username, available domains).

### In‑page data (processed in your browser, not sent to us)

- The URL/domain of the website you are visiting (used to generate domain‑based aliases).
- Email input fields where the extension injects the alias‑generation icon and fills aliases.
- The alias values that the extension inserts into those fields or copies to your clipboard.



### Third‑party APIs

- Calls to Addy.io APIs using your Addy.io token to fetch account details, usernames, and domains.
- Calls to Polar.sh APIs to verify license keys and manage licensing status.

## 2. How We Use Information

We use the information described above to:

- Authenticate your Addy.io account and retrieve domains so aliases can be generated correctly.
- Generate email aliases based on your chosen format and the site you are visiting.
- Store and apply your settings and preferences within the extension.
- Verify your license key and enable Pro features.
- Operate, maintain, and improve the Service, including debugging and preventing abuse.

We do not use your Addy.io token, aliases, or browsing information for advertising or profiling.

## 3. Where Data Is Stored

### Local storage in your browser

Your Addy.io token, Addy.io account metadata (such as username), settings, and license state are stored using Chrome’s extension storage APIs (or localStorage in development environments). These remain on your device unless you remove them via the settings page, uninstall the extension, or clear your browser data.



## 4. Third‑Party Services

Alias Bridge interacts with the following third parties:

- **Addy.io** (formerly AnonAddy): we call their API using your token to retrieve account and domain data and to support alias generation. Your relationship with Addy.io is governed by their own terms and privacy policy.
- **Polar.sh**: used for license key verification and subscription management for Pro features. Any license key and metadata (e.g., instance label) sent to Polar.sh are subject to Polar’s terms and privacy policy.

- **Browser vendor (e.g., Google Chrome)**: the extension uses Chrome APIs such as `storage`, `activeTab`, `scripting`, `clipboardWrite`, and `contextMenus` to function.

We encourage you to review the privacy policies of these third parties.

## 5. What We Do Not Collect

Subject to your own backend configuration and standard network logs, we do not intentionally:

- Collect or store the contents of your emails.
- Collect or store your full browsing history.
- Record your keystrokes or passwords.

The content script scans pages only to find email input fields and uses the current page URL to generate aliases. This logic runs locally in your browser.

## 6. Data Retention

- Browser data (token, settings, license state) persists until you:
- Remove it from the settings page,
- Clear your browser data, or
- Uninstall the extension.


## 7. Security

We use reasonable technical and organizational measures to protect information, including:

- Keeping sensitive credentials (like your Addy.io API token) in browser extension storage/local storage on your device instead of our servers.
- Using HTTPS for communication with Addy.io and Polar.sh.

No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

## 8. Children’s Privacy

Alias Bridge is not directed to children under 16. We do not knowingly collect personal data from children under 16. If you believe a child has provided us with personal data, please contact us so we can remove it.

## 9. International Transfers

Depending on where you are located, your data may be processed in countries other than your own (e.g., where Addy.io or Polar.sh operate). By using the Service, you consent to such transfers.

## 10. Your Choices

You can:

- Add or remove your Addy.io API token at any time in the Settings page.
- Change your default domain, alias format, and custom rules.
- Stop using the extension and/or uninstall it to remove its access to your browser.
- Clear extension data via your browser’s settings.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. When we do, we will update the “Last updated” date above. Material changes may also be announced via the extension listing or documentation.

## 12. Contact Us

If you have questions about this Privacy Policy or our data practices, please contact us at:

Inspirex