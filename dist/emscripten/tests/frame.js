const token = window.acceptanceToken;
const send = (type, value = {}) => parent.postMessage({token, type, ...value}, window.acceptanceOrigin);
let stdout = '', stderr = '', exitCode = null;
let lastCapture = null;
let module;
const canvas = document.getElementById('canvas');
const nativeGetContext = canvas.getContext.bind(canvas);
let graphicsContext = null;
canvas.getContext = (type,attributes) => {
  const context = nativeGetContext(type,attributes);
  if(context && ['webgl','webgl2','experimental-webgl'].includes(type)) graphicsContext=context;
  return context;
};
window.__acceptanceCapture = () => {
  const context = graphicsContext;
  if (!context) return null;
  const pixel = new Uint8Array(4);
  context.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
  lastCapture = {width: canvas.width, height: canvas.height, center: [...pixel], pngDataUrl: canvas.toDataURL('image/png')};
  return lastCapture;
};
window.addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== window.acceptanceOrigin || event.data?.token !== token || event.data.type !== 'run') return;
  const {files, exportName, settleMs, args} = event.data;
  const urls = [];
  try {
    const jsFile = files.find(file => /\.js$/.test(file.path));
    const wasmFile = files.find(file => /\.wasm$/.test(file.path));
    const scriptUrl = URL.createObjectURL(new Blob([jsFile.bytes], {type: 'text/javascript'}));
    urls.push(scriptUrl);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load emitted Emscripten JavaScript'));
      document.body.append(script);
    });
    const factory = window[exportName];
    if (typeof factory !== 'function') throw new Error(`Emitted JavaScript did not expose ${exportName} factory`);
    module = await factory({
      canvas, wasmBinary: wasmFile.bytes, noInitialRun: true,
      print: (...values) => {const text = values.join(' ') + '\n'; stdout += text; send('stdout', {text});},
      printErr: (...values) => {const text = values.join(' ') + '\n'; stderr += text; send('stderr', {text});},
      onExit: code => {exitCode = code; send('exit', {exitCode});},
      onAbort: reason => {stderr += String(reason) + '\n';},
      locateFile: path => {
        const file = files.find(f => f.path.split('/').at(-1) === path.split('/').at(-1));
        if (!file) throw new Error(`Missing compiler output dependency ${path}`);
        const url = URL.createObjectURL(new Blob([file.bytes]));
        urls.push(url);
        return url;
      }
    });
    if (typeof module.callMain !== 'function') throw new Error('Actual Emscripten module has no exported callMain runtime API');
    let mainReturned = false;
    try {
      module.callMain(args);
      mainReturned = true;
    } catch (error) {
      if (error === 'unwind') {/* Emscripten main loop intentionally remains active. */}
      else if (error?.name === 'ExitStatus') {exitCode = error.status; mainReturned = true;}
      else throw error;
    }
    await new Promise(resolve => setTimeout(resolve, settleMs));
    if (!lastCapture) window.__acceptanceCapture();
    const isolation={parentDocumentAccessible:false,localStorageAccessible:false};
    try {isolation.parentDocumentAccessible=!!parent.document;} catch {}
    try {isolation.localStorageAccessible=!!window.localStorage;} catch {}
    const runtime = {callMain: typeof module.callMain, heapU8: module.HEAPU8 instanceof Uint8Array, heapBytes: module.HEAPU8?.length ?? null, FS: typeof module.FS, exitStatus: module.EXITSTATUS ?? null, factory: exportName,isolation};
    send('result', {stdout, stderr, exitCode, mainReturned, active: exitCode === null, runtime, pixels: lastCapture && {width:lastCapture.width,height:lastCapture.height,center:lastCapture.center}, pngDataUrl:lastCapture?.pngDataUrl ?? null});
  } catch (error) {
    send('error', {error: error?.stack || String(error), stdout, stderr});
  } finally {
    for (const url of urls) URL.revokeObjectURL(url);
  }
});
send('ready');
