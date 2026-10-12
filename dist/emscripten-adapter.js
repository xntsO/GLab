export {Compiler} from './emscripten-compiler.js';

/** Keep the established GL Lab canvas and controls around a real Emscripten module. */
export class Runner {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.frame = null;
    this.pending = new Map();
    this.context = canvas.getContext('2d');
  }

  run(artifact, {stdin = ''} = {}) {
    this.stop();
    if (!Array.isArray(artifact?.files)) return Promise.reject(new Error('The compiler must return Emscripten JavaScript and WebAssembly output files.'));
    this.token = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');
    const frame = document.createElement('iframe');
    this.frame = frame;
    frame.title = 'Isolated C/C++ program runtime';
    frame.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // Keep a real DOM canvas for Emscripten's upstream GLUT/GLFW libraries.
    // The original visible canvas receives its pixels and retains every UI hook.
    // Chromium throttles requestAnimationFrame in offscreen cross-origin frames.
    // Keep its geometry in the viewport, transparent beneath the application.
    frame.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;max-width:100vw;max-height:100vh;opacity:0;z-index:-1;border:0;pointer-events:none';
    const runtimeUrl = new URL('./emscripten/runtime/program-frame.js', import.meta.url).href;
    this.receive = event => {
      if (event.source !== frame.contentWindow || event.data?.token !== this.token) return;
      const data = event.data;
      if (data.type === 'ready') {
        this.post({type: 'run', files: artifact.files, exportName: artifact.exportName || 'GLLabModule', stdin, width: this.canvas.width, height: this.canvas.height});
      } else if (data.type === 'started') {
        clearTimeout(this.startTimer);
        const pending = this.pending.get('run');
        this.pending.delete('run');
        pending?.resolve(data);
      } else if (data.type === 'frame') {
        try {
          if (this.canvas.width !== data.width || this.canvas.height !== data.height) {
            this.canvas.width = data.width;
            this.canvas.height = data.height;
            this.hooks.onResize?.({width: data.width, height: data.height});
          }
          this.context.drawImage(data.bitmap, 0, 0);
          this.hooks.onFrame?.(data.stats);
        } finally {
          data.bitmap?.close();
          this.post({type: 'frameAck'});
        }
      } else if (data.type === 'error') {
        clearTimeout(this.startTimer);
        const pending = this.pending.get('run');
        this.pending.delete('run');
        if (pending) pending.reject(new Error(data.message));
        else this.hooks.onError?.(data.message);
      } else {
        const hook = {stdout:'stdout', diagnostic:'onDiagnostic', title:'onTitle', menu:'onMenu', exit:'onExit', resize:'onResize', loopEnd:'onLoopEnd'}[data.type];
        if (hook) this.hooks[hook]?.(data.data ?? data.code);
      }
    };
    window.addEventListener('message', this.receive);
    const result = new Promise((resolve, reject) => {
      this.pending.set('run', {resolve, reject});
      this.startTimer = setTimeout(() => {
        const pending = this.pending.get('run');
        this.pending.delete('run');
        this.stop();
        pending?.reject(new Error('The Emscripten program did not start within 30 seconds.'));
      }, 30000);
    });
    const config = JSON.stringify({token: this.token, origin: location.origin}).replace(/</g, '\\u003c');
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}canvas{display:block}</style><canvas id="canvas" tabindex="0" width="${this.canvas.width}" height="${this.canvas.height}"></canvas><script>window.gllabFrame=${config};<\/script><script src="${runtimeUrl}"><\/script>`;
    document.body.append(frame);
    return result;
  }

  post(message) { this.frame?.contentWindow?.postMessage({...message, token: this.token}, '*'); }
  handleEvent(event) { this.post({type: 'event', event}); }
  resize(width, height) { this.post({type: 'resize', width, height}); }
  snapshot() {
    if (!this.frame) return Promise.reject(new Error('Run a program before capturing the canvas.'));
    return new Promise((resolve, reject) => this.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas capture failed.')), 'image/png'));
  }
  stop() {
    clearTimeout(this.startTimer);
    if (this.receive) window.removeEventListener('message', this.receive);
    this.receive = null;
    this.frame?.remove();
    this.frame = null;
    for (const pending of this.pending.values()) pending.reject(new Error('Program stopped.'));
    this.pending.clear();
  }
}
