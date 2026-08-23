# AI Workspace Pro

AI Workspace Pro is a lightweight, modular Single Page Application (SPA) shell for AI productivity workflows. It provides Google Identity Services authentication, hash-based navigation, a chat surface with slash commands, and an integration manager for Google Drive/Sheets through a controlled API boundary.

## Architecture

```text
index.html                 SPA shell + Google GIS
├── dashboard.html         protected dashboard template
├── chat.html              AI chat template + slash commands
├── plugins.html           Drive/Sheets integration manager
└── assets/
    ├── css/style.css      global theme + glassmorphism
    ├── css/auth.css       authentication UI + spinner
    └── js/
        ├── auth.js        Google OAuth token lifecycle
        ├── spa-router.js  hash router + protected views
        └── api-handler.js API/GAS fetch boundary
```

## Routes

- `#/dashboard` — workspace overview
- `#/chat` — AI chat and slash-command surface
- `#/plugins` — Google Drive/Sheets integration manager

The standalone HTML files are templates and documentation-friendly entry points; the shell renders them into the SPA through the router.

## Authentication

Google Identity Services is loaded from Google's official client library. Configure an OAuth 2.0 Web client and add the deployed origin to its authorized JavaScript origins. The current shell reads the client ID from the `google-client-id` meta tag in `index.html`.

The requested architecture includes a LocalStorage token manager. For production deployments, prefer short-lived access tokens and never store client secrets or API keys in browser storage.

## API boundary

`assets/js/api-handler.js` intentionally avoids hard-coding a Gemini API key. Configure a trusted backend/proxy or Google Apps Script endpoint through runtime configuration. Browser code should send user credentials only through HTTPS and should not expose server-side secrets.

Example runtime configuration:

```js
window.__AI_WORKSPACE_CONFIG__ = {
  apiBaseUrl: '/api',
  gasEndpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
```

## Local development

```bash
npm install
npm run dev
```

Then open the local URL printed by `serve`.

## Security notes

- Never commit Gemini API keys, OAuth client secrets, service-account keys, or GAS deployment secrets.
- Use HTTPS in production.
- Restrict OAuth origins and redirect configuration to trusted domains.
- Treat access tokens as sensitive and keep their lifetime minimal.
- Put privileged Gemini/GAS operations behind a server-side authorization boundary.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
