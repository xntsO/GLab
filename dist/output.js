import {bindCanvasInput} from './emscripten-adapter.js?v=8';
const $ = id => document.getElementById(id);
const session = new URLSearchParams(location.hash.slice(1)).get('session');
const channel = 'gllab-output-v1', parent = window.opener;
let connected = false, generation = -1, frameTimer, drawing = false;
const send = (type, extra = {}) => {if (parent && !parent.closed) parent.postMessage({channel, session, type, ...extra}, location.origin);};
function requestFrame(delay = 67) {clearTimeout(frameTimer); if (connected) frameTimer = setTimeout(() => send('request-frame'), delay);}
function disconnect(message = 'Editor closed. Open the workspace to run again.') {connected = false; clearTimeout(frameTimer); $('status').textContent = message; $('stop').disabled = true; $('menu').hidden = true;}
function input(event) {if (connected) send('input', {event});}
const canvas = $('canvas'), context = canvas.getContext('2d');
bindCanvasInput(canvas,input,{pointerDown:()=>{$('menu').hidden=true;}});
function showMenu(menu) {
  const popup = $('menu'); popup.replaceChildren();
  for (const item of menu.items) {const button = document.createElement('button');button.textContent = item.label+(item.sub?' >':'');button.setAttribute('role','menuitem');button.addEventListener('click', () => {input(item.sub?{type:'menuOpen',menu:item.sub,x:menu.x,y:menu.y}:{type:'menu',menu:menu.menu,value:item.value});if (!item.sub) {popup.hidden = true;canvas.focus();}});popup.append(button);}
  const rect = canvas.getBoundingClientRect(), surround = $('surround').getBoundingClientRect();
  popup.style.left = `${Math.max(4,Math.min(surround.width-180,rect.left-surround.left+menu.x/canvas.width*rect.width))}px`;
  popup.style.top = `${Math.max(4,Math.min(surround.height-120,rect.top-surround.top+menu.y/canvas.height*rect.height))}px`;
  popup.hidden = false; popup.querySelector('button')?.focus();
}
window.addEventListener('message', async ({origin, source, data}) => {
  if (origin !== location.origin || source !== parent || !data || data.channel !== channel || data.session !== session) return;
  if (data.type === 'disconnected') {disconnect(data.message);return;}
  if (data.type === 'state') {
    const state = data.state;
    if (!state || !Number.isInteger(state.generation) || !Number.isFinite(state.width) || !Number.isFinite(state.height) || state.width < 1 || state.height < 1 || state.width > 16384 || state.height > 16384) return;
    const wasConnected = connected; connected = true;
    if (generation !== state.generation) {generation = state.generation;context.clearRect(0,0,canvas.width,canvas.height);$('menu').hidden = true;}
    if (canvas.width !== state.width || canvas.height !== state.height) {canvas.width = state.width;canvas.height = state.height;}
    $('mount').style.aspectRatio = `${state.width}/${state.height}`;$('mount').style.setProperty('--ratio', state.width/state.height);
    $('size').textContent = `${state.width} × ${state.height}`;$('title').textContent = state.title;document.title = `${state.title} | GL Lab`;
    document.documentElement.dataset.theme = state.theme === 'light' ? 'light' : 'dark';
    canvas.setAttribute('aria-label',`${state.title}. Click to focus for keyboard and mouse controls.`);
    $('status').textContent = state.status;$('stop').disabled = !state.active && !state.busy;
    $('console').textContent = state.console;$('placeholder').hidden = state.hasFrame;
    if (!wasConnected) requestFrame(0);
  } else if (data.type === 'frame' && data.blob instanceof Blob && data.generation === generation && !drawing) {
    drawing = true; const started = performance.now(), currentGeneration = generation;
    try {const image = await createImageBitmap(data.blob);if (connected && currentGeneration === generation) context.drawImage(image,0,0,canvas.width,canvas.height);image.close();} catch {$('status').textContent = 'Unable to display this frame. Return to the editor output.';}
    finally {drawing = false;requestFrame(Math.max(0,67-(performance.now()-started)));}
  } else if (data.type === 'no-frame' || data.type === 'frame') requestFrame(100);
  else if (data.type === 'menu' && data.menu && Array.isArray(data.menu.items)) showMenu(data.menu);
});
$('stop').addEventListener('click', () => send('stop'));
document.addEventListener('pointerdown', e => {if (!$('menu').contains(e.target) && e.target !== canvas) $('menu').hidden = true;});
window.addEventListener('pagehide', () => send('closed'));
window.addEventListener('pageshow', () => send('ready'));
setInterval(() => {if (!parent || parent.closed) disconnect();else send(connected?'heartbeat':'ready');},1000);
if (parent && session) send('ready');else disconnect('Open this output tab from the GL Lab editor.');
