import {createCompiler} from './emscripten/toolchain/compiler-client.js';
import {installGL4ES, gl4esLinkArguments} from './emscripten/runtime/build-gl4es.js';
import {installLegacyGL, legacyGLLinkArguments} from './emscripten/toolchain/legacy-gl.js?v=2';

const runtimeArgs = [
  '-sMODULARIZE=1', '-sEXPORT_NAME=GLLabModule', '-sINVOKE_RUN=0',
  '-sEXPORTED_RUNTIME_METHODS=["callMain","FS","Browser"]',
  '-sEXIT_RUNTIME=1', '-sENVIRONMENT=web', '-sALLOW_MEMORY_GROWTH=1',
  '-sASSERTIONS=1', '-sFILESYSTEM=1',
  '-sWASM=1', '-sEXPORT_ES6=0', '-sSINGLE_FILE=0', '-sSTANDALONE_WASM=0', '-sSIDE_MODULE=0', '-sMAIN_MODULE=0'
];
const compatibilityDirectory='/working/gl-lab-compat';
const compatibilityHeaders=[
  {path:compatibilityDirectory+'/windows.h',content:'#ifndef GL_LAB_WINDOWS_H\n#define GL_LAB_WINDOWS_H\n/* Include-only compatibility. Windows OS APIs are unavailable. */\n#endif\n'},
  ...['gl.h','Gl.h','glu.h','glut.h','freeglut.h'].map(name=>({path:compatibilityDirectory+'/gl/'+name,content:'#include <GL/'+(name==='Gl.h'?'gl.h':name)+'>\n'})),
  {path:compatibilityDirectory+'/GL/Gl.h',content:'#include <GL/gl.h>\n'},
  {path:compatibilityDirectory+'/GLUT/glut.h',content:'#include <GL/glut.h>\n'}
];

/** Compile the editor's original source with the browser Emscripten toolchain. */
export class Compiler {
  constructor() {
    this.ready=false; this.initializing=null; this.onProgress=()=>{};
    this.graphicsInstalled=false;
    this.lifetime=new AbortController();
    this.client=createCompiler({onLog:(text,stream)=>{
      if(stream==='status')this.onProgress(text);
    }});
  }
  async init(onProgress=()=>{}) {
    this.onProgress=onProgress;
    if(this.ready)return this;
    if(!this.initializing) {
      const task=this.client.initialize().then(async info=>{
        if(this.initializing!==task)throw new Error('Compilation stopped.');
        await this.client.writeFiles(compatibilityHeaders);
        if(this.initializing===task){this.ready=true;this.info=info;}
        return this;
      }).finally(()=>{if(this.initializing===task)this.initializing=null;});
      this.initializing=task;
    }
    return this.initializing;
  }
  async compile(source,{language='cpp',args=[]}={}) {
    if(typeof source!=='string')throw new Error('Source must be text.');
    if(!['c','cpp'].includes(language))throw new Error('Language must be C or C++.');
    if(!Array.isArray(args)||args.some(arg=>typeof arg!=='string'))throw new Error('Compiler arguments must be strings.');
    const started=performance.now();
    const signal=this.lifetime.signal;
    await this.init(this.onProgress);
    signal.throwIfAborted();
    const graphics=/#\s*include\s*[<"](?:GL\/|GLFW\/|GLUT\/|gl4es)|\b(?:glut|glfw|glBegin|initialize_gl4es)\w*\s*\(/i.test(source);
    if(graphics&&!this.graphicsInstalled) {
      await installGL4ES(this.client,{signal,onProgress:text=>this.onProgress(text)});
      await installLegacyGL(this.client,{signal,onProgress:text=>this.onProgress(text)});
      signal.throwIfAborted();
      this.graphicsInstalled=true;
    }
    // em++ must enable catching during both compilation and linking. The pinned
    // SDK ships the JS exception libraries; C keeps its existing configuration.
    const flags=['-O0',...(language==='cpp'?['-fexceptions']:[]),...args,'-I'+compatibilityDirectory,...(graphics?[...gl4esLinkArguments,...legacyGLLinkArguments]:[]),...runtimeArgs];
    const result=await this.client.compile({source,language,args:flags,basename:'visitor'});
    const diagnostics=[...result.stdout,...result.stderr].join('\n');
    if(result.exitCode!==0) {
      const error=new Error(diagnostics||'Emscripten compilation failed.');
      error.diagnostics=diagnostics;error.compilerMessage='Emscripten compilation failed.';
      error.command=result.command;throw error;
    }
    if(!result.files.some(file=>file.path==='visitor.js')||!result.files.some(file=>file.path==='visitor.wasm'))throw new Error('Emscripten did not emit the program JavaScript and WebAssembly.');
    const artifact={files:result.files,exportName:'GLLabModule',engine:'Emscripten/GL4ES'};
    return {artifact,wasm:artifact,diagnostics,elapsedMs:performance.now()-started,command:result.command,engine:artifact.engine,stats:result.stats};
  }
  stop() {
    this.lifetime.abort();this.lifetime=new AbortController();
    this.client.cancel();this.ready=false;this.initializing=null;this.graphicsInstalled=false;
  }
}
