# Alias Bridge

**Alias Bridge** is a Chrome Extension that bridges the gap between your password manager and email alias services like Addy.io (formerly AnonAddy).

## Features

- **Instant Aliases**: Generate UUID, Random, or Domain-based aliases directly from the browser popup.
- **Auto-Fill**: Automatically detects email fields and injects a button to fill them instantly.
- **Privacy First**: Your API keys are stored locally in your browser.
- **Smart Context**: Detects the current website domain to suggest relevant aliases (e.g., `netflix@user.anonaddy.com`).

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store page.
2. Click "Add to Chrome".

### Manual Installation (Developer Mode)
1. Download the latest release `.zip` or clone this repository.
2. Run `npm install` and `npm run build` in the `extension` directory.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** (top right).
5. Click **Load unpacked** and select the `extension/dist` folder.

## Usage

1. **Setup**:
   - Click the extension icon.
   - Go to Settings (gear icon).
   - Enter your Addy.io API Token.
2. **Generate**:
   - Open the popup on any site.
   - Choose your alias format (UUID, Random, etc.).
   - Click "Copy & Fill".
3. **In-Page**:
   - Look for the Alias Bridge icon inside email input fields.
   - Click it to instantly generate and fill a random alias.

## Development

### Extension
```bash
cd extension
npm install
npm run dev
```



## License

This project is licensed under the MIT License.
