# Contributing to AI Workspace Pro

Thank you for contributing. Keep changes focused, reviewable, secure, and compatible with the static SPA architecture.

## Development workflow

1. Fork or create a working branch from `main`.
2. Keep each change focused on one concern.
3. Preserve the separation between authentication, routing, UI, and API integration.
4. Run `npm test` before opening a pull request.
5. Test `#/dashboard`, `#/chat`, and `#/plugins` in a browser.
6. Verify Google OAuth behavior when authentication-related code changes.
7. Open a pull request with a concise description and testing notes.

## Architecture rules

- `assets/js/auth.js` owns Google authentication and token lifecycle.
- `assets/js/spa-router.js` owns hash navigation and view loading.
- `assets/js/api-handler.js` owns external HTTP requests.
- Keep reusable global styles in `assets/css/style.css`.
- Keep authentication-specific styles in `assets/css/auth.css`.
- Keep HTML semantic, accessible, responsive, and progressively enhanced.
- Do not duplicate authentication or API logic inside individual views.

## Security requirements

Never commit:

- Gemini or other API keys;
- OAuth client secrets;
- service-account private keys;
- access tokens or refresh tokens;
- private Apps Script deployment credentials.

OAuth access tokens are sensitive. Do not log token values, include them in URLs, or expose them to third-party analytics.

## Code quality

Use modern browser JavaScript, meaningful names, small functions, explicit error handling, and no dead placeholder code. Changes must not silently break existing DOM IDs or route contracts.

## Commit messages

Use an imperative prefix such as:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
- `test:`

Example: `fix: handle expired Google access tokens`

## Pull requests

Include:

- what changed;
- why it changed;
- tests/checks performed;
- screenshots for meaningful UI changes;
- required OAuth, API, or deployment configuration changes.

## Reporting security issues

Do not publish exploitable credentials or sensitive security details in a public issue. Contact the repository owner privately with reproduction details and remediation information.
