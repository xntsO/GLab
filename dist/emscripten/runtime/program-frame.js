/* This classic script runs only inside a disposable, opaque-origin sandbox. */
const {token, origin} = window.gllabFrame;
const send = (type, data, transfer = []) => parent.postMessage({token, type, ...data}, origin, transfer);
const canvas = document.getElementById('canvas');
let module, graphicsContext, running = false, framePending = false, lastFrame = 0;
let frames = 0, lastWidth = canvas.width, lastHeight = canvas.height, lastTitle = document.title;
let exitSent = false, lastExitCode = null, glutLoop = false, hadBrowserLoop = false, terminalFrameCaptured = false;
const urls = [];
const nativeGetContext = canvas.getContext.bind(canvas);
canvas.getContext = (type, attributes) => {
  const webgl = ['webgl', 'webgl2', 'experimental-webgl'].includes(type);
  const context = nativeGetContext(type, webgl ? {...attributes, preserveDrawingBuffer: true} : attributes);
  if (context && webgl) graphicsContext = context;
  return context;
};

function exit(code) {
  running = false;
  // Native main-loop cancellation may invoke onExit with no status argument.
  lastExitCode = Number.isInteger(code) ? code : 0;
  if (exitSent) return;
  exitSent = true;
  send('exit', {code:lastExitCode});
}

function reportError(error) {
  running = false;
  send('error', {message: error?.stack || String(error)});
}

async function capture(time) {
  requestAnimationFrame(capture);
  if (running && hadBrowserLoop && !module?.Browser?.mainLoop?.func) {
    running = false;
    send('loopEnd', {data:{reason:'Browser main loop ended.'}});
  }
  if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
    lastWidth = canvas.width;
    lastHeight = canvas.height;
    send('resize', {data: {width: lastWidth, height: lastHeight}});
  }
  if (document.title && document.title !== lastTitle) {
    lastTitle = document.title;
    send('title', {data: lastTitle});
  }
  if (!graphicsContext || framePending || (!running && terminalFrameCaptured) || time - lastFrame < 32 || !canvas.width || !canvas.height) return;
  framePending = true;
  lastFrame = time;
  try {
    const bitmap = await createImageBitmap(canvas);
    if (!running) terminalFrameCaptured = true;
    send('frame', {bitmap, width: canvas.width, height: canvas.height, stats: {frames: ++frames, time, active:running}}, [bitmap]);
  } catch (error) { framePending = false; reportError(error); }
}

function forwardInput(event) {
  if (typeof module?.gllabInput === 'function' && module.gllabInput(event)) return;
  const modifiers = {shiftKey: !!(event.modifiers & 1), ctrlKey: !!(event.modifiers & 2), altKey: !!(event.modifiers & 4)};
  if (['keydown', 'keyup'].includes(event.type)) {
    const keyCodes = {ArrowLeft:37, ArrowUp:38, ArrowRight:39, ArrowDown:40, Escape:27, Enter:13, Tab:9, Backspace:8, Delete:46, Home:36, End:35, PageUp:33, PageDown:34, Insert:45, ';':186, ':':186, '=':187, '+':187, ',':188, '<':188, '-':189, '_':189, '.':190, '>':190, '/':191, '?':191, '`':192, '~':192, '[':219, '{':219, '\\':220, '|':220, ']':221, '}':221, "'":222, '"':222};
    const key = event.key || '';
    const keyCode = keyCodes[key] || (/^F\d+$/.test(key) ? 111 + Number(key.slice(1)) : key.toUpperCase().charCodeAt(0));
    canvas.dispatchEvent(new KeyboardEvent(event.type, {key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, keyCode, which: keyCode, charCode: key.length === 1 ? key.charCodeAt(0) : 0, bubbles: true, cancelable: true, ...modifiers}));
    if (event.type === 'keydown' && key.length === 1) canvas.dispatchEvent(new KeyboardEvent('keypress', {key, keyCode:key.charCodeAt(0), which:key.charCodeAt(0), charCode:key.charCodeAt(0), bubbles:true, ...modifiers}));
  } else if (['mouse', 'motion', 'passive', 'wheel'].includes(event.type)) {
    const rect = canvas.getBoundingClientRect();
    const options = {clientX: rect.left + event.x * rect.width / canvas.width, clientY: rect.top + event.y * rect.height / canvas.height, button:event.button || 0, buttons:event.type === 'motion' ? 1 : event.type === 'mouse' && event.state === 0 ? [1,4,2][event.button || 0] : 0, bubbles:true, cancelable:true, ...modifiers};
    const type = event.type === 'mouse' ? event.state === 0 ? 'mousedown' : 'mouseup' : event.type === 'wheel' ? 'wheel' : 'mousemove';
    canvas.dispatchEvent(type === 'wheel' ? new WheelEvent(type, {...options, deltaY:event.deltaY || 0}) : new MouseEvent(type, options));
  }
}

window.addEventListener('error', event => reportError(event.error || event.message));
window.addEventListener('unhandledrejection', event => reportError(event.reason));
window.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
window.addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== origin || event.data?.token !== token) return;
  const data = event.data;
  if (data.type === 'frameAck') {framePending = false; return;}
  if (data.type === 'event') {try {forwardInput(data.event);} catch (error) {reportError(error);} return;}
  if (data.type === 'resize') {
    canvas.width = Math.max(1, Math.min(8192, Math.floor(data.width)));
    canvas.height = Math.max(1, Math.min(8192, Math.floor(data.height)));
    window.dispatchEvent(new Event('resize'));
    return;
  }
  if (data.type !== 'run' || module) return;
  try {
    const {files, exportName, stdin} = data;
    const javascript = files.find(file => /\.js$/.test(file.path));
    const wasm = files.find(file => /\.wasm$/.test(file.path));
    if (!javascript || !wasm) throw new Error('Missing emitted Emscripten JavaScript or WebAssembly.');
    const input = new TextEncoder().encode(stdin || '');
    let inputOffset = 0;
    const scriptUrl = URL.createObjectURL(new Blob([javascript.bytes], {type:'text/javascript'}));
    urls.push(scriptUrl);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load emitted Emscripten JavaScript.'));
      document.body.append(script);
    });
    const factory = window[exportName];
    if (typeof factory !== 'function') throw new Error(`The emitted program has no ${exportName} factory.`);
    module = await factory({
      canvas, wasmBinary: wasm.bytes, noInitialRun:true,
      stdin: () => inputOffset < input.length ? input[inputOffset++] : null,
      print: (...values) => send('stdout', {data:values.join(' ') + '\n'}),
      printErr: (...values) => send('stdout', {data:values.join(' ') + '\n'}),
      onExit: exit,
      onAbort: reason => reportError(new Error(String(reason))),
      gllabEvent: (type, value) => {
        if (type === 'loopStart') {glutLoop = true; running = true;}
        if (type === 'loopEnd') {glutLoop = false; running = false;}
        send(type, {data:value});
      },
      locateFile: path => {
        const file = files.find(file => file.path.split('/').at(-1) === path.split('/').at(-1));
        if (!file) throw new Error(`Missing compiler output dependency ${path}.`);
        const url = URL.createObjectURL(new Blob([file.bytes]));
        urls.push(url);
        return url;
      }
    });
    if (typeof module.callMain !== 'function') throw new Error('Emscripten callMain runtime API was not exported.');
    requestAnimationFrame(capture);
    running = true;
    let code = null;
    try {
      module.callMain([]);
      hadBrowserLoop = !!module.Browser?.mainLoop?.func;
      running = !exitSent && (glutLoop || hadBrowserLoop);
      if (!running) code = lastExitCode ?? module.EXITSTATUS ?? 0;
    }
    catch (error) {
      if (error === 'unwind') running = !exitSent;
      else if (error?.name === 'ExitStatus') {running = false; code = error.status;}
      else throw error;
    }
    hadBrowserLoop = !!module.Browser?.mainLoop?.func;
    if (!running && code === null) code = lastExitCode ?? module.EXITSTATUS ?? 0;
    send('started', {active:running, exitCode:running ? null : code, runtime:{factory:exportName, callMain:typeof module.callMain, heapBytes:module.HEAPU8?.byteLength, FS:typeof module.FS, isolation:'opaque-origin sandbox'}});
  } catch (error) {reportError(error);}
});
send('ready');
