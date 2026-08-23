const TOKEN_KEY='ai-workspace.access-token';
const EXPIRES_KEY='ai-workspace.token-expires-at';
const SCOPE_KEY='ai-workspace.oauth-scopes';
const CLIENT_ID=document.querySelector('meta[name="google-client-id"]')?.content||'';
const SCOPES='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';
const REQUIRED_SCOPES=SCOPES.split(/\s+/);

const TokenStore={
 get(){const token=localStorage.getItem(TOKEN_KEY);const expires=Number(localStorage.getItem(EXPIRES_KEY)||0);if(!token||!expires||expires<=Date.now()){this.clear();return null}return token},
 set(token,expiresIn,scope){const seconds=Number(expiresIn)||3600;localStorage.setItem(TOKEN_KEY,token);localStorage.setItem(EXPIRES_KEY,String(Date.now()+Math.max(60,seconds-30)*1000));if(scope)localStorage.setItem(SCOPE_KEY,scope)},
 scopes(){return (localStorage.getItem(SCOPE_KEY)||'').split(/\s+/).filter(Boolean)},
 clear(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(EXPIRES_KEY);localStorage.removeItem(SCOPE_KEY)},
 has(){return Boolean(this.get())}
};

function status(message,type=''){const el=document.querySelector('#auth-status');if(el){el.textContent=message;el.className=`auth-status ${type}`}}
function setLoading(value){document.querySelector('.auth-card')?.classList.toggle('is-loading',value)}
function setAuthenticated(){document.querySelector('#auth-view')?.classList.add('hidden');document.querySelector('#spa-view')?.classList.remove('hidden');window.dispatchEvent(new CustomEvent('auth:ready'))}
function setSignedOut(){document.querySelector('#spa-view')?.classList.add('hidden');document.querySelector('#auth-view')?.classList.remove('hidden')}

export function getAccessToken(){return TokenStore.get()}
export function isAuthenticated(){return TokenStore.has()}
export function clearSession(){const token=TokenStore.get();if(token&&window.google?.accounts?.oauth2){try{window.google.accounts.oauth2.revoke(token,()=>{})}catch(error){console.warn('Google token revoke failed:',error)}}TokenStore.clear();setSignedOut();status('Signed out.');location.hash='';window.dispatchEvent(new CustomEvent('auth:logout'))}
export function validateToken(){const token=TokenStore.get();if(!token)return false;const scopes=TokenStore.scopes();if(scopes.length>0&&!REQUIRED_SCOPES.every(scope=>scopes.includes(scope))) {TokenStore.clear();return false}return true}

export function initGoogleAuth(){
 if(!CLIENT_ID){status('Google OAuth client ID is not configured.','error');return}
 if(validateToken()){status('Session restored.','success');setAuthenticated();return}
 const waitForGIS=()=>{
  if(!window.google?.accounts?.oauth2){setTimeout(waitForGIS,100);return}
  let client;
  try{client=window.google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,callback:(response)=>{setLoading(false);if(response?.error){status(response.error_description||`Sign-in failed: ${response.error}`,'error');return}if(!response?.access_token){status('Google returned no access token.','error');return}TokenStore.set(response.access_token,response.expires_in||3600,response.scope||SCOPES);if(!validateToken()){status('The granted OAuth scopes are incomplete.','error');return}console.log('✅ Token captured successfully');status('Signed in successfully.','success');setAuthenticated()},error_callback:(error)=>{setLoading(false);console.error('Google Identity Services error:',error);status('Google authorization failed. Please try again.','error')}})}catch(error){console.error('GIS initialization failed:',error);status('Unable to initialize Google authentication.','error');return}
  const container=document.querySelector('#google-signin');
  if(container){const button=document.createElement('button');button.className='button';button.type='button';button.textContent='Continue with Google';button.addEventListener('click',()=>{setLoading(true);status('Opening Google authorization…');client.requestAccessToken({prompt:'consent'})});container.replaceChildren(button)}
 };
 waitForGIS();
}

window.addEventListener('DOMContentLoaded',initGoogleAuth);
export {TokenStore,CLIENT_ID,SCOPES,REQUIRED_SCOPES};