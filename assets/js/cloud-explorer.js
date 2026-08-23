import { listDriveFiles, getDriveFile, getSpreadsheet } from './api-handler.js';

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const instances = new WeakMap();

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSheet(file) {
  return file?.mimeType === SHEET_MIME;
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="cloud-explorer-panel">
      <div class="cloud-explorer-header">
        <strong>Cloud Explorer</strong>
        <span class="cloud-status loading"><i></i> Loading</span>
      </div>
      <div class="cloud-loading">Loading Google Drive…</div>
    </div>`;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="cloud-explorer-panel">
      <div class="cloud-explorer-header">
        <strong>Cloud Explorer</strong>
        <span class="cloud-status error"><i></i> Offline</span>
      </div>
      <div class="cloud-error">
        <p>${escapeHtml(message)}</p>
        <button type="button" data-cloud-action="refresh">Retry</button>
      </div>
    </div>`;
}

function render(container, state) {
  const files = state.files;
  container.innerHTML = `
    <div class="cloud-explorer-panel">
      <div class="cloud-explorer-header">
        <button type="button" class="cloud-explorer-title" data-cloud-action="toggle" aria-expanded="${state.expanded}">
          <span aria-hidden="true">☁️</span>
          <strong>Cloud Explorer</strong>
        </button>
        <div class="cloud-explorer-tools">
          <span class="cloud-status online"><i></i> Live</span>
          <button type="button" class="cloud-refresh" data-cloud-action="refresh" aria-label="Refresh cloud files">↻</button>
        </div>
      </div>
      <div class="cloud-explorer-body" ${state.expanded ? '' : 'hidden'}>
        ${files.length ? files.map(file => `
          <button type="button" class="cloud-file" data-file-id="${escapeHtml(file.id)}" data-mime-type="${escapeHtml(file.mimeType || '')}">
            <span class="cloud-file-icon" aria-hidden="true">${isSheet(file) ? '📊' : '📄'}</span>
            <span class="cloud-file-info">
              <strong>${escapeHtml(file.name || 'Untitled')}</strong>
              <small>${isSheet(file) ? 'Google Sheet' : 'Google Drive'}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>`).join('') : '<div class="cloud-empty">No recent Drive files found.</div>'}
      </div>
    </div>`;
}

async function load(container, state) {
  if (state.loading) return;
  state.loading = true;
  renderLoading(container);
  try {
    const response = await listDriveFiles({
      pageSize: 30,
      orderBy: 'modifiedTime desc',
      query: 'trashed = false'
    });
    state.files = Array.isArray(response?.files) ? response.files : [];
    render(container, state);
  } catch (error) {
    console.error('[CloudExplorer] Failed to load files:', error);
    renderError(container, error?.message || 'Unable to access Google Drive.');
  } finally {
    state.loading = false;
  }
}

async function previewFile(fileId, mimeType) {
  if (!fileId) return;
  try {
    const data = mimeType === SHEET_MIME
      ? await getSpreadsheet(fileId)
      : await getDriveFile(fileId);
    window.dispatchEvent(new CustomEvent('cloud:preview', {
      detail: { fileId, mimeType, data }
    }));
  } catch (error) {
    console.error('[CloudExplorer] Preview failed:', error);
    window.dispatchEvent(new CustomEvent('cloud:error', {
      detail: { fileId, mimeType, message: error?.message || 'Unable to preview this file.' }
    }));
  }
}

export function mountCloudExplorer(container) {
  if (!container) throw new TypeError('Cloud Explorer container is required.');
  instances.get(container)?.destroy();

  const state = { loading: false, files: [], expanded: true };
  const clickHandler = event => {
    const action = event.target.closest('[data-cloud-action]');
    if (action) {
      const actionName = action.dataset.cloudAction;
      if (actionName === 'toggle') {
        state.expanded = !state.expanded;
        render(container, state);
      } else if (actionName === 'refresh') {
        void load(container, state);
      }
      return;
    }
    const file = event.target.closest('[data-file-id]');
    if (file) void previewFile(file.dataset.fileId, file.dataset.mimeType);
  };

  container.addEventListener('click', clickHandler);
  const instance = {
    refresh: () => load(container, state),
    destroy: () => {
      container.removeEventListener('click', clickHandler);
      instances.delete(container);
    }
  };
  instances.set(container, instance);
  void load(container, state);
  return instance;
}

export { SHEET_MIME };
