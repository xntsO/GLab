import {Compiler,Runner,bindCanvasInput} from '../../emscripten-adapter.js';
import {OutputMirror} from '../../output-mirror.js';
import {labs,starter} from '../../labs.js';
import {mergedCases} from './merged-cases.js';
import {cppOopCases} from './cpp-oop-cases.js';
import {sha256} from './digest.js';
const $=id=>document.getElementById(id);
const assert=(value,message)=>{if(!value)throw new Error(message);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=(promise,ms,message)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]).finally(()=>clearTimeout(timer));};
const samePixel=(actual,expected)=>actual.every((v,i)=>Math.abs(v-expected[i])<=2);
async function sample(blob){
  assert(blob instanceof Blob&&blob.type==='image/png','snapshot must return a PNG Blob');
  const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();
  const at=(x,y)=>[...context.getImageData(x,y,1,1).data];
  const corner=at(1,1),all=context.getImageData(0,0,canvas.width,canvas.height).data;let differentPixels=0;
  for(let i=0;i<all.length;i+=4)if(Math.abs(all[i]-corner[0])>2||Math.abs(all[i+1]-corner[1])>2||Math.abs(all[i+2]-corner[2])>2)differentPixels++;
  return {width:canvas.width,height:canvas.height,center:at(Math.floor(canvas.width/2),Math.floor(canvas.height/2)),corner,differentPixels,pngBytes:blob.size,blob};
}
function artifactEvidence(artifact){const value=artifact.wasm??artifact;return {backend:artifact.backend??null,command:artifact.command??null,files:value.files?.map(file=>({path:file.path,bytes:file.bytes?.byteLength??file.bytes?.length}))??[],exportName:value.exportName??null};}
function makeRunner(){
  const canvas=document.createElement('canvas');canvas.width=500;canvas.height=500;$('live').replaceChildren(canvas);
  const events={stdout:'',frames:0,titles:[],sizes:[],exits:[],errors:[],diagnostics:[],menus:[],loopEnds:0};
  const runner=new Runner(canvas,{stdout:text=>events.stdout+=text,onFrame:()=>events.frames++,onTitle:title=>events.titles.push(title),onResize:size=>events.sizes.push(size),onExit:code=>events.exits.push(code),onError:error=>events.errors.push(String(error)),onDiagnostic:message=>events.diagnostics.push(message),onMenu:menu=>events.menus.push(menu),onLoopEnd:()=>events.loopEnds++});
  return {runner,canvas,events};
}
async function waitFor(predicate,ms=5000){const end=performance.now()+ms;while(!predicate()){if(performance.now()>end)throw new Error('Timed out waiting for runtime output');await delay(50);}}
async function waitGraphics(runner,predicate,description){const end=performance.now()+10000;let pixels;do{pixels=await sample(await timeout(runner.snapshot(),5000,'snapshot timed out'));if(predicate(pixels))return pixels;await delay(100);}while(performance.now()<end);const error=new Error('Timed out waiting for '+description+'; last screenshot '+pixels.width+'x'+pixels.height+', center='+pixels.center+', differentPixels='+pixels.differentPixels);error.pixels=pixels;throw error;}
async function waitPixel(runner,expected){return waitGraphics(runner,pixels=>samePixel(pixels.center,expected),'pixel '+expected);}
export async function runMergedIntegration({only=null}={}){
  const seed=crypto.getRandomValues(new Uint32Array(1))[0]%10000;
  const report={schema:1,kind:'merged editor Compiler/Runner integration',started:new Date().toISOString(),seed,url:location.href,environment:{userAgent:navigator.userAgent,secureContext:isSecureContext,crossOriginIsolated,WebAssembly:typeof WebAssembly},tests:[]};window.mergedIntegrationReport=report;
  const log=text=>{$('state').textContent=text;$('log').textContent+=text+'\n';};
  const publish=()=>{$('results').textContent=JSON.stringify(report,null,2);};
  const check=async(name,fn)=>{const start=performance.now();try{const evidence=await fn();report.tests.push({name,status:'pass',elapsedMs:performance.now()-start,...evidence});log('PASS '+name);}catch(error){report.tests.push({name,status:'fail',elapsedMs:performance.now()-start,error:error.stack??String(error),...error.evidence});log('FAIL '+name+': '+error.message);}publish();};
  const compiler=new Compiler();let lastArtifact;const inputArtifacts=new Map();
  const compile=async sourceCase=>{log('Compiling '+sourceCase.name);const cacheKey=sourceCase.inputSteps?JSON.stringify([sourceCase.language,sourceCase.source,sourceCase.args]):null;if(cacheKey&&inputArtifacts.has(cacheKey))return inputArtifacts.get(cacheKey);try{const value=await timeout(compiler.compile(sourceCase.source,{language:sourceCase.language,args:sourceCase.args??[]}),180000,'Compilation exceeded three minutes');assert((value.wasm??value).files?.some(file=>file.path.endsWith('.js')),'Editor compiler must emit Emscripten JS');assert((value.wasm??value).files?.some(file=>file.path.endsWith('.wasm')),'Editor compiler must emit Wasm');if(cacheKey)inputArtifacts.set(cacheKey,value);return value;}catch(error){error.evidence={source:sourceCase.source,language:sourceCase.language,command:error.command,diagnostics:error.diagnostics};throw error;}};
  const execute=async sourceCase=>{
    const artifact=await compile(sourceCase);lastArtifact=artifact;
    const {runner,canvas,events}=makeRunner();
    if(sourceCase.canvasInput)bindCanvasInput(canvas,event=>runner.handleEvent(event));
    let mirror;
    if(sourceCase.mirrorInput){const popup={closed:false,postMessage:()=>{}};mirror=new OutputMirror({state:()=>({}),capture:()=>{},input:event=>runner.handleEvent(event),stop:()=>{},blocked:()=>{}});mirror.popup=popup;mirror.session='input-regression';}
    const input=event=>mirror?mirror.receive({origin:location.origin,source:mirror.popup,data:{channel:'gllab-output-v1',session:mirror.session,type:'input',event}}):runner.handleEvent(event);
    let started,pixels;
    try{
      started=await timeout(runner.run(artifact.wasm??artifact,{stdin:sourceCase.stdin??''}),30000,'Runner did not start');await delay(250);
      assert(events.errors.length===0,'Runtime error: '+events.errors.join('\n'));
      if(sourceCase.expected){if(sourceCase.active)await waitFor(()=>events.stdout.includes(sourceCase.expected),10000);assert(events.stdout.includes(sourceCase.expected),'Missing expected console text '+sourceCase.expected+'; got '+events.stdout);}
      if(sourceCase.stderr)assert(events.stdout.includes(sourceCase.stderr),'stderr did not reach editor console');
      if(sourceCase.active)assert(started.active===true,'GLUT loop must stay active until Stop');
      else assert(started.exitCode===(sourceCase.exitCode??0),'Incorrect exit status: '+started.exitCode);
      if(sourceCase.loopEnded){await waitFor(()=>events.loopEnds>0,10000);assert(events.loopEnds>0,'Browser main loop cancellation did not notify the editor');await waitFor(()=>events.exits.includes(0),5000);}
      if(sourceCase.title)assert(events.titles.includes(sourceCase.title),'Window title did not reach editor hooks');
      if(sourceCase.capture||sourceCase.pixel||sourceCase.nonUniform){await waitFor(()=>events.frames>0);pixels=await waitGraphics(runner,value=>(!sourceCase.size||(value.width===sourceCase.size[0]&&value.height===sourceCase.size[1]))&&(!sourceCase.pixel||samePixel(value.center,sourceCase.pixel))&&(!sourceCase.nonUniform||value.differentPixels>10),'the rendered program pixels');if(sourceCase.size)assert(pixels.width===sourceCase.size[0]&&pixels.height===sourceCase.size[1],'Wrong screenshot dimensions '+pixels.width+'x'+pixels.height);if(sourceCase.pixel)assert(samePixel(pixels.center,sourceCase.pixel),'PNG center '+pixels.center+' differs from '+sourceCase.pixel);if(sourceCase.nonUniform)assert(pixels.differentPixels>10,'Lab screenshot is blank or uniformly cleared');const figure=document.createElement('figure'),image=new Image(),caption=document.createElement('figcaption');image.src=URL.createObjectURL(pixels.blob);image.alt=sourceCase.name;caption.textContent=sourceCase.name;figure.append(image,caption);$('gallery').append(figure);}
      if(sourceCase.inputPixel){runner.handleEvent({type:'keydown',key:'a',x:20,y:20,modifiers:0});const after=await waitPixel(runner,sourceCase.inputPixel);pixels.inputCenter=after.center;}
      if(sourceCase.mousePixel){runner.handleEvent({type:'mouse',button:0,state:0,x:23,y:41,modifiers:0});const after=await waitPixel(runner,sourceCase.mousePixel);assert(events.stdout.includes('mouse=23,41'),'Mouse coordinates were not preserved: '+events.stdout);pixels.mouseCenter=after.center;}
      if(sourceCase.menuPixel){runner.handleEvent({type:'mouse',button:2,state:0,x:23,y:41,modifiers:0});await waitFor(()=>events.menus.length>0);const menu=events.menus.at(-1);assert(menu.items.some(item=>item.value===42),'GLUT menu entries did not reach editor');runner.handleEvent({type:'menu',menu:menu.menu,value:42});const after=await waitPixel(runner,sourceCase.menuPixel);assert(events.stdout.includes('menu=42'),'Menu callback lost selected value');pixels.menuCenter=after.center;}
      for(const step of sourceCase.inputSteps??[]){
        const before=events.stdout.length;
        if(step.css)canvas.style.cssText=step.css;
        if(step.dom){
          const rect=canvas.getBoundingClientRect(),event=step.dom;
          if(event.type==='keydown')canvas.focus();
          const options={bubbles:true,cancelable:true,clientX:rect.left+(event.x??0),clientY:rect.top+(event.y??0),shiftKey:!!(event.modifiers&1),ctrlKey:!!(event.modifiers&2),altKey:!!(event.modifiers&4),...event};
          const value=event.type==='wheel'?new WheelEvent('wheel',options):event.type.startsWith('key')?new KeyboardEvent(event.type,options):event.type==='blur'?new Event('blur'):new PointerEvent(event.type,options);
          const accepted=canvas.dispatchEvent(value);
          if(event.type==='wheel'||event.type.startsWith('key'))assert(!accepted,'Canvas did not prevent browser default for '+event.type);
        }
        if(step.event)input({x:23,y:41,modifiers:0,...step.event});
        if(step.expected){try{await waitFor(()=>events.stdout.slice(before).includes(step.expected),5000);}catch(error){throw new Error('Expected '+JSON.stringify(step.expected)+' after '+JSON.stringify(step.event??step.dom)+'; received '+JSON.stringify(events.stdout.slice(before)));}}
        if(step.pixel)await waitPixel(runner,step.pixel);
        if(step.count){await delay(150);assert(events.stdout.slice(before).split(step.expected).length-1===step.count,'Duplicate or missing input callback: '+events.stdout.slice(before));}
      }
      assert(events.errors.length===0,'Input runtime error: '+events.errors.join('\n'));
      if(sourceCase.updatedTitle)await waitFor(()=>events.titles.includes(sourceCase.updatedTitle),5000);
      assert(events.exits.every(Number.isInteger),'Runtime emitted an invalid exit status: '+JSON.stringify(events.exits));
      return {source:sourceCase.source,sourceSha256:await sha256(new TextEncoder().encode(sourceCase.source)),artifact:artifactEvidence(artifact),started,events,pixels:pixels?{width:pixels.width,height:pixels.height,center:pixels.center,corner:pixels.corner,differentPixels:pixels.differentPixels,pngBytes:pixels.pngBytes,inputCenter:pixels.inputCenter,mouseCenter:pixels.mouseCenter}:null};
    }catch(error){pixels=error.pixels??pixels;error.evidence={source:sourceCase.source,language:sourceCase.language,artifact:artifactEvidence(artifact),started,events,pixels:pixels?{width:pixels.width,height:pixels.height,center:pixels.center,corner:pixels.corner,differentPixels:pixels.differentPixels,pngBytes:pixels.pngBytes}:null};throw error;}finally{runner.stop();assert(!document.querySelector('iframe[title="Isolated C/C++ program runtime"]'),'Stop left generated program iframe mounted');const frames=events.frames;await delay(100);assert(events.frames===frames,'Stopped program still delivered frames');}
  };
  $('run').disabled=true;$('log').textContent='';$('gallery').replaceChildren();
  try{
    log('Loading merged compiler');await timeout(compiler.init(log),180000,'Compiler initialization exceeded three minutes');report.compilerInfo=compiler.info??null;
    const cases=mergedCases(seed,labs,starter).concat(cppOopCases);
    for(const sourceCase of cases){if(!only||sourceCase.name.toLowerCase().includes(only.toLowerCase()))await check(sourceCase.name,()=>execute(sourceCase));}
    if(!only){
      await check('syntax error is real compiler diagnostic',async()=>{const source='int main(void) { int broken = ; return 0; }';let error;try{await compiler.compile(source,{language:'c'});}catch(value){error=value;}assert(error&&/error:|expected expression/i.test(error.diagnostics??error.message),'Invalid source must produce compiler diagnostics');return {source,diagnostics:error.diagnostics??error.message};});
      await check('compiler and runner recover after syntax error',()=>execute({...cases[0],name:'recovery',stdin:'21 19\n'}));
      await check('Stop interrupts pending runner and permits fresh restart',async()=>{const {runner}=makeRunner();const pending=runner.run(lastArtifact.wasm??lastArtifact,{stdin:'17 23\n'});runner.stop();let error;try{await pending;}catch(value){error=value;}assert(error&&/stopp|abort/i.test(error.message),'Pending run must reject on Stop');assert(!document.querySelector('iframe[title="Isolated C/C++ program runtime"]'),'Stop must remove pending iframe');const evidence=await execute({...cases[0],name:'restart after Stop'});return {stoppedError:error.message,restart:evidence};});
      await check('output mirror session, input, PNG and generation contract',async()=>{const sent=[],received=[];let stops=0,generation=1;const popup={closed:false,postMessage:(data,origin)=>sent.push({data,origin})};const mirror=new OutputMirror({state:()=>({generation,width:96,height:96,title:'QA',status:'Running',active:true,busy:false,hasFrame:true,console:'qa-output',theme:'dark'}),capture:async()=>new Blob(['test'],{type:'image/png'}),input:event=>received.push(event),stop:()=>stops++,blocked:()=>{}});mirror.popup=popup;mirror.session='qa-session';const message=(type,extra={})=>({origin:location.origin,source:popup,data:{channel:'gllab-output-v1',session:'qa-session',type,...extra}});mirror.receive({...message('ready'),origin:'https://wrong.invalid'});assert(!mirror.ready,'Mirror accepted wrong origin');mirror.receive({...message('ready'),source:{}});assert(!mirror.ready,'Mirror accepted wrong source');mirror.receive(message('ready'));assert(mirror.ready&&sent.some(value=>value.data.type==='state'),'Ready did not send state');mirror.receive(message('input',{event:{type:'keydown',key:'g',x:1,y:2,modifiers:0}}));mirror.receive(message('input',{event:{type:'keydown',key:'g',x:NaN,y:2,modifiers:0}}));assert(received.length===1,'Mirror input validation failed');await mirror.frame();assert(sent.some(value=>value.data.type==='frame'&&value.data.generation===1&&value.data.blob instanceof Blob),'Mirror did not send PNG Blob');mirror.receive(message('stop'));assert(stops===1,'Output tab Stop did not forward');mirror.receive(message('closed'));assert(!mirror.ready&&mirror.popup===null,'Closed output tab retained connection');return {types:sent.map(value=>value.data.type),validInputs:received.length,stops};});
    }
  }catch(error){report.tests.push({name:'integration initialization',status:'fail',error:error.stack??String(error)});}finally{compiler.stop();$('run').disabled=false;}
  report.finished=new Date().toISOString();report.pass=report.tests.length>0&&report.tests.every(test=>test.status==='pass');report.summary={passed:report.tests.filter(test=>test.status==='pass').length,failed:report.tests.filter(test=>test.status==='fail').length};publish();$('download').href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));$('download').download='merged-integration-report.json';$('download').hidden=false;log(`${report.summary.passed} passed, ${report.summary.failed} failed`);return report;
}
window.runMergedIntegration=runMergedIntegration;
const query=new URL(location.href).searchParams;$('run').onclick=()=>runMergedIntegration({only:query.get('only')});if(query.has('autorun'))$('run').click();
