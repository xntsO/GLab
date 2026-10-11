/* Clang/LLD run entirely inside this worker. The source never leaves the browser. */
importScripts('./vendor/compiler/shared.js', './vendor/compiler/header.js?v=5');
let api, diagnostics = '';
const cache = new Map();
const clean = text => text.replace(/\x1b\[[0-9;]*m/g, '');
async function asset(name) {
  if (cache.has(name)) return cache.get(name);
  const promise = (async () => {
    self.postMessage({type:'progress',message:`Loading ${name === 'sysroot.tar' ? 'C/C++ standard library' : name}…`});
    const response = await fetch(new URL(`./vendor/compiler/${name}.gz`, self.location.href));
    if (!response.ok) throw new Error(`Compiler download failed (${response.status}, ${name}).`);
    const buffer=await response.arrayBuffer();
    const signature=new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
    // Some static hosts set Content-Encoding: gzip, which fetch decompresses
    // automatically. Decompress only when the downloaded bytes are still gzip.
    if(signature[0]!==0x1f||signature[1]!==0x8b)return buffer;
    if (!self.DecompressionStream) throw new Error('This browser needs DecompressionStream support to load the compiler. Use a current Chrome, Edge, Firefox or Safari.');
    return await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  })();
  cache.set(name,promise);
  return promise;
}
async function initialize() {
  if (api) return api.ready;
  api = new API({
    readBuffer:asset,
    compileStreaming:async name => WebAssembly.compile(await asset(name)),
    hostWrite:text => { diagnostics += clean(text); },
    clang:'clang',lld:'lld',memfs:'memfs',sysroot:'sysroot.tar'
  });
  await api.ready;
  api.memfs.addDirectory('include/GL');
  api.memfs.addDirectory('include/GLUT');
  api.memfs.addDirectory('include/gl');
  for(const directory of ['GL','gl'])for(const name of ['gl.h','Gl.h','glu.h','glut.h','freeglut.h']) api.memfs.addFile('include/'+directory+'/'+name,PLAYGROUND_GLUT_HEADER);
  api.memfs.addFile('include/GLUT/glut.h',PLAYGROUND_GLUT_HEADER);
  api.memfs.addDirectory('include/GLFW');
  api.memfs.addFile('include/GLFW/glfw3.h',PLAYGROUND_GLFW_HEADER);
  api.memfs.addFile('include/emscripten.h',PLAYGROUND_EMSCRIPTEN_HEADER);
  api.memfs.addDirectory('include/emscripten');
  api.memfs.addFile('include/emscripten/emscripten.h',PLAYGROUND_EMSCRIPTEN_HEADER);
  // Legacy lab programs often include windows.h before GLUT. This empty
  // compatibility header permits that include without exposing Windows APIs.
  api.memfs.addFile('include/windows.h','#ifndef PLAYGROUND_WINDOWS_H\n#define PLAYGROUND_WINDOWS_H\n/* Include-only compatibility stub. Windows OS APIs are unavailable. */\n#endif\n');
  await Promise.all([api.getModule('clang'),api.getModule('lld')]);
  // Full commands belong in debug tools. Report actual clang diagnostics to the editor.
  api.hostLog = () => {};
  self.postMessage({type:'progress',message:'Compiler ready. Clang 8.0.1 · C++17 · C11'});
}
async function compile(source,language) {
  await initialize();
  diagnostics = '';
  const started = performance.now();
  const cpp = language !== 'c';
  const input = cpp ? 'playground.cpp' : 'playground.c';
  api.memfs.addFile(input,new TextEncoder().encode(source));
  self.postMessage({type:'progress',message:'Compiling '+(cpp?'C++17':'C11')+'…'});
  await api.run(await api.getModule('clang'),'clang','-cc1','-emit-obj',
    ...api.clangCommonArgs.filter(x=>x!=='-fcolor-diagnostics'),'-triple','wasm32-unknown-wasi',
    '-O1',cpp?'-std=c++17':'-std=c11','-o','playground.o','-x',cpp?'c++':'c',input);
  self.postMessage({type:'progress',message:'Linking WebAssembly…'});
  await api.run(await api.getModule('lld'),'wasm-ld','--no-threads','--export-dynamic','--export-table',
    '--allow-undefined','-z','stack-size=1048576','-Llib/wasm32-wasi',
    'lib/wasm32-wasi/crt1.o','playground.o','-lc',...(cpp?['-lc++','-lc++abi']:[]),
    'lib/clang/8.0.1/lib/wasi/libclang_rt.builtins-wasm32.a','-o','playground.wasm');
  const wasm = api.memfs.getFileContents('playground.wasm').slice();
  if (!WebAssembly.validate(wasm)) throw new Error('The linker produced invalid WebAssembly.');
  return {wasm,diagnostics:diagnostics.trim(),elapsedMs:performance.now()-started};
}
let busy = false;
self.onmessage = async ({data}) => {
  if (busy) { self.postMessage({type:'error',id:data.id,message:'Compiler is busy.'}); return; }
  busy = true;
  try {
    if(data.type === 'init') {await initialize(); self.postMessage({type:'ready',id:data.id});}
    if(data.type === 'compile') {
      const result=await compile(data.source,data.language);
      self.postMessage({type:'compiled',id:data.id,...result},[result.wasm.buffer]);
    }
  } catch(error) {
    if(data.type==='init'){api=null;cache.clear();}
    self.postMessage({type:'error',id:data.id,message:clean(error.message || String(error)),diagnostics:diagnostics.trim()});
  } finally {busy=false;}
};


