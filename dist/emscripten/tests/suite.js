import {runArtifact} from './runner.js';
import {baseArgs,stdioCase,cppCase,webglCase,glfwCase,gl4esCase} from './cases.js';
import {sha256} from './digest.js';
const $ = id => document.getElementById(id);
const assert = (condition, message) => {if (!condition) throw new Error(message);};
const log = value => { $('state').textContent = value; $('log').textContent += value + '\n'; };
const hash = source => sha256(new TextEncoder().encode(source));
const diagnosticText=value=>Array.isArray(value)?value.join('\n'):String(value??'');

export async function runAcceptance({adapterUrl = $('adapter').value, graphics = true, gl4esArgs = null, only = null} = {}) {
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0];
  const seed = nonce % 4000 + 100;
  const report = {schema:1, acceptance:'fresh source compiled by browser Emscripten and executed through emitted JS/Wasm', scope:only==='gl4es'?'targeted GL4ES rerun':graphics?'full compiler and graphics suite':'compiler and stdio suite', started:new Date().toISOString(),nonce,seed,adapterUrl,userAgent:navigator.userAgent,environment:{url:location.href,secureContext:isSecureContext,crossOriginIsolated,SharedArrayBuffer:typeof SharedArrayBuffer,wasm:typeof WebAssembly},compilerInfo:null,tests:[]};
  window.emscriptenAcceptanceReport = report;
  $('results').textContent = JSON.stringify(report,null,2);
  const publish = () => {
    report.finished = new Date().toISOString();
    report.pass = report.tests.length > 0 && report.tests.every(test=>test.status==='pass');
    report.summary = {passed:report.tests.filter(t=>t.status==='pass').length,failed:report.tests.filter(t=>t.status==='fail').length,blocked:report.tests.filter(t=>t.status==='blocked').length};
    report.resources = performance.getEntriesByType('resource').map(entry=>({url:entry.name,encodedBytes:entry.encodedBodySize,durationMs:entry.duration}));
    $('results').textContent = JSON.stringify(report,null,2);
    $('download').href = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    $('download').download = 'emscripten-browser-acceptance.json'; $('download').hidden = false;
    log(`Finished. ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.blocked} blocked.`);
    return report;
  };
  const check = async (name, fn) => {
    const started = performance.now();
    try {const evidence = await fn(); report.tests.push({name,status:'pass',elapsedMs:performance.now()-started,...evidence}); log(`PASS ${name}`); return evidence;}
    catch(error) {report.tests.push({name,status:'fail',elapsedMs:performance.now()-started,error:error.stack||String(error),stdout:error.stdout,stderr:error.stderr,...error.evidence}); log(`FAIL ${name}: ${error.message}`); return null;}
    finally {$('results').textContent = JSON.stringify(report,null,2);}
  };
  let compiler;
  try {
    assert(only===null || only==='gl4es','Unknown targeted selection; only gl4es is supported');
    log('Loading actual Emscripten browser compiler.');
    const adapter = await import(new URL(adapterUrl,location.href).href);
    compiler = await adapter.createCompiler({onLog:log});
    if(compiler.initialize) await compiler.initialize();
    report.compilerInfo = compiler.info ?? null;
    const compile = async (testCase, name) => {
      const started = performance.now();
      const request = {source:testCase.source,language:testCase.language,args:[...baseArgs,testCase.language==='c'?'-std=gnu11':'-std=gnu++17',...(testCase.args||[])],basename:name};
      log(`Compiling ${name}`);
      const artifact = await compiler.compile(request);
      const evidence = {source:request.source,sourceSha256:await hash(request.source),language:request.language,args:request.args,compileMs:performance.now()-started,compileExitCode:artifact.exitCode,compileStdout:diagnosticText(artifact.stdout),compileStderr:diagnosticText(artifact.stderr),command:artifact.command??null};
      if (artifact.exitCode !== 0) {const error = new Error(`emcc exited ${artifact.exitCode}: ${artifact.stderr || artifact.stdout}`); error.stdout = artifact.stdout; error.stderr = artifact.stderr; error.evidence=evidence; throw error;}
      assert(Array.isArray(artifact.files),'Adapter did not return compiler output files');
      return {artifact,evidence};
    };
    const execute = async (testCase, name) => {
      const {artifact,evidence} = await compile(testCase,name);
      let run;
      try {
        run = await runArtifact({files:artifact.files,exportName:'AcceptanceModule',mount:$('live'),timeoutMs:30000,settleMs:100});
        assert(run.exitCode === 0,`Emitted program exit=${run.exitCode}; stdout=${run.stdout}; stderr=${run.stderr}`);
        assert(run.stdout.includes(testCase.expected),`Fresh source output missing ${testCase.expected}: ${run.stdout}`);
        assert(run.runtime.callMain === 'function' && run.runtime.heapU8,'Missing actual Emscripten runtime APIs');
        assert(!run.abi.pureWasi,'Artifact imports only WASI; actual Emscripten ABI required');
        if(testCase.expectedEmAsm) assert(run.stdout.includes(testCase.expectedEmAsm),'EM_ASM did not execute inside emitted Emscripten JavaScript');
        if(testCase.expectedStderr) assert(run.stderr.includes(testCase.expectedStderr),'stderr was lost');
        if(testCase.emscriptenVersion) {
          const version=run.stdout.match(/emcc=(\d+\.\d+\.\d+);clock=1/);
          assert(version,'Emscripten version macros or emscripten_get_now failed');
          const driverVersion=String(compiler.info?.version??'').match(/\d+\.\d+\.\d+/)?.[0];
          if(driverVersion) assert(version[1]===driverVersion,`Header target version ${version[1]} differs from driver ${driverVersion}`);
        }
        if(testCase.color) {
          assert(run.stdout.includes('error=0'),`OpenGL error: ${run.stdout}`);
          const cPixel=run.stdout.match(/pixel=(\d+),(\d+),(\d+),(\d+)/)?.slice(1).map(Number);
          assert(cPixel && cPixel.slice(0,3).every((x,index)=>Math.abs(x-testCase.color[index])<=1),`Incorrect C glReadPixels result: ${run.stdout}`);
          assert(run.pixels,'No browser WebGL pixel readback');
          assert(run.pixels.center.slice(0,3).every((x,index)=>Math.abs(x-testCase.color[index]) <= 1),`Incorrect browser pixel ${run.pixels.center}; expected ${testCase.color}`);
          assert(cPixel.every((x,index)=>Math.abs(x-run.pixels.center[index])<=1),'C and browser pixel readbacks disagree');
          const figure=document.createElement('figure'),image=new Image(),caption=document.createElement('figcaption');image.src=run.pngDataUrl;image.alt=name;caption.textContent=name;figure.append(image,caption);$('gallery').append(figure);
        }
        return {...evidence,stdout:run.stdout,stderr:run.stderr,exitCode:run.exitCode,abi:run.abi,runtime:run.runtime,pixels:run.pixels,pngDataUrl:run.pngDataUrl};
      } catch(error) {
        error.evidence={...evidence,stdout:run?.stdout??error.stdout,stderr:run?.stderr??error.stderr,abi:run?.abi??error.abi,pixels:run?.pixels};
        throw error;
      } finally {run?.dispose();}
    };
    if(only!=='gl4es') {
    const a = await check('fresh C stdio, filesystem and Emscripten APIs',()=>execute(stdioCase(seed),'fresh-c-a'));
    await check('changed C source produces changed Wasm and computation',async()=>{
      const result=await execute(stdioCase(seed+11),'fresh-c-b');
      assert(a,'First source did not execute successfully');
      assert(a.sourceSha256!==result.sourceSha256,'Sources did not change');
      assert(a.abi.wasmSha256!==result.abi.wasmSha256,'Wasm bytes did not change after changing source');
      assert(a.stdout!==result.stdout,'Outputs did not change after changing source');return result;
    });
    await check('fresh C++ standard library',()=>execute(cppCase(seed+5),'fresh-cpp'));
    await check('syntax error returns real compiler diagnostics',async()=>{
      const source=`#include <emscripten.h>\nint main() { int invalid_${nonce} = ; return 0; }`;
      let artifact;
      try {artifact=await compiler.compile({source,language:'c',args:baseArgs,basename:'invalid-source'});}
      catch(error) {artifact={exitCode:1,stderr:error.diagnostics || error.stderr || error.message,stdout:error.stdout || ''};}
      assert(artifact.exitCode!==0,'Invalid C source compiled successfully');
      assert(/error:|error generated|expected expression/i.test(artifact.stderr + artifact.stdout),`No compiler diagnostic: ${artifact.stderr}`);
      return {source,sourceSha256:await hash(source),compileExitCode:artifact.exitCode,compileStdout:diagnosticText(artifact.stdout),compileStderr:diagnosticText(artifact.stderr)};
    });
    await check('compiler recovers after syntax error',()=>execute(stdioCase(seed+23),'fresh-recovery'));
    }
    if(graphics || only==='gl4es') {
      if(only!=='gl4es') {
      const red=await check('fresh Emscripten WebGL context and red pixels',()=>execute(webglCase(seed,[255,0,0]),'fresh-webgl-red'));
      await check('changed graphics source and green pixels',async()=>{
        const result=await execute(webglCase(seed+1,[0,255,0]),'fresh-webgl-green');
        assert(red,'First graphics source did not execute successfully');
        assert(red.sourceSha256!==result.sourceSha256&&red.abi.wasmSha256!==result.abi.wasmSha256,'Changed graphics source did not change Wasm bytes');
        return result;
      });
      await check('fresh GLFW3 browser context and blue pixels',()=>execute(glfwCase(seed,[0,0,255]),'fresh-glfw-blue'));
      }
      let runtimeArgs=gl4esArgs || compiler.info?.gl4esArgs;
      if(!runtimeArgs?.length) {
        const archiveUrl=new URL('../runtime/libGL.a',import.meta.url);
        if((await fetch(archiveUrl,{method:'HEAD'})).ok) {
          log('Installing the actual browser-built GL4ES archive into the fresh compiler worker.');
          const gl4es=await import('../runtime/build-gl4es.js');
          report.gl4es=await gl4es.installGL4ES(compiler);
          runtimeArgs=[...gl4es.gl4esLinkArguments,'-sUSE_GLFW=3'];
          report.gl4es.linkArguments=runtimeArgs;
        }
      }
      if(runtimeArgs?.length) await check('real GL4ES linked fixed-function triangle pixels',()=>execute(gl4esCase(seed,runtimeArgs),'fresh-gl4es-fixed'));
      else {report.tests.push({name:'real GL4ES linked fixed-function triangle pixels',status:'blocked',reason:'No verified Wasm-target GL4ES archive and include/link arguments supplied by the compiler adapter.'});log('BLOCKED real GL4ES: no verified Wasm archive supplied');}
    }
  } catch(error) {
    report.tests.push({name:'browser compiler initialization',status:'fail',error:error.stack||String(error)});log(`FAIL initialization: ${error.message}`);
  } finally {await compiler?.dispose?.();$('run').disabled=false;}
  return publish();
}
window.runAcceptance = runAcceptance;
const query = new URL(location.href).searchParams;
if(query.has('adapter')) $('adapter').value=query.get('adapter');
$('run').onclick=()=>{$('run').disabled=true;return runAcceptance({graphics:query.get('graphics')!=='0',only:query.get('only')});};
if(query.has('autorun')) $('run').click();
