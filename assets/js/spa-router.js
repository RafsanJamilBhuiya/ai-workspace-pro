import { isAuthenticated } from './auth.js';
import { initChat } from './chat.js';
import { mountCloudExplorer } from './cloud-explorer.js';

const routes = {
  dashboard: 'dashboard.html',
  chat: 'chat.html',
  plugins: 'plugins.html'
};

const cache = new Map();
const app = document.querySelector('#spa-view');
const header = document.querySelector('#app-header');

async function loadTemplate(name) {
  if (cache.has(name)) return cache.get(name);
  const response = await fetch(routes[name], { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${name} view.`);
  const html = await response.text();
  cache.set(name, html);
  return html;
}

function setWorkspaceVisibility(authenticated) {
  header?.classList.toggle('hidden', !authenticated);
  app?.classList.toggle('hidden', !authenticated);
  document.querySelector('#auth-view')?.classList.toggle('hidden', authenticated);
}

function shell(content, route) {
  app.innerHTML = content;
  app.querySelectorAll('a[href^="#/"]').forEach(link => {
    const href = link.getAttribute('href');
    link.setAttribute('aria-current', href === `#/${route}` ? 'page' : 'false');
  });
}

async function mountChatFeatures() {
  initChat();
  const explorer = document.querySelector('#cloud-explorer');
  if (explorer) mountCloudExplorer(explorer);
}

async function render() {
  if (!isAuthenticated()) {
    setWorkspaceVisibility(false);
    return;
  }

  setWorkspaceVisibility(true);

  const requested = location.hash.replace(/^#\//, '').split('?')[0] || 'dashboard';
  const route = routes[requested] ? requested : 'dashboard';

  try {
    shell(await loadTemplate(route), route);
    if (route === 'chat') await mountChatFeatures();
  } catch (error) {
    app.innerHTML = `
      <section class="page-view">
        <div class="glass-panel content-card">
          <h1>Unable to load view</h1>
          <p class="muted">${error.message}</p>
        </div>
      </section>`;
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('auth:ready', render);
window.addEventListener('auth:logout', render);
window.addEventListener('DOMContentLoaded', render);

export { render, loadTemplate };

void render();
