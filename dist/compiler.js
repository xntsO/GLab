export class Compiler {
  constructor() {this.worker=null;this.pending=new Map();this.sequence=0;this.onProgress=()=>{};this.ready=false;this.initializing=null;}
  ensureWorker() {
    if(this.worker) return;
    this.worker=new Worker(new URL('./compiler-worker.js?v=2',import.meta.url));
    this.worker.onmessage=({data})=> {
      if(data.type==='progress') {this.onProgress(data.message);return;}
      const request=this.pending.get(data.id);
      if(!request)return;
      this.pending.delete(data.id);
      if(data.type==='error') {const e=new Error(data.diagnostics || data.message);e.diagnostics=data.diagnostics;e.compilerMessage=data.message;request.reject(e);}
      else request.resolve(data);
    };
    const worker=this.worker;
    this.worker.onerror=error=>{if(this.worker!==worker)return;for(const p of this.pending.values())p.reject(new Error(error.message || 'Compiler worker failed.'));this.pending.clear();this.stop();};
  }
  request(type,extra={}) {this.ensureWorker();const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({type,id,...extra});});}
  async init(onProgress=()=>{}) {
    this.onProgress=onProgress;
    if(this.ready)return this;
    if(this.initializing)return this.initializing;
    this.ensureWorker();
    const worker=this.worker;
    const task=this.request('init').then(()=>{if(this.worker===worker)this.ready=true;return this;}).catch(error=>{if(this.worker===worker)this.stop();throw error;}).finally(()=>{if(this.initializing===task)this.initializing=null;});
    this.initializing=task;
    return task;
  }
  async compile(source,{language='cpp'}={}) {if(!this.ready)await this.init(this.onProgress);return this.request('compile',{source,language});}
  stop() {this.worker?.terminate();this.worker=null;this.ready=false;this.initializing=null;for(const p of this.pending.values())p.reject(new Error('Compilation stopped.'));this.pending.clear();}
}
class ProgramExit extends Error {constructor(code){super(`Program exited with code ${code}.`);this.code=code;this.isProgramExit=true;}}
export function createWasiRuntime({stdout=()=>{},stdin='',onExit=()=>{}}={}) {
  let instance, inputOffset=0;
  const encoder=new TextEncoder(),decoders=new Map([[1,new TextDecoder()],[2,new TextDecoder()]]);
  const flushOutput=()=>{for(const decoder of decoders.values()){const remaining=decoder.decode();if(remaining)stdout(remaining);}};
  const input=encoder.encode(stdin);
  const view=()=>new DataView(instance.exports.memory.buffer);
  const bytes=()=>new Uint8Array(instance.exports.memory.buffer);
  const zero=(pointer,count=4)=>{bytes().fill(0,pointer,pointer+count);};
  const args=['playground'];
  const imports={
    args_sizes_get(argc,size){view().setUint32(argc,args.length,true);view().setUint32(size,11,true);return 0;},
    args_get(argv,buffer){view().setUint32(argv,buffer,true);bytes().set(encoder.encode('playground\0'),buffer);return 0;},
    environ_sizes_get(count,size){zero(count);zero(size);return 0;},environ_get(){return 0;},
    fd_write(fd,iovs,count,written){if(fd!==1&&fd!==2)return 8;let total=0;const decoder=decoders.get(fd);for(let i=0;i<count;i++){const p=view().getUint32(iovs+i*8,true),n=view().getUint32(iovs+i*8+4,true);const data=bytes().subarray(p,p+n);const text=decoder.decode(data,{stream:true});if(text)stdout(text);total+=n;}view().setUint32(written,total,true);return 0;},
    fd_read(fd,iovs,count,read){if(fd!==0)return 8;let total=0;for(let i=0;i<count;i++){const p=view().getUint32(iovs+i*8,true),n=view().getUint32(iovs+i*8+4,true);const available=Math.min(n,input.length-inputOffset);bytes().set(input.subarray(inputOffset,inputOffset+available),p);inputOffset+=available;total+=available;}view().setUint32(read,total,true);return 0;},
    fd_close(){return 0;},fd_seek(){return 29;},fd_fdstat_get(fd,out){zero(out,24);view().setUint8(out,fd<=2?2:4);return 0;},fd_fdstat_set_flags(){return 0;},
    fd_prestat_get(){return 8;},fd_prestat_dir_name(){return 8;},path_open(){return 44;},path_filestat_get(){return 44;},fd_filestat_get(fd,out){zero(out,64);return 0;},
    proc_exit(code){flushOutput();onExit(code);throw new ProgramExit(code);},
    random_get(pointer,length){const arr=bytes().subarray(pointer,pointer+length);for(let p=0;p<length;p+=65536)crypto.getRandomValues(arr.subarray(p,p+65536));return 0;},
    clock_time_get(clock,precision,out){view().setBigUint64(out,BigInt(Math.floor((clock===0?Date.now():performance.now())*1e6)),true);return 0;},
    clock_res_get(clock,out){view().setBigUint64(out,1000000n,true);return 0;},sched_yield(){return 0;},poll_oneoff(){return 52;},
  };
  return {imports,attach(value){instance=value;},ProgramExit};
}
export async function runProgram(wasm,graphics,{stdout=()=>{},stdin='',onExit=()=>{}}={}) {
  const wasi=createWasiRuntime({stdout,stdin,onExit});
  const module=await WebAssembly.compile(wasm);
  const env={...(graphics.imports.env || graphics.imports)};
  // GLUT owns the main loop. Suspend main before libc runs its exit handlers;
  // callbacks continue against the same Wasm memory and function table.
  if(env.glutMainLoop){const loop=env.glutMainLoop;env.glutMainLoop=(...args)=>{loop(...args);const yieldToBrowser=new Error('GLUT main loop is active.');yieldToBrowser.isProgramYield=true;throw yieldToBrowser;};}
  const imports={env,wasi_unstable:wasi.imports,wasi_snapshot_preview1:wasi.imports};
  for(const item of WebAssembly.Module.imports(module)){
    if(item.kind==='function'&&typeof imports[item.module]?.[item.name]!=='function')throw new Error(`Unsupported or unresolved function: ${item.name}. Check its spelling and use the supported GL, GLU, GLUT or C/C++ standard-library APIs.`);
  }
  const result=await WebAssembly.instantiate(module,imports);
  wasi.attach(result);graphics.attach(result);
  let exitCode=0,active=false;
  try {result.exports._start();} catch(error){if(error.isProgramYield){active=true;exitCode=null;}else if(error.isProgramExit)exitCode=error.code;else throw error;}
  return {instance:result,exitCode,active};
}
export class Runner {
  constructor(canvas,hooks={}) {this.canvas=canvas;this.hooks=hooks;this.worker=null;this.pending=new Map();this.sequence=0;this.transferred=false;}
  ensureWorker() {
    if(this.worker)return;
    if(this.transferred)throw new Error('Create a new Runner with a fresh canvas after Stop.');
    if(!this.canvas.transferControlToOffscreen)throw new Error('This browser needs OffscreenCanvas support. Use a current Chrome, Edge or Firefox.');
    this.worker=new Worker(new URL('./compiler-runtime-worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{
      if(data.type==='started'||data.type==='snapshot'||data.type==='error'){
        const p=this.pending.get(data.id);if(p){this.pending.delete(data.id);data.type==='error'?p.reject(new Error(data.message)):p.resolve(data.type==='snapshot'?data.blob:data);}
      }
      const key={stdout:'stdout',frame:'onFrame',error:'onError',diagnostic:'onDiagnostic',title:'onTitle',menu:'onMenu',exit:'onExit',resize:'onResize'}[data.type];
      if(key)this.hooks[key]?.(data.data ?? data.message ?? data.code);
    };
    this.worker.onerror=error=>{for(const p of this.pending.values())p.reject(new Error(error.message));this.pending.clear();this.hooks.onError?.(error.message);};
    const canvas=this.canvas.transferControlToOffscreen();this.transferred=true;
    this.worker.postMessage({type:'canvas',canvas,width:this.canvas.width,height:this.canvas.height},[canvas]);
  }
  run(wasm,{stdin=''}={}) {this.ensureWorker();const id=++this.sequence;const bytes=wasm.slice();return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({type:'run',id,wasm:bytes,stdin},[bytes.buffer]);});}
  snapshot() {if(!this.worker)return Promise.reject(new Error('Run a program before capturing the canvas.'));const id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({type:'snapshot',id});});}
  handleEvent(event) {this.worker?.postMessage({type:'event',event});}
  resize(width,height) {this.worker?.postMessage({type:'resize',width,height});}
  stop() {this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.reject(new Error('Program stopped.'));this.pending.clear();}
}
