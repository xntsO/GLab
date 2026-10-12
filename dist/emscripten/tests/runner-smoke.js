import {runArtifact} from './runner.js';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const files=delay=>[
  {path:'synthetic.wasm',bytes:new Uint8Array([0,97,115,109,1,0,0,0])},
  {path:'synthetic.js',bytes:new TextEncoder().encode(`var SyntheticModule = async function(options) {
    await WebAssembly.instantiate(options.wasmBinary,{});
    await new Promise(resolve=>setTimeout(resolve,${delay}));
    return {HEAPU8:new Uint8Array(64),FS:{},callMain(args){options.print('synthetic-stdout '+args.join(','));options.printErr('synthetic-stderr');options.onExit(0);}};
  };`)}
];
const run=async()=>{
  const report={test:'synthetic iframe runner mechanics',compilerAcceptance:false,environment:{url:location.href,secureContext:isSecureContext,cryptoSubtle:typeof crypto.subtle},tests:[]};
  const check=async(name,fn)=>{try{report.tests.push({name,pass:true,evidence:await fn()});}catch(error){report.tests.push({name,pass:false,error:error.stack});}};
  await check('messages and emitted module lifetime',async()=>{
    const out=[],err=[],exits=[];
    const value=await runArtifact({files:files(0),exportName:'SyntheticModule',mount:document.getElementById('live'),timeoutMs:5000,args:['fresh'],onStdout:text=>out.push(text),onStderr:text=>err.push(text),onExit:code=>exits.push(code)});
    assert(value.stdout==='synthetic-stdout fresh\n','stdout roundtrip');
    assert(value.stderr==='synthetic-stderr\n','stderr roundtrip');
    assert(value.exitCode===0&&!value.active,'exit callback');
    assert(out.length===1&&err.length===1&&exits.length===1,'stream callbacks');
    assert(value.pixels===null,'stdio runner must not create an empty WebGL context');
    assert(value.runtime.isolation.parentDocumentAccessible===false,'Generated program must not access editor DOM');
    assert(value.runtime.isolation.localStorageAccessible===false,'Generated program must not access editor localStorage');
    assert(value.iframe.isConnected,'Frame must remain until dispose');value.dispose();assert(!value.iframe.isConnected,'dispose must remove frame');
    return {stdout:value.stdout,stderr:value.stderr,runtime:value.runtime,abi:value.abi};
  });
  await check('pending factory cancellation',async()=>{
    const controller=new AbortController();
    const pending=runArtifact({files:files(1500),exportName:'SyntheticModule',mount:document.getElementById('live'),timeoutMs:5000,signal:controller.signal});
    setTimeout(()=>controller.abort(),100);
    let error;
    try{await pending;}catch(value){error=value;}
    assert(error?.name==='AbortError','AbortSignal must reject pending execution');
    assert(!document.getElementById('live').querySelector('iframe'),'Abort must remove pending frame');
    return {error:error.name};
  });
  report.pass=report.tests.every(test=>test.pass);document.getElementById('results').textContent=JSON.stringify(report,null,2);window.runnerSmokeReport=report;
};
document.getElementById('run').onclick=run;
if(new URL(location.href).searchParams.has('autorun'))run();
