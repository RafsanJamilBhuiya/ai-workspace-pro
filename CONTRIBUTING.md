# Contributing to AI Workspace Pro

Thanks for contributing. This repository favors small, reviewable changes and a clear separation between UI, authentication, routing, and API integration concerns.

## Workflow

1. Fork the repository.
2. Create a focused feature branch.
3. Make the smallest coherent change.
4. Run `npm test` and `npm run lint`.
5. Verify the SPA routes manually in a browser.
6. Open a pull request with a concise description and testing notes.

## Architecture rules

- Keep authentication concerns in `assets/js/auth.js`.
- Keep navigation and view rendering in `assets/js/spa-router.js`.
- Keep external HTTP calls behind `assets/js/api-handler.js`.
- Do not place secrets in HTML, JavaScript, CSS, or committed configuration.
- Prefer accessible semantic HTML and progressive enhancement.
- Keep global styles in `style.css`; authentication-only styles belong in `auth.css`.

## Commit conventions

Use an imperative, descriptive prefix such as `feat:`, `fix:`, `refactor:`, `docs:`, or `chore:`.

## Pull requests

Include:

- what changed;
- why it changed;
- tests/checks performed;
- screenshots for meaningful UI changes;
- any required environment or OAuth configuration changes.

## Security

Never commit API keys, OAuth client secrets, service-account credentials, access tokens, or private Google Apps Script deployment information. Report security vulnerabilities privately rather than opening a public issue.
