/**
 * AI Workspace Pro — Google Sheets database webhook.
 *
 * Expected sheet headers:
 * id | createdAt | updatedAt | action | data
 *
 * Security:
 * - Store AI_WORKSPACE_WEBHOOK_SECRET in Script Properties.
 * - POST requests may supply the secret in the JSON `secret` field.
 * - GET requests may supply it as the `secret` query parameter.
 * - Google Apps Script web-app events do not expose arbitrary HTTP headers,
 *   so an X-Webhook-Secret header cannot be read directly by doGet/doPost.
 * - Never embed the webhook secret in public GitHub Pages JavaScript. Use a
 *   trusted server/proxy when a browser needs to call this endpoint.
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID_PROPERTY: 'AI_WORKSPACE_SPREADSHEET_ID',
  SECRET_PROPERTY: 'AI_WORKSPACE_WEBHOOK_SECRET',
  SHEET_NAME: 'Database',
  MAX_BODY_BYTES: 100000,
  MAX_ROWS_RETURNED: 500
});

function getScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(`Missing Script Property: ${name}`);
  return value;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(
    getScriptProperty_(CONFIG.SPREADSHEET_ID_PROPERTY)
  );
}

function getSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${CONFIG.SHEET_NAME}" was not found.`);
  return sheet;
}

function jsonResponse_(payload, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: status >= 200 && status < 300,
      status,
      ...payload
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders_(sheet) {
  const expected = ['id', 'createdAt', 'updatedAt', 'action', 'data'];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return expected;
  }

  const actual = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expected.length)).getValues()[0];
  if (!expected.every((header, index) => actual[index] === header)) {
    throw new Error('Database sheet headers must be: id, createdAt, updatedAt, action, data');
  }
  return expected;
}

function extractSecret_(e, payload) {
  return String(
    payload?.secret ||
    e?.parameter?.secret ||
    ''
  );
}

function authenticate_(e, payload) {
  const expected = getScriptProperty_(CONFIG.SECRET_PROPERTY);
  const supplied = extractSecret_(e, payload);
  if (!supplied || supplied !== expected) {
    throw new Error('Unauthorized request.');
  }
}

function parsePayload_(e) {
  const body = String(e?.postData?.contents || '');
  if (!body) throw new Error('Request body is required.');
  if (body.length > CONFIG.MAX_BODY_BYTES) throw new Error('Request body exceeds the maximum allowed size.');
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Request body must contain valid JSON.');
  }
}

function createId_() {
  return Utilities.getUuid();
}

function now_() {
  return new Date().toISOString();
}

function parseData_(value) {
  if (value === '' || value === null || value === undefined) return {};
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return { value: String(value) };
  }
}

function readRecords_() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, Math.min(lastRow - 1, CONFIG.MAX_ROWS_RETURNED), 5).getValues();
  return rows.map(row => ({
    id: String(row[0]),
    createdAt: row[1],
    updatedAt: row[2],
    action: String(row[3] || ''),
    data: parseData_(row[4])
  }));
}

function createRecord_(payload) {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const id = createId_();
  const timestamp = now_();
  sheet.appendRow([
    id,
    timestamp,
    timestamp,
    String(payload.action || 'create'),
    JSON.stringify(payload.data ?? {})
  ]);
  return { id, createdAt: timestamp, updatedAt: timestamp };
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = String(id);
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === target) return index + 2;
  }
  return -1;
}

function updateRecord_(payload) {
  if (!payload.id) throw new Error('Record id is required.');
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const row = findRowById_(sheet, payload.id);
  if (row === -1) throw new Error('Record not found.');
  const timestamp = now_();
  sheet.getRange(row, 3).setValue(timestamp);
  sheet.getRange(row, 5).setValue(JSON.stringify(payload.data ?? {}));
  return { id: String(payload.id), updatedAt: timestamp };
}

function deleteRecord_(payload) {
  if (!payload.id) throw new Error('Record id is required.');
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  const row = findRowById_(sheet, payload.id);
  if (row === -1) throw new Error('Record not found.');
  sheet.deleteRow(row);
  return { id: String(payload.id), deleted: true };
}

function doGet(e) {
  try {
    authenticate_(e, null);
    return jsonResponse_({ data: readRecords_() });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ error: error.message }, 401);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    authenticate_(e, payload);

    const action = String(payload.action || '').toLowerCase();
    let result;

    switch (action) {
      case 'list':
        result = { data: readRecords_() };
        break;
      case 'create':
        result = createRecord_(payload);
        break;
      case 'update':
        result = updateRecord_(payload);
        break;
      case 'delete':
        result = deleteRecord_(payload);
        break;
      default:
        throw new Error('Unsupported action. Use list, create, update, or delete.');
    }

    return jsonResponse_({ result });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ error: error.message }, 400);
  }
}
