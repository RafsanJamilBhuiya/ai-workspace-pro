import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'service-worker.js',
  'assets/js/auth.js',
  'assets/js/api-handler.js',
  'assets/js/request-queue.js',
  'assets/js/error-resilience.js',
  'assets/js/ai-guardrails.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/(["'(])\/(assets|service-worker\.js)\//.test(index)) {
  throw new Error('Root-relative project assets detected in index.html. Use project-relative paths.');
}
if (!index.includes('./assets/css/style.css') || !index.includes('./assets/js/auth.js')) {
  throw new Error('Critical relative asset references are missing from index.html.');
}
if (!index.includes("/ai-workspace-pro/service-worker.js") || !index.includes("scope:'/ai-workspace-pro/'")) {
  throw new Error('GitHub Pages service-worker registration scope is incorrect.');
}

const auth = fs.readFileSync(path.join(root, 'assets/js/auth.js'), 'utf8');
if (auth.includes('localStorage.setItem(AUTH_CONFIG.tokenKey')) {
  throw new Error('OAuth access token must not be persisted to localStorage.');
}
if (!auth.includes('sessionStorage.setItem(AUTH_CONFIG.tokenKey')) {
  throw new Error('OAuth token sessionStorage storage is missing.');
}

const api = fs.readFileSync(path.join(root, 'assets/js/api-handler.js'), 'utf8');
if (!api.includes("from './request-queue.js'")) {
  throw new Error('api-handler.js is not integrated with the request queue.');
}
if (!api.includes('apiRequestQueue.add(')) {
  throw new Error('API requests bypass the central request queue.');
}

const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
if (!sw.includes("new URL('./', self.registration.scope).pathname")) {
  throw new Error('Service worker is not deriving its base path from registration scope.');
}

console.log('Static smoke checks passed.');
