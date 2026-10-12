import {sha256} from './digest.js';
function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value);
}

export async function inspectArtifact(files) {
  const wasm = files.find(file => /\.wasm$/.test(file.path));
  const js = files.find(file => /\.js$/.test(file.path));
  if (!wasm || !js) throw new Error('Compiler must emit both Emscripten JavaScript and WebAssembly.');
  const binary = bytes(wasm.bytes);
  const module = await WebAssembly.compile(binary);
  const imports = WebAssembly.Module.imports(module);
  return {
    jsPath: js.path, wasmPath: wasm.path,
    jsBytes: bytes(js.bytes).byteLength, wasmBytes: binary.byteLength,
    imports, exports: WebAssembly.Module.exports(module),
    importNamespaces: [...new Set(imports.map(entry => entry.module))],
    pureWasi: imports.length > 0 && imports.every(entry => ['wasi_snapshot_preview1','wasi_unstable'].includes(entry.module)),
    wasmSha256: await sha256(binary)
  };
}

/** Execute exactly the compiler's JavaScript and Wasm in a disposable opaque-origin frame. */
export async function runArtifact({files, exportName = 'GLLabModule', mount, timeoutMs = 30000, settleMs = 250, onStdout, onStderr, onExit, args = [], signal}) {
  if(signal?.aborted) throw new DOMException('Program stopped','AbortError');
  const abi = await inspectArtifact(files);
  if(signal?.aborted) throw new DOMException('Program stopped','AbortError');
  const iframe = document.createElement('iframe');
  iframe.title = 'Generated Emscripten program';
  iframe.setAttribute('sandbox','allow-scripts allow-pointer-lock');
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'width:100%;height:360px;border:0;background:#111';
  const target = mount || document.body.appendChild(document.createElement('div'));
  target.appendChild(iframe);
  const token = [...crypto.getRandomValues(new Uint32Array(4))].map(value=>value.toString(16)).join('-');
  const runnerUrl = new URL('./frame.js', import.meta.url).href;
  let disposed = false;
  let timer;
  let receive;
  let abort;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener('message', receive);
    signal?.removeEventListener('abort',abort);
    iframe.remove();
    if (!mount) target.remove();
  };
  const result = new Promise((resolve, reject) => {
    abort = () => {dispose(); reject(new DOMException('Program stopped','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    timer = setTimeout(() => {dispose(); reject(new Error(`Generated program timeout after ${timeoutMs}ms`));}, timeoutMs);
    receive = event => {
      if (event.source !== iframe.contentWindow || event.data?.token !== token) return;
      const data = event.data;
      if (data.type === 'ready') {
        iframe.contentWindow.postMessage({type: 'run', token, files: files.map(f => ({path:f.path, bytes:bytes(f.bytes)})), exportName, settleMs, args}, '*');
      } else if (data.type === 'stdout') onStdout?.(data.text);
      else if (data.type === 'stderr') onStderr?.(data.text);
      else if (data.type === 'exit') onExit?.(data.exitCode);
      else if (data.type === 'error') {
        const error = new Error(data.error);
        error.stdout = data.stdout;
        error.stderr = data.stderr;
        error.abi = abi;
        dispose();
        reject(error);
      } else if (data.type === 'result') {
        clearTimeout(timer);
        resolve({...data, abi, dispose, iframe});
      }
    };
    window.addEventListener('message', receive);
  });
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111;color:white}canvas{display:block;width:auto;height:auto;max-width:100%;max-height:100vh;margin:auto}</style></head><body><canvas id="canvas" role="img" aria-label="Program graphics canvas" tabindex="0" width="128" height="128"></canvas><script>window.acceptanceToken=${JSON.stringify(token)};window.acceptanceOrigin=${JSON.stringify(location.origin)};<\/script><script src="${runnerUrl}"><\/script></body></html>`;
  return result;
}
