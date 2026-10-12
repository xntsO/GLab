/** Real browser-side Emscripten, using the vendored upstream Emception worker. */
export function createCompiler({ onLog = () => {} } = {}) {
  let worker;
  let sequence = 0;
  let initialization;
  const pending = new Map();
  const compiler = {
    info: { implementation: 'jprendes/emception', execution: 'browser WebAssembly' },
    initialize() {
      if (!initialization) initialization = request('initialize').then(info => {
        Object.assign(compiler.info, info);
        return compiler.info;
      });
      return initialization;
    },
    async compile(options) {
      await compiler.initialize();
      return request('compile', options);
    },
    async readFile(path) {
      await compiler.initialize();
      return request('readFile', { path });
    },
    async writeFiles(files) {
      await compiler.initialize();
      return request('writeFiles', { files });
    },
    async runCommand(argv) {
      await compiler.initialize();
      return request('runCommand', { argv });
    },
    async stats() {
      await compiler.initialize();
      return request('stats');
    },
    cancel() {
      if (worker) worker.terminate();
      worker = undefined;
      initialization = undefined;
      for (const promise of pending.values()) promise.reject(new Error('Compiler worker cancelled'));
      pending.clear();
    },
    dispose() { compiler.cancel(); }
  };
  function request(action, options) {
    if (!worker) {
      worker = new Worker(new URL('./compiler-worker.js', import.meta.url));
      worker.onmessage = ({ data }) => {
        if (data.channel !== 'gl-lab-compiler') return;
        if (data.event === 'log') { onLog(data.text, data.stream); return; }
        const promise = pending.get(data.id);
        if (!promise) return;
        pending.delete(data.id);
        if (data.error) promise.reject(new Error(data.error));
        else promise.resolve(data.result);
      };
      worker.onerror = event => {
        const error = new Error(event.message || 'Compiler worker failed');
        for (const promise of pending.values()) promise.reject(error);
        pending.clear();
        worker.terminate();
        worker = undefined;
        initialization = undefined;
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      worker.postMessage({ channel: 'gl-lab-compiler', id, action, options });
    });
  }
  return compiler;
}
