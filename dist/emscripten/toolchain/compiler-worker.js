/* Adapter around the unmodified upstream distribution. All emcc work runs here. */
importScripts('./emception.worker.bundle.worker.js');
const channel = 'gl-lab-compiler';
let ready;
let queue = Promise.resolve();
let stdout = [];
let stderr = [];
let initializationDurationMs;
const engine = globalThis.emception;
/* Public packaging keeps every archive as .a.br. Upstream reads lazy archives
 * synchronously, so asynchronous DecompressionStream cannot be used here.
 * init() awaits root.pack.br unpacking through the same Brotli module before
 * constructing the compiler tools. That makes its synchronous exec() ready
 * before the first lazy archive read. Helper Wasm and root.pack.br requests
 * remain unchanged. The unmodified upstream loader receives original bytes. */
const NativeArchiveXHR = self.XMLHttpRequest;
let archiveTemporarySequence = 0;
self.XMLHttpRequest = class CompressedArchiveXHR extends NativeArchiveXHR {
  open(method, url, async = true, ...rest) {
    this.archiveURL = undefined;
    this.archiveBytes = undefined;
    if (method.toUpperCase() === 'GET' && async === false && /\.a(?:[?#]|$)/.test(String(url))) {
      this.archiveURL = String(url);
      url = String(url).replace(/\.a(?=[?#]|$)/, '.a.br');
    }
    return super.open(method, url, async, ...rest);
  }
  send(body) {
    super.send(body);
    if (!this.archiveURL || this.status < 200 || this.status >= 300) return;
    const compressed = new Uint8Array(super.response);
    // A host may advertise Content-Encoding: br and let XHR inflate it itself.
    const archiveMagic = [33, 60, 97, 114, 99, 104, 62, 10];
    if (archiveMagic.every((byte, index) => compressed[index] === byte)) {
      this.archiveBytes = compressed.buffer;
      return;
    }
    const filesystem = engine.fileSystem;
    const brotli = filesystem?._brotli;
    if (!filesystem || typeof brotli?.exec !== 'function') throw new Error('Brotli compiler helper is not initialized for ' + this.archiveURL);
    const temporary = `/tmp/public-archive-${++archiveTemporarySequence}.a`;
    const packed = temporary + '.br';
    try {
      filesystem.writeFile(packed, compressed);
      const result = brotli.exec(['brotli', '--decompress', packed], { cwd: '/tmp/' });
      if (result.returncode !== 0) throw new Error(`Cannot decompress ${this.archiveURL}: ${result.stderr || 'Brotli exit ' + result.returncode}`);
      const bytes = filesystem.readFile(temporary).slice();
      if (!archiveMagic.every((byte, index) => bytes[index] === byte)) throw new Error('Invalid decompressed archive ' + this.archiveURL);
      this.archiveBytes = bytes.buffer;
    } finally {
      if (filesystem.exists(packed)) filesystem.unlink(packed);
      if (filesystem.exists(temporary)) filesystem.unlink(temporary);
    }
  }
  get response() { return this.archiveBytes ?? super.response; }
};
function log(text, stream = 'status') {
  self.postMessage({ channel, event: 'log', text: String(text), stream });
}
engine.onstdout = (...parts) => {
  const text = parts.join(' ');
  stdout.push(text);
  log(text, 'stdout');
};
engine.onstderr = (...parts) => {
  const text = parts.join(' ');
  stderr.push(text);
  log(text, 'stderr');
};
engine.onprocessstart = argv => log(argv.join(' '), 'process');
async function initialize() {
  if (!ready) ready = (async () => {
    const started = performance.now();
    log('Loading the browser Emscripten tools and sysroot.');
    await engine.init();
    const fs = engine.fileSystem;
    fs.mkdirTree('/working');
    const version = fs.exists('/emscripten/emscripten-version.txt')
      ? fs.readFile('/emscripten/emscripten-version.txt', { encoding: 'utf8' }).trim() : 'unknown';
    log(`Browser Emscripten ${version} initialized.`);
    initializationDurationMs = performance.now() - started;
    return { version, driver: '/emscripten/emcc.py', sysroot: '/emscripten/cache/sysroot' };
  })();
  return ready;
}
async function compile({ source, language = 'cpp', args = [], flags, basename = 'visitor', files = [] } = {}) {
  if (typeof source !== 'string') throw new Error('source must be a string');
  if (!['c', 'cpp'].includes(language)) throw new Error('language must be c or cpp');
  if (!/^[a-zA-Z0-9_-]+$/.test(basename)) throw new Error('Invalid output basename');
  const options = flags || args;
  if (!Array.isArray(options) || options.some(arg => typeof arg !== 'string')) throw new Error('Compiler arguments must be strings');
  await initialize();
  const fs = engine.fileSystem;
  const directory = `/working/job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  fs.mkdirTree(directory);
  const input = `${directory}/input.${language === 'c' ? 'c' : 'cpp'}`;
  fs.writeFile(input, source);
  for (const file of files) {
    if (!file.path || file.path.startsWith('/') || file.path.split('/').includes('..')) throw new Error('Input file path must be relative');
    const path = `${directory}/${file.path}`;
    fs.mkdirTree(path.slice(0, path.lastIndexOf('/')));
    fs.writeFile(path, file.bytes || file.content);
  }
  stdout = [];
  stderr = [];
  log(`Compiling ${language === 'c' ? 'C' : 'C++'} visitor source.`, 'status');
  const command = [language === 'c' ? 'emcc' : 'em++', input, language === 'c' ? '-std=gnu11' : '-std=gnu++17', ...options, '-o', `${directory}/${basename}.js`];
  const result = await engine.run(...command);
  const exitCode = typeof result === 'number' ? result : result?.returncode ?? result?.exitCode ?? 1;
  const outputFiles = [];
  function collect(path, relative = '') {
    for (const name of fs.FS.readdir(path)) {
      if (name === '.' || name === '..' || (!relative && name.startsWith('input.'))) continue;
      const absolute = `${path}/${name}`;
      const output = relative ? `${relative}/${name}` : name;
      if (fs.FS.isDir(fs.FS.stat(absolute).mode)) collect(absolute, output);
      else outputFiles.push({ path: output, bytes: fs.readFile(absolute).slice() });
    }
  }
  collect(directory);
  removeDirectory(fs.FS, directory);
  return { exitCode, stdout: stdout.slice(), stderr: stderr.slice(), files: outputFiles, command, stats: stats() };
}
function removeDirectory(fs, path) {
  for (const name of fs.readdir(path)) {
    if (name === '.' || name === '..') continue;
    const child = `${path}/${name}`;
    if (fs.isDir(fs.stat(child).mode)) removeDirectory(fs, child);
    else fs.unlink(child);
  }
  fs.rmdir(path);
}
function stats() {
  const resources = performance.getEntriesByType('resource').map(entry => ({
    name: entry.name, encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize,
    durationMs: entry.duration
  }));
  const heapBytes = {};
  for (const [name, tool] of Object.entries(engine.tools)) {
    const bytes = tool?._module?.HEAPU8?.byteLength || tool?.module?.HEAP8?.byteLength || tool?.Module?.HEAP8?.byteLength || tool?.HEAP8?.byteLength;
    if (bytes) heapBytes[name] = bytes;
  }
  const filesystemHeapBytes = engine.fileSystem?._module?.HEAPU8?.byteLength;
  if (filesystemHeapBytes) heapBytes.filesystem = filesystemHeapBytes;
  return {
    initializationDurationMs, resources, heapBytes,
    encodedBodyBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0)
  };
}
async function writeFiles(files) {
  await initialize();
  const fs = engine.fileSystem;
  for (const file of files) {
    if (typeof file.path !== 'string' || !file.path.startsWith('/working/') || file.path.split('/').includes('..')) throw new Error('writeFiles paths must be beneath /working/');
    fs.mkdirTree(file.path.slice(0, file.path.lastIndexOf('/')));
    fs.writeFile(file.path, file.bytes ?? file.content);
  }
  return { count: files.length };
}
async function runCommand(argv) {
  if (!Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string')) throw new Error('Command arguments must be strings');
  if (!['emcc', 'em++', 'emar', 'emranlib'].includes(argv[0])) throw new Error('Unsupported Emscripten driver');
  await initialize();
  stdout = [];
  stderr = [];
  const result = await engine.run(...argv);
  return {
    exitCode: typeof result === 'number' ? result : result?.returncode ?? result?.exitCode ?? 1,
    stdout: stdout.slice(), stderr: stderr.slice(), stats: stats()
  };
}
self.addEventListener('message', ({ data }) => {
  if (data.channel !== channel) return;
  queue = queue.then(async () => {
    try {
      let result;
      if (data.action === 'initialize') result = await initialize();
      else if (data.action === 'compile') result = await compile(data.options);
      else if (data.action === 'writeFiles') result = await writeFiles(data.options.files);
      else if (data.action === 'runCommand') result = await runCommand(data.options.argv);
      else if (data.action === 'stats') result = stats();
      else if (data.action === 'readFile') {
        await initialize();
        result = engine.fileSystem.readFile(data.options.path).slice();
      } else throw new Error(`Unknown compiler action ${data.action}`);
      const transfer = result?.files?.map(file => file.bytes.buffer) || [];
      self.postMessage({ channel, id: data.id, result }, transfer);
    } catch (error) {
      self.postMessage({ channel, id: data.id, error: error.stack || String(error) });
    }
  }).catch(error => {
    self.postMessage({ channel, id: data.id, error: error.stack || String(error) });
  });
});
