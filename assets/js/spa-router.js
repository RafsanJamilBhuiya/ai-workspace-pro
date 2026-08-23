import {isAuthenticated,clearSession} from './auth.js';
import {callGemini} from './api-handler.js';

const routes={
  dashboard:'dashboard.html',
  chat:'chat.html',
  plugins:'plugins.html'
};
const cache=new Map();
const app=document.querySelector('#spa-view');

async function loadTemplate(name){
  if(cache.has(name))return cache.get(name);
  const response=await fetch(routes[name],{cache:'no-store'});
  if(!response.ok)throw new Error(`Unable to load ${name} view.`);
  const html=await response.text();cache.set(name,html);return html;
}

function shell(content,route){
  app.innerHTML=`<nav class="glass-panel" style="position:sticky;top:12px;z-index:10;width:min(1120px,calc(100% - 32px));margin:12px auto 0;padding:10px 14px;display:flex;gap:10px;align-items:center"><strong style="margin-right:auto">AI Workspace Pro</strong><a href="#/dashboard">Dashboard</a><a href="#/chat">Chat</a><a href="#/plugins">Plugins</a><button id="logout" class="button" style="padding:6px 10px">Sign out</button></nav>${content}`;
  app.querySelectorAll('nav a').forEach(a=>a.setAttribute('aria-current',a.getAttribute('href')===`#/${route}`?'page':'false'));
  app.querySelector('#logout')?.addEventListener('click',clearSession);
}

function bindChat(){
  const form=document.querySelector('#chat-form');const input=document.querySelector('#chat-input');const log=document.querySelector('#chat-log');
  if(!form||!input||!log)return;
  const append=(text,role)=>{const el=document.createElement('div');el.className=`message ${role}`;el.textContent=text;log.appendChild(el);log.scrollTop=log.scrollHeight;};
  form.addEventListener('submit',async event=>{event.preventDefault();const text=input.value.trim();if(!text)return;input.value='';append(text,'user');
    if(text==='/help'){append('/help — show commands\n/clear — clear conversation\nAnything else — send to the configured Gemini proxy.','assistant');return;}
    if(text==='/clear'){log.innerHTML='';append('Conversation cleared.','assistant');return;}
    try{append('Thinking…','assistant');const result=await callGemini({contents:[{role:'user',parts:[{text}]}]});log.lastElementChild.textContent=result?.text||result?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'No response returned.';}catch(error){log.lastElementChild.textContent=error.message;}
  });
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
}

async function render(){
  if(!isAuthenticated()){app.classList.add('hidden');document.querySelector('#auth-view')?.classList.remove('hidden');return;}
  document.querySelector('#auth-view')?.classList.add('hidden');app.classList.remove('hidden');
  const requested=location.hash.replace(/^#\//,'').split('?')[0]||'dashboard';const route=routes[requested]?requested:'dashboard';
  try{shell(await loadTemplate(route),route);if(route==='chat')bindChat();}catch(error){app.innerHTML=`<section class="page-view"><div class="glass-panel content-card"><h1>Unable to load view</h1><p class="muted">${error.message}</p></div></section>`;}
}

window.addEventListener('hashchange',render);window.addEventListener('auth:ready',render);window.addEventListener('DOMContentLoaded',render);render();
export {render};
