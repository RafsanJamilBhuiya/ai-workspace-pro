import {getAccessToken,clearSession} from './auth.js';

const config=()=>window.__AI_WORKSPACE_CONFIG__||{};

async function request(url,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('Accept','application/json');
  if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const token=getAccessToken();
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(url,{...options,headers,credentials:'omit'});
  if(response.status===401){clearSession();throw new Error('Authentication expired.');}
  const contentType=response.headers.get('content-type')||'';
  const body=contentType.includes('application/json')?await response.json():await response.text();
  if(!response.ok){const message=typeof body==='object'&&body?.error?body.error:`Request failed (${response.status})`;throw new Error(message);}
  return body;
}

export async function callGemini(payload){
  const base=config().apiBaseUrl;
  if(!base)throw new Error('No trusted API proxy configured. Set window.__AI_WORKSPACE_CONFIG__.apiBaseUrl.');
  return request(`${base.replace(/\/$/,'')}/gemini`,{method:'POST',body:JSON.stringify(payload)});
}

export async function callGas(action,payload={}){
  const endpoint=config().gasEndpoint;
  if(!endpoint)throw new Error('Google Apps Script endpoint is not configured.');
  return request(endpoint,{method:'POST',body:JSON.stringify({action,payload})});
}

export {request};
