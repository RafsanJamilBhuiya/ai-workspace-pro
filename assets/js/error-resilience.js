/* AI Workspace Pro — framework-free error boundary and retry utilities */
export function withRetry(task, { retries = 2, baseDelayMs = 500, maxDelayMs = 5000, shouldRetry = defaultShouldRetry, onRetry } = {}) {
  return (async () => {
    let attempt = 0;
    while (true) {
      try { return await task(attempt); }
      catch (error) {
        if (attempt >= retries || !shouldRetry(error, attempt)) throw error;
        attempt += 1;
        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        onRetry?.(error, attempt, delay);
        await new Promise(resolve => setTimeout(resolve, delay + Math.floor(Math.random() * 150)));
      }
    }
  })();
}

export function defaultShouldRetry(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
}

export function installErrorBoundary({ root = document.body, fallback = defaultFallback } = {}) {
  const show = error => {
    try {
      root.innerHTML = '';
      root.appendChild(fallback(error));
    } catch {
      document.body.textContent = 'AI Workspace Pro encountered an unexpected error.';
    }
  };
  window.addEventListener('error', event => show(event.error || new Error(event.message)));
  window.addEventListener('unhandledrejection', event => show(event.reason instanceof Error ? event.reason : new Error(String(event.reason))));
  return show;
}

function defaultFallback(error) {
  const section = document.createElement('section');
  section.className = 'error-fallback';
  section.setAttribute('role', 'alert');
  section.innerHTML = '<h1>Something went wrong</h1><p>The workspace could not complete this operation.</p><button type="button">Retry</button>';
  section.querySelector('button').addEventListener('click', () => location.reload());
  if (globalThis.AIWorkspaceAuth?.recordAudit) globalThis.AIWorkspaceAuth.recordAudit('UI_ERROR', error?.message || 'Unknown UI error', {}, 'error');
  return section;
}
