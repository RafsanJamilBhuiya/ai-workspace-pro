import { getAccessToken, clearSession } from './auth.js';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_SHEETS_API = 'https://sheets.googleapis.com/v4';

function runtimeConfig() {
  return window.__AI_WORKSPACE_CONFIG__ || {};
}

function requireToken() {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Google authentication is required.');
  }
  return token;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body?.error
      ? (typeof body.error === 'string' ? body.error : body.error.message)
      : `Request failed (${response.status})`;
    const error = new Error(message || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = options.auth === false ? null : requireToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit'
  });

  if (response.status === 401 || response.status === 403) {
    if (response.status === 401) {
      clearSession();
    }
    const error = new Error(
      response.status === 401
        ? 'Authentication expired. Please sign in again.'
        : 'Google rejected this operation. Check OAuth scopes and authorization.'
    );
    error.status = response.status;
    throw error;
  }

  return parseResponse(response);
}

function buildUrl(base, path, params = {}) {
  const url = new URL(`${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function callGemini(payload) {
  const base = runtimeConfig().apiBaseUrl;
  if (!base) {
    throw new Error('No trusted Gemini API proxy configured. Set window.__AI_WORKSPACE_CONFIG__.apiBaseUrl.');
  }

  return request(buildUrl(base, 'gemini'), {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function callGas(action, payload = {}) {
  const endpoint = runtimeConfig().gasEndpoint;
  if (!endpoint) {
    throw new Error('Google Apps Script endpoint is not configured.');
  }

  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ action, payload })
  });
}

export async function listDriveFiles({ query, pageSize = 50, pageToken } = {}) {
  const url = buildUrl(GOOGLE_DRIVE_API, 'files', {
    q: query,
    pageSize: Math.min(Math.max(Number(pageSize) || 50, 1), 1000),
    pageToken,
    fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)'
  });

  return request(url, { method: 'GET' });
}

export async function getDriveFile(fileId, fields = 'id,name,mimeType,size,modifiedTime,webViewLink,parents') {
  if (!fileId) {
    throw new TypeError('fileId is required.');
  }

  return request(buildUrl(GOOGLE_DRIVE_API, `files/${encodeURIComponent(fileId)}`, { fields }), {
    method: 'GET'
  });
}

export async function readSheetValues(spreadsheetId, range) {
  if (!spreadsheetId || !range) {
    throw new TypeError('spreadsheetId and range are required.');
  }

  return request(
    buildUrl(
      GOOGLE_SHEETS_API,
      `spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    ),
    { method: 'GET' }
  );
}

export async function writeSheetValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
  if (!spreadsheetId || !range || !Array.isArray(values)) {
    throw new TypeError('spreadsheetId, range, and an array of values are required.');
  }

  const url = buildUrl(
    GOOGLE_SHEETS_API,
    `spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    { valueInputOption }
  );

  return request(url, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
}

export async function batchUpdateSheetValues(spreadsheetId, data, valueInputOption = 'USER_ENTERED') {
  if (!spreadsheetId || !Array.isArray(data)) {
    throw new TypeError('spreadsheetId and data array are required.');
  }

  const url = buildUrl(
    GOOGLE_SHEETS_API,
    `spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`
  );

  return request(url, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption, data })
  });
}

export async function getSpreadsheet(spreadsheetId, fields) {
  if (!spreadsheetId) {
    throw new TypeError('spreadsheetId is required.');
  }

  return request(
    buildUrl(GOOGLE_SHEETS_API, `spreadsheets/${encodeURIComponent(spreadsheetId)}`, { fields }),
    { method: 'GET' }
  );
}

export function getRuntimeConfig() {
  return { ...runtimeConfig() };
}
