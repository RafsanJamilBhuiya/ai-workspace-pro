# AI Workspace Pro

AI Workspace Pro is a modular, client-side Single Page Application for AI-assisted productivity. It combines Google Identity Services authentication, protected hash-based SPA views, Google Drive/Sheets access, and a server-side API boundary for Gemini and Apps Script operations.

## Architecture

```text
ai-workspace-pro/
├── index.html                 SPA shell + Google GIS authentication
├── dashboard.html             protected dashboard view
├── chat.html                  AI chat view + slash commands
├── plugins.html               Google integration manager
├── package.json               Node metadata and local development scripts
├── README.md                  project documentation
├── CONTRIBUTING.md            contribution workflow
├── LICENSE                    MIT license
└── assets/
    ├── css/
    │   ├── style.css          global dark/glass UI
    │   └── auth.css           authentication UI
    └── js/
        ├── auth.js            Google OAuth token lifecycle
        ├── spa-router.js       hash routing and protected views
        └── api-handler.js     authenticated Google/API request boundary
```

## SPA routes

- `#/dashboard` — workspace metrics and quick actions
- `#/chat` — AI chat and `/help`/`/clear` commands
- `#/plugins` — Drive, Sheets, and Apps Script integrations

The hash router means GitHub Pages does not need server-side route rewriting for these application routes.

## Google Identity Services

`index.html` loads the official Google Identity Services browser library and `auth.js` initializes the OAuth 2.0 token client with:

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive`

The OAuth Web Client ID is configured in `index.html`. In Google Cloud Console, enable the Google Sheets API and Google Drive API and add every deployment origin to the OAuth client's Authorized JavaScript origins.

The browser receives a short-lived access token. The application tracks expiry and stores the token only for the current workspace session. Do not place OAuth client secrets, Gemini API keys, service-account keys, or other server credentials in this repository.

## Runtime API configuration

The browser intentionally does not contain a Gemini API key. Configure a trusted HTTPS backend/proxy before using Gemini:

```js
window.__AI_WORKSPACE_CONFIG__ = {
  apiBaseUrl: 'https://api.example.com',
  gasEndpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
```

`api-handler.js` exposes authenticated request helpers for Gemini, Drive, Sheets, and GAS. Server-side endpoints must validate the Google access token, authorize the requested operation, enforce CORS/CSRF policy as appropriate, and keep all provider secrets server-side.

## Local development

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the URL printed by `serve`.

Syntax checks:

```bash
npm test
```

## GitHub Pages deployment

The repository contains a GitHub Actions Pages workflow. It publishes the repository root as a static site and deploys to the Pages environment. The expected project URL is:

`https://rafsanjamilbhuiya.github.io/ai-workspace-pro/`

Because application navigation uses URL fragments (`#/...`), normal SPA navigation does not require a server rewrite. `404.html` provides a safe fallback for accidental direct requests to unknown paths.

GitHub Pages must be enabled for the repository with **GitHub Actions** as the Pages source. If the repository has not yet been enabled for Pages, an administrator must enable it once under **Settings → Pages → Build and deployment → Source → GitHub Actions**.

## Security checklist

1. Never commit API keys or private OAuth credentials.
2. Use HTTPS for every runtime API endpoint.
3. Restrict Google OAuth origins to trusted domains.
4. Keep access-token lifetimes short and revoke sessions on logout.
5. Validate tokens and authorization again on every privileged backend request.
6. Apply least-privilege scopes and review Google Cloud consent-screen requirements.
7. Treat Apps Script web-app endpoints as authenticated API surfaces, not public secret stores.

## License

MIT. See `LICENSE`.
