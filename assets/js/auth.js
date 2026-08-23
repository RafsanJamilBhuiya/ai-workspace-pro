const TOKEN_KEY='ai-workspace.access-token';
const EXPIRES_KEY='ai-workspace.token-expires-at';
const CLIENT_ID=document.querySelector('meta[name="google-client-id"]')?.content||'';
const SCOPES='openid profile email https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

const TokenStore={
  get(){const token=localStorage.getItem(TOKEN_KEY);const expires=Number(localStorage.getItem(EXPIRES_KEY)||0);return token&&expires>Date.now()?token:null;},
  set(token,expiresIn){localStorage.setItem(TOKEN_KEY,token);localStorage.setItem(EXPIRES_KEY,String(Date.now()+Math.max(60,expiresIn-30)*1000));},
  clear(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(EXPIRES_KEY);},
  has(){return Boolean(this.get());}
};

function status(message,type=''){const el=document.querySelector('#auth-status');if(el){el.textContent=message;el.className=`auth-status ${type}`;}}
function setAuthenticated(){document.querySelector('#auth-view')?.classList.add('hidden');document.querySelector('#spa-view')?.classList.remove('hidden');window.dispatchEvent(new CustomEvent('auth:ready'));}
function setLoading(value){document.querySelector('.auth-card')?.classList.toggle('is-loading',value);}

export function getAccessToken(){return TokenStore.get();}
export function clearSession(){TokenStore.clear();location.hash='';location.reload();}
export function isAuthenticated(){return TokenStore.has();}

export function initGoogleAuth(){
  if(TokenStore.has()){setAuthenticated();return;}
  if(!CLIENT_ID){status('Google OAuth client ID is not configured.','error');return;}
  const waitForGIS=()=>{
    if(!window.google?.accounts?.oauth2){setTimeout(waitForGIS,100);return;}
    const client=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,callback:(response)=>{
      setLoading(false);
      if(response.error){status(`Sign-in failed: ${response.error}`,'error');return;}
      if(!response.access_token){status('Google returned no access token.','error');return;}
      TokenStore.set(response.access_token,response.expires_in||3600);status('Signed in successfully.','success');setAuthenticated();
    }});
    const container=document.querySelector('#google-signin');
    if(container){const button=document.createElement('button');button.className='button';button.type='button';button.textContent='Continue with Google';button.addEventListener('click',()=>{setLoading(true);status('Opening Google authorization…');client.requestAccessToken({prompt:TokenStore.has()?'':'consent'});});container.replaceChildren(button);}
  };
  waitForGIS();
}

window.addEventListener('DOMContentLoaded',initGoogleAuth);
export {TokenStore};
