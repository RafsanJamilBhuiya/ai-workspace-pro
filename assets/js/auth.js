/* AI Workspace Pro — hardened browser authentication/session core.
 *
 * GitHub Pages is a static host, so OAuth access tokens cannot be protected by
 * HttpOnly cookies. Tokens are therefore kept in sessionStorage only (never
 * localStorage). A server/BFF is required for true HttpOnly session cookies.
 */

const CLIENT_ID = document.querySelector('meta[name="google-client-id"]')?.content
  || '1009455911830-sd9jb0mq47iobfqcnmlnbec43padb0oe.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';
const REQUIRED_SCOPES = SCOPES.split(/\s+/);
const APP_BASE_PATH = new URL('./', window.location.href).pathname;

export const AUTH_CONFIG = Object.freeze({
  clientId: CLIENT_ID,
  scopes: SCOPES,
  tokenKey: 'ai-workspace.access-token',
  expiresKey: 'ai-workspace.token-expires-at',
  scopeKey: 'ai-workspace.oauth-scopes',
  profileKey: 'ai-workspace.profile',
  sessionKey: 'ai-workspace.session.active',
  auditKey: 'ai-workspace.audit-log',
  historyKey: 'ai-workspace.history',
  cookieName: 'aiwp_session',
  idleTimeoutMs: 15 * 60 * 1000,
  refreshBeforeMs: 60 * 1000,
  auditLimit: 1000,
  historyLimit: 1000
});

let tokenClient = null;
let idleTimer = null;
let expiryTimer = null;
let refreshInFlight = null;
let idleCleanup = null;

function safeJSON(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function writeArray(key, item, limit) {
  try {
    const current = safeJSON(localStorage.getItem(key) || '[]', []);
    const list = Array.isArray(current) ? current : [];
    list.push(item);
    localStorage.setItem(key, JSON.stringify(list.slice(-limit)));
  } catch { /* telemetry must never break authentication */ }
}

export function recordAudit(type, message, meta = {}, severity = 'info') {
  writeArray(AUTH_CONFIG.auditKey, { id: uid(), time: new Date().toISOString(), type, message, meta, severity }, AUTH_CONFIG.auditLimit);
  window.dispatchEvent(new CustomEvent('auth:audit', { detail: { type, message, meta, severity } }));
}

export function recordActivity(action, metadata = {}) {
  writeArray(AUTH_CONFIG.historyKey, { id: uid(), createdAt: new Date().toISOString(), action, metadata }, AUTH_CONFIG.historyLimit);
}

function setSessionCookie(active) {
  // Non-sensitive state marker only. HttpOnly can only be issued server-side.
  document.cookie = `${AUTH_CONFIG.cookieName}=${active ? 'active' : ''}; Max-Age=${active ? 604800 : 0}; Path=${APP_BASE_PATH}; Secure; SameSite=Lax`;
}

export const TokenStore = Object.freeze({
  get() {
    const token = sessionStorage.getItem(AUTH_CONFIG.tokenKey);
    const expires = Number(sessionStorage.getItem(AUTH_CONFIG.expiresKey) || 0);
    if (!token || !expires || expires <= Date.now()) return null;
    return token;
  },
  set(token, expiresIn = 3600, scope = SCOPES) {
    const seconds = Math.max(60, Number(expiresIn) || 3600);
    sessionStorage.setItem(AUTH_CONFIG.tokenKey, token);
    sessionStorage.setItem(AUTH_CONFIG.expiresKey, String(Date.now() + seconds * 1000));
    sessionStorage.setItem(AUTH_CONFIG.scopeKey, scope || SCOPES);
    sessionStorage.setItem(AUTH_CONFIG.sessionKey, 'true');
    setSessionCookie(true);
  },
  clear() {
    sessionStorage.removeItem(AUTH_CONFIG.tokenKey);
    sessionStorage.removeItem(AUTH_CONFIG.expiresKey);
    sessionStorage.removeItem(AUTH_CONFIG.scopeKey);
    sessionStorage.removeItem(AUTH_CONFIG.profileKey);
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
    setSessionCookie(false);
  },
  scopes() { return (sessionStorage.getItem(AUTH_CONFIG.scopeKey) || '').split(/\s+/).filter(Boolean); }
});

export function getAccessToken() { return TokenStore.get(); }
export function getTokenExpiry() { const value = Number(sessionStorage.getItem(AUTH_CONFIG.expiresKey) || 0); return value > 0 ? value : null; }
export function getTokenSecondsRemaining() { const expiry = getTokenExpiry(); return expiry ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 0; }
export function getTokenCountdown() { const totalSeconds = getTokenSecondsRemaining(); return { totalSeconds, minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60, formatted: `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}` }; }
export function isTokenExpired(bufferMs = 0) { const expiry = getTokenExpiry(); return !expiry || Date.now() + bufferMs >= expiry; }

export function getProfile() { return safeJSON(localStorage.getItem(AUTH_CONFIG.profileKey) || 'null', null); }
export function cacheProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const safe = { name: String(profile.name || ''), email: String(profile.email || ''), picture: String(profile.picture || ''), locale: String(profile.locale || '') };
  localStorage.setItem(AUTH_CONFIG.profileKey, JSON.stringify(safe));
  window.dispatchEvent(new CustomEvent('auth:profile', { detail: safe }));
  return safe;
}

export async function fetchGoogleProfile(token = getAccessToken()) {
  if (!token) throw new Error('No OAuth access token available.');
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` }, credentials: 'omit' });
  if (!response.ok) throw new Error(`Profile request failed (${response.status}).`);
  return cacheProfile(await response.json());
}

export function validateToken() {
  const token = TokenStore.get();
  if (!token) return false;
  const granted = TokenStore.scopes();
  if (granted.length && !REQUIRED_SCOPES.every(scope => granted.includes(scope))) {
    recordAudit('AUTH_SCOPE_ERROR', 'Required OAuth scopes are missing.', { granted }, 'error');
    return false;
  }
  return true;
}

export function isAuthenticated() { return Boolean(validateToken() && sessionStorage.getItem(AUTH_CONFIG.sessionKey) === 'true'); }
function setAppAuthenticated() { document.querySelector('#auth-view')?.classList.add('hidden'); document.querySelector('#spa-view')?.classList.remove('hidden'); window.dispatchEvent(new CustomEvent('auth:ready', { detail: { profile: getProfile(), expiresAt: getTokenExpiry() } })); }
function setAppSignedOut() { document.querySelector('#spa-view')?.classList.add('hidden'); document.querySelector('#auth-view')?.classList.remove('hidden'); }
function setStatus(message, type = '') { const el = document.querySelector('#auth-status'); if (el) { el.textContent = message; el.className = `auth-status ${type}`; } }
function setLoading(value) { document.querySelector('.auth-card')?.classList.toggle('is-loading', value); }

export function initializeGIS() {
  if (tokenClient || !window.google?.accounts?.oauth2) return Boolean(tokenClient);
  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async response => {
        setLoading(false);
        if (response?.error || !response?.access_token) {
          recordAudit('AUTH_ERROR', response?.error_description || 'Google authorization failed.', { response }, 'error');
          window.dispatchEvent(new CustomEvent('auth:error', { detail: response }));
          return;
        }
        try {
          TokenStore.set(response.access_token, response.expires_in, response.scope || SCOPES);
          const profile = await fetchGoogleProfile(response.access_token);
          recordAudit('AUTH_SUCCESS', 'Google authentication completed.', { email: profile?.email || '' });
          recordActivity('login', { email: profile?.email || '' });
          setAppAuthenticated();
          window.dispatchEvent(new CustomEvent('auth:ready', { detail: { profile, expiresAt: getTokenExpiry() } }));
        } catch (error) {
          TokenStore.clear();
          recordAudit('AUTH_ERROR', error.message, {}, 'error');
          window.dispatchEvent(new CustomEvent('auth:error', { detail: { error } }));
        }
      },
      error_callback: error => {
        setLoading(false);
        recordAudit('AUTH_ERROR', 'Google Identity Services request failed.', { error }, 'error');
        window.dispatchEvent(new CustomEvent('auth:error', { detail: { error } }));
      }
    });
    return true;
  } catch (error) {
    recordAudit('AUTH_ERROR', 'GIS initialization failed.', { message: error.message }, 'error');
    return false;
  }
}

export function requestAccessToken({ prompt = '' } = {}) {
  if (!initializeGIS()) return Promise.reject(new Error('Google Identity Services has not loaded yet.'));
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = new Promise((resolve, reject) => {
    const ready = event => { cleanup(); resolve(event.detail); };
    const failed = event => { cleanup(); reject(event.detail?.error || new Error('Authentication failed.')); };
    const cleanup = () => { window.removeEventListener('auth:ready', ready); window.removeEventListener('auth:error', failed); };
    window.addEventListener('auth:ready', ready, { once: true });
    window.addEventListener('auth:error', failed, { once: true });
    setLoading(true);
    tokenClient.requestAccessToken({ prompt });
  }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function refreshTokenIfNeeded() {
  if (!getAccessToken()) return false;
  if (!isTokenExpired(AUTH_CONFIG.refreshBeforeMs)) return true;
  try { await requestAccessToken({ prompt: '' }); recordAudit('TOKEN_REFRESH', 'OAuth token refreshed before expiry.'); return true; }
  catch (error) { recordAudit('TOKEN_REFRESH_ERROR', 'Automatic token refresh failed.', { message: error.message }, 'warning'); return false; }
}

function stopTimers() { clearTimeout(idleTimer); clearInterval(expiryTimer); idleTimer = null; expiryTimer = null; idleCleanup?.(); idleCleanup = null; }
export function startInactivityMonitor() {
  stopTimers();
  const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { recordAudit('AUTH_TIMEOUT', 'Session terminated after 15 minutes of inactivity.', {}, 'warning'); void teardownSession({ redirect: true, reason: 'idle-timeout' }); }, AUTH_CONFIG.idleTimeoutMs); };
  const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'];
  events.forEach(type => window.addEventListener(type, reset, { passive: true }));
  idleCleanup = () => events.forEach(type => window.removeEventListener(type, reset));
  reset();
}
export function stopInactivityMonitor() { stopTimers(); }

export function startExpiryMonitor() {
  clearInterval(expiryTimer);
  expiryTimer = setInterval(async () => {
    const remaining = getTokenSecondsRemaining();
    window.dispatchEvent(new CustomEvent('auth:countdown', { detail: getTokenCountdown() }));
    if (remaining > 0 && remaining <= AUTH_CONFIG.refreshBeforeMs / 1000) await refreshTokenIfNeeded();
    if (remaining === 0 && isAuthenticated()) { recordAudit('AUTH_EXPIRED', 'OAuth session expired.', {}, 'warning'); await teardownSession({ redirect: true, reason: 'token-expired' }); }
  }, 1000);
}

export async function teardownSession({ redirect = false, reason = 'user' } = {}) {
  const token = getAccessToken();
  recordAudit('AUTH_LOGOUT', 'Session termination requested.', { reason });
  recordActivity('logout', { reason });
  stopTimers();
  if (token && window.google?.accounts?.oauth2?.revoke) { try { await new Promise(resolve => window.google.accounts.oauth2.revoke(token, resolve)); } catch { /* local cleanup still proceeds */ } }
  try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch { /* GIS may be absent */ }
  TokenStore.clear();
  try { sessionStorage.clear(); } catch {}
  localStorage.removeItem(AUTH_CONFIG.profileKey);
  setAppSignedOut();
  window.dispatchEvent(new CustomEvent('auth:logout'));
  if (redirect) window.location.replace(`${APP_BASE_PATH}logout.html`);
}
export function clearSession() { void teardownSession({ redirect: false, reason: 'user' }); }

function trackPageTransitions() {
  const log = () => { recordAudit('NAV_CHANGE', 'Page or SPA route changed.', { path: location.pathname, hash: location.hash }); recordActivity('navigation', { path: location.pathname, hash: location.hash }); };
  window.addEventListener('hashchange', log);
  window.addEventListener('popstate', log);
}

export function initGoogleAuth() {
  if (isAuthenticated()) { setStatus('Session restored.', 'success'); startInactivityMonitor(); startExpiryMonitor(); setAppAuthenticated(); void fetchGoogleProfile().catch(() => {}); return; }
  const wait = () => { if (initializeGIS()) return; if (!window.google?.accounts?.oauth2) setTimeout(wait, 100); };
  wait();
  startExpiryMonitor();
}

trackPageTransitions();
window.addEventListener('DOMContentLoaded', () => { if (document.querySelector('#auth-view') || document.querySelector('#google-signin')) initGoogleAuth(); else if (isAuthenticated()) { startInactivityMonitor(); startExpiryMonitor(); } });

window.AIWorkspaceAuth = Object.freeze({ config: AUTH_CONFIG, getAccessToken, getProfile, getTokenExpiry, getTokenSecondsRemaining, getTokenCountdown, isTokenExpired, isAuthenticated, initializeGIS, requestAccessToken, refreshTokenIfNeeded, recordAudit, recordActivity, startInactivityMonitor, stopInactivityMonitor, teardownSession, clearSession });

export { CLIENT_ID, SCOPES, REQUIRED_SCOPES };