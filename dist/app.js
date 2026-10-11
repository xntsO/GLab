import {labs, starter} from './labs.js';
import {Compiler, Runner} from './compiler.js?v=2';

const $ = id => document.getElementById(id);
const compiler = new Compiler();
const custom = {id:'custom',title:'My program',group:'Your workspace',description:'A blank canvas for your own C or C++ ideas.',page:null,code:starter,exercise:'Write your own C or C++ program, or open an existing source file.',notes:['A single source file is compiled with the included C/C++ standard library and graphics headers.']};
const allLabs = [...labs, custom];
let current = custom, libraryVisible = false;
let runner, runToken=0, busy=false, active=false, fontSize=12, saveTimer, toastTimer, errorLines=[];
let outputWidth=500,outputHeight=500,lastMouse={x:0,y:0},lastCode='',ignoreChange=false;
const storageKey = id => `gllab:draft:v1:${id}`;
const read = key => {try{return localStorage.getItem(key);}catch{return null;}};
const write = (key,value) => {try{localStorage.setItem(key,value);return true;}catch{return false;}};
const editor = CodeMirror.fromTextArea($('source'), {
  mode:'text/x-c++src',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,
  matchBrackets:true,autoCloseBrackets:true,styleActiveLine:true,lineWrapping:false,
  extraKeys:{'Ctrl-Enter':()=>run(),'Cmd-Enter':()=>run(),'Ctrl-S':()=>downloadSource(),'Cmd-S':()=>downloadSource(),'Ctrl-/':'toggleComment','Cmd-/':'toggleComment','Tab':cm=>cm.replaceSelection('    ')}
});
editor.getInputField().setAttribute('aria-label','C or C++ source code');
editor.on('cursorActivity',()=>{const p=editor.getCursor();$('cursorPosition').textContent=`Ln ${p.line+1}, Col ${p.ch+1}`;});
editor.on('change',()=>{
  if(ignoreChange)return;
  clearTimeout(saveTimer);$('savedState').textContent='Saving…';
  $('dirtyDot').hidden=editor.getValue()===current.code;
  if(lastCode && editor.getValue()!==lastCode && !busy)$('statusText').textContent='Edited · run to update';
  saveTimer=setTimeout(saveDraft,350);
  clearErrors();
});
function saveDraft(){clearTimeout(saveTimer);const saved=write(storageKey(current.id),JSON.stringify({code:editor.getValue(),language:$('language').value}));$('savedState').textContent=saved?'Saved in this browser':'Storage unavailable · download your code';}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function filename(){return current.id==='custom'?`my-program.${$('language').value==='c'?'c':'cpp'}`:`lab-${current.id.toLowerCase()}.${$('language').value==='c'?'c':'cpp'}`;}
function renderLibrary(){
  if(!libraryVisible){$('labList').replaceChildren();return;}
  const query=$('labSearch').value.trim().toLowerCase();$('labList').replaceChildren();
  const visible=allLabs.filter(lab=>(lab.id!=='custom'||current.id==='custom'||read(storageKey('custom')))&&`${lab.id} ${lab.title} ${lab.group}`.toLowerCase().includes(query));
  for(const group of [...new Set(visible.map(l=>l.group))]){
    const section=document.createElement('div');section.className='lab-group';
    const heading=document.createElement('h3');heading.textContent=group;section.append(heading);
    for(const lab of visible.filter(l=>l.group===group)){
      const button=document.createElement('button');button.className=`lab-button${lab.id===current.id?' active':''}`;button.dataset.lab=lab.id;button.setAttribute('aria-current',lab.id===current.id?'page':'false');
      const number=document.createElement('span');number.className='lab-number';number.textContent=lab.id==='custom'?'<>':lab.id.padStart(2,'0');
      const title=document.createElement('span');title.textContent=lab.title;button.append(number,title);button.addEventListener('click',()=>selectLab(lab));section.append(button);
    }$('labList').append(section);
  }
  if(!visible.length){const p=document.createElement('p');p.className='empty-search';p.textContent='No matching labs.';$('labList').append(p);}
}
function toggleLibrary(){
  const restoreFocus=$('sidebar').contains(document.activeElement);
  libraryVisible=!libraryVisible;
  $('sidebar').hidden=!libraryVisible;$('sidebarToggle').hidden=!libraryVisible;
  $('sidebarToggle').setAttribute('aria-expanded',String(libraryVisible));
  $('sidebar').classList.toggle('open',libraryVisible);
  if(!libraryVisible&&current.id!=='custom')selectLab(custom);
  else renderLibrary();
  if(!libraryVisible&&restoreFocus)$('newBtn').focus();
  editor.refresh();
  toast(libraryVisible?'Library shown.':'Library hidden.');
}
function selectLab(lab,{initial=false,source=null,language=null}={}){
  if(!initial)saveDraft();
  stop(false);current=lab;lastCode='';clearErrors();
  let draft=null;try{draft=JSON.parse(read(storageKey(lab.id)));}catch{}
  ignoreChange=true;editor.setValue(source??draft?.code??lab.code);ignoreChange=false;
  $('language').value=language??draft?.language??'cpp';updateLanguage();
  $('lessonTitle').textContent=lab.title;$('lessonDescription').textContent=lab.description;
  $('lessonToggle').hidden=lab.id==='custom';$('lessonNotes').hidden=true;$('lessonToggle').setAttribute('aria-expanded','false');
  const personal=lab.id==='custom';
  $('resetDialog').querySelector('h2').textContent=personal?'Reset your program?':'Restore this example?';
  $('resetDialog').querySelector('p').textContent=personal?'Your saved source will be replaced by the starter program.':'Your saved edits for this lab will be replaced by the original example.';
  $('confirmReset').textContent=personal?'Reset program':'Restore example';
  $('resetBtn').title=personal?'Restore the starter program':'Restore the original example';
  $('breadcrumb').replaceChildren(document.createTextNode(lab.group),Object.assign(document.createElement('span'),{textContent:'/'}),document.createTextNode(lab.id==='custom'?'New program':`Lab ${lab.id.padStart(2,'0')}`));
  $('exercise').textContent=lab.exercise;$('notes').replaceChildren(...lab.notes.map(note=>Object.assign(document.createElement('li'),{textContent:note})));
  $('pageReference').textContent=lab.page?`Adapted from the COMP 461 lab manual · page ${lab.page}`:'Your own C/C++ source';
  $('dirtyDot').hidden=editor.getValue()===lab.code;renderLibrary();$('sidebar').classList.remove('open');
  $('canvasPlaceholder').hidden=false;$('statusText').textContent='Ready to compile';$('statusLed').className='status-led';
  $('consoleOutput').classList.remove('error');$('consoleOutput').textContent=`${lab.title}\n${lab.description}\n\n${compiler.ready?'Compiler ready. Press Run or Ctrl+Enter.':'Press Run to load the C/C++ compiler (about 20 MB on first use).'}\n`;
  $('canvasSize').textContent='500 × 500';outputWidth=500;outputHeight=500;resetCanvas();
  write('gllab:selected',lab.id);if(!initial){history.replaceState(null,'',`#lab=${encodeURIComponent(lab.id)}`);saveDraft();}editor.scrollTo(0,0);
}
function updateLanguage(){editor.setOption('mode',$('language').value==='c'?'text/x-csrc':'text/x-c++src');$('fileName').textContent=filename();}
function appendLog(message){const output=$('consoleOutput');output.textContent+=String(message);if(output.textContent.length>50000)output.textContent=output.textContent.slice(-50000);output.scrollTop=output.scrollHeight;}
function clearErrors(){for(const line of errorLines)editor.removeLineClass(line,'background','compile-error-line');errorLines=[];}
function markErrors(message){for(const match of message.matchAll(/playground\.(?:cpp|c):(\d+):\d+: (?:fatal )?error:/g)){const line=Number(match[1])-1;if(line<editor.lineCount()){editor.addLineClass(line,'background','compile-error-line');errorLines.push(line);}}if(errorLines.length)editor.scrollIntoView({line:errorLines[0],ch:0},60);}
function setBusy(value){busy=value;$('runBtn').disabled=value;$('runBtn').querySelector('span').textContent=value?'Compiling…':'Run program';$('stopBtn').disabled=!value&&!active;$('progressTrack').hidden=!value;}
function handleFailure(error,token){if(token!==runToken)return;const message=error.diagnostics||error.message||String(error);$('consoleOutput').classList.add('error');appendLog(`\n${message}\n`);markErrors(message);$('statusText').textContent='Check the console';$('statusLed').className='status-led error';active=false;setBusy(false);}
async function run(){
  if(busy)return;
  saveDraft();$('inputPanel').hidden=true;$('consoleOutput').hidden=false;$('inputToggle').setAttribute('aria-expanded','false');const source=editor.getValue();if(!source.trim()){toast('Write some code before running.');return;}
  stop(false);const token=++runToken;clearErrors();lastCode=source;$('consoleOutput').textContent='';$('consoleOutput').classList.remove('error');setBusy(true);$('statusText').textContent='Preparing compiler';$('progressFill').style.width='8%';
  try{
    await compiler.init(message=>{if(token!==runToken)return;$('statusText').textContent=message;appendLog(message+'\n');$('progressFill').style.width=message.includes('ready')?'65%':message.includes('Linking')?'90%':'35%';});
    if(token!==runToken)return;
    const result=await compiler.compile(source,{language:$('language').value});if(token!==runToken)return;
    if(result.diagnostics)appendLog(result.diagnostics+'\n');appendLog(`Compiled successfully in ${(result.elapsedMs/1000).toFixed(2)} s.\n`);
    resetCanvas();const canvas=$('canvas');
    runner=new Runner(canvas,{
      stdout:text=>{if(token===runToken)appendLog(text);},
      onResize:size=>{if(token!==runToken)return;outputWidth=size.width;outputHeight=size.height;$('canvasSize').textContent=`${size.width} × ${size.height}`;$('canvasMount').style.aspectRatio=`${size.width}/${size.height}`;canvas.style.aspectRatio=`${size.width}/${size.height}`;$('canvasMount').style.setProperty('--canvas-ratio',size.width/size.height);},
      onFrame:stats=>{if(token!==runToken)return;$('canvasPlaceholder').hidden=true;$('statusLed').className='status-led running';if(!busy)$('statusText').textContent=editor.getValue()===lastCode?'Running':'Edited · run to update';},
      onDiagnostic:message=>{if(token===runToken)appendLog(`Graphics: ${message}\n`);},
      onError:message=>handleFailure(new Error(message),token),
      onTitle:title=>{if(token!==runToken)return;$('windowTitle').textContent=title;$('windowTitle').title=title;canvas.setAttribute('aria-label',`${title}. Click to focus for keyboard and mouse interaction.`);},
      onMenu:menu=>{if(token===runToken)showMenu(menu);},
      onExit:code=>{if(token!==runToken)return;appendLog(`\nProgram exited with code ${code}.\n`);$('statusText').textContent=`Exited (${code})`;active=false;setBusy(false);}
    });
    attachCanvasEvents(canvas);active=true;$('statusText').textContent='Starting program';setBusy(false);$('stopBtn').disabled=false;
    const started=await runner.run(result.wasm,{stdin:$('stdin').value});if(token!==runToken)return;
    $('canvasPlaceholder').hidden=true;active=started.active;
    $('statusText').textContent=active?'Running':`Finished (${started.exitCode??0})`;$('statusLed').className=active?'status-led running':'status-led';
    appendLog(active?'Program started. Click the canvas for keyboard and mouse controls.\n':'Program finished.\n');
  }catch(error){handleFailure(error,token);}finally{if(token===runToken)setBusy(false);}
}
function stop(log=true){runToken++;if(busy)compiler.stop();runner?.stop();runner=null;active=false;setBusy(false);$('canvasMenu').hidden=true;$('statusLed').className='status-led';if(log){$('statusText').textContent='Stopped';appendLog('\nStopped. Your code is still saved.\n');}}
function resetCanvas(){$('windowTitle').textContent='Graphics output';$('windowTitle').removeAttribute('title');const old=$('canvas');const canvas=document.createElement('canvas');canvas.id='canvas';canvas.width=500;canvas.height=500;canvas.tabIndex=0;canvas.setAttribute('aria-label','OpenGL graphics output');old.replaceWith(canvas);$('canvasMount').style.aspectRatio='1';}
function attachCanvasEvents(canvas){
  const point=event=>{const rect=canvas.getBoundingClientRect();lastMouse={x:Math.floor((event.clientX-rect.left)*outputWidth/rect.width),y:Math.floor((event.clientY-rect.top)*outputHeight/rect.height)};return lastMouse;};
  const modifiers=e=>(e.shiftKey?1:0)|(e.ctrlKey?2:0)|(e.altKey?4:0);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);$('canvasMenu').hidden=true;runner?.handleEvent({type:'mouse',button:e.button,state:0,...point(e),modifiers:modifiers(e)});e.preventDefault();});
  canvas.addEventListener('pointerup',e=>{runner?.handleEvent({type:'mouse',button:e.button,state:1,...point(e),modifiers:modifiers(e)});});
  canvas.addEventListener('pointermove',e=>runner?.handleEvent({type:e.buttons?'motion':'passive',...point(e),modifiers:modifiers(e)}));
  for(const type of ['keydown','keyup'])canvas.addEventListener(type,e=>{if(e.ctrlKey||e.metaKey)return;runner?.handleEvent({type,key:e.key,...lastMouse,modifiers:modifiers(e)});if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab','Escape'].includes(e.key))e.preventDefault();});
}
function showMenu(menu){const popup=$('canvasMenu');popup.replaceChildren();for(const item of menu.items){const button=document.createElement('button');button.textContent=item.label+(item.sub?' >':'');button.setAttribute('role','menuitem');button.addEventListener('click',()=>{if(item.sub){runner?.handleEvent({type:'menuOpen',menu:item.sub,x:menu.x,y:menu.y});}else{runner?.handleEvent({type:'menu',menu:menu.menu,value:item.value});popup.hidden=true;$('canvas').focus();}});popup.append(button);}popup.setAttribute('role','menu');const canvas=$('canvas').getBoundingClientRect(),surround=$('canvasSurround').getBoundingClientRect();popup.style.left=`${Math.min(surround.width-170,Math.max(5,canvas.left-surround.left+menu.x/outputWidth*canvas.width))}px`;popup.style.top=`${Math.min(surround.height-180,Math.max(5,canvas.top-surround.top+menu.y/outputHeight*canvas.height))}px`;popup.hidden=false;popup.querySelector('button')?.focus();}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadSource(){saveDraft();downloadBlob(new Blob([editor.getValue()],{type:'text/plain;charset=utf-8'}),filename());toast('Source downloaded.');}
$('runBtn').addEventListener('click',run);$('stopBtn').addEventListener('click',()=>stop());$('labSearch').addEventListener('input',renderLibrary);
$('language').addEventListener('change',()=>{updateLanguage();saveDraft();});$('downloadBtn').addEventListener('click',downloadSource);
$('newBtn').addEventListener('click',()=>selectLab(custom));$('sidebarToggle').addEventListener('click',()=>{if(libraryVisible){const open=$('sidebar').classList.toggle('open');$('sidebarToggle').setAttribute('aria-expanded',String(open));}});
$('lessonToggle').addEventListener('click',()=>{const open=$('lessonNotes').hidden;$('lessonNotes').hidden=!open;$('lessonToggle').setAttribute('aria-expanded',String(open));editor.refresh();});
$('clearConsole').addEventListener('click',()=>{$('consoleOutput').textContent='';$('consoleOutput').classList.remove('error');});
$('importBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>1024*1024){toast('Please open a source file smaller than 1 MB.');return;}const source=await file.text();selectLab(custom,{source,language:/\.c$/i.test(file.name)?'c':'cpp'});toast(`Opened ${file.name}`);e.target.value='';});
$('resetBtn').addEventListener('click',()=>$('resetDialog').showModal());$('cancelReset').addEventListener('click',()=>$('resetDialog').close());$('confirmReset').addEventListener('click',()=>{editor.setValue(current.code);saveDraft();$('resetDialog').close();toast(current.id==='custom'?'Starter program restored.':'Original example restored.');});
for(const id of ['helpBtn','shortcutsBtn'])$(id).addEventListener('click',()=>$('guideDialog').showModal());$('closeGuide').addEventListener('click',()=>$('guideDialog').close());
for(const id of ['guideDialog','resetDialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
$('fontDown').addEventListener('click',()=>changeFont(-1));$('fontUp').addEventListener('click',()=>changeFont(1));function changeFont(delta){fontSize=Math.max(10,Math.min(20,fontSize+delta));editor.getWrapperElement().style.fontSize=`${fontSize}px`;editor.refresh();}
$('fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('canvasSurround').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}});
$('snapshotBtn').addEventListener('click',async()=>{if(!runner||!active){toast('Run a graphics program before saving an image.');return;}try{const blob=await runner.snapshot();downloadBlob(blob,filename().replace(/\.(cpp|c)$/,'.png'));toast('Graphics image downloaded.');}catch(error){toast(error.message);}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(!busy)run();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();downloadSource();}if(e.key==='Escape'){$('canvasMenu').hidden=true;$('sidebar').classList.remove('open');}});
document.addEventListener('pointerdown',e=>{if(!$('canvasMenu').contains(e.target)&&e.target!==$('canvas'))$('canvasMenu').hidden=true;});
window.addEventListener('beforeunload',saveDraft);
// Every visit starts in the personal workspace. Drafts remain saved per program.
selectLab(custom,{initial:true});
if(new URLSearchParams(location.hash.slice(1)).has('lab'))history.replaceState(null,'',location.pathname+location.search);

document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.altKey&&!e.metaKey&&!e.shiftKey&&(e.code==='KeyB'||e.key.toLowerCase()==='b')){
    e.preventDefault();e.stopPropagation();if(!e.repeat)toggleLibrary();
  }
},true);

// Observe three-finger horizontal swipes without cancelling normal scrolling.
let librarySwipe=null;
document.addEventListener('touchstart',e=>{
  if(e.touches.length!==3){librarySwipe=null;return;}
  librarySwipe={started:performance.now(),points:Array.from(e.touches,t=>({id:t.identifier,x:t.clientX,y:t.clientY})),matched:false};
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!librarySwipe)return;
  if(e.touches.length!==3||performance.now()-librarySwipe.started>1200){librarySwipe=null;return;}
  const moves=librarySwipe.points.map(start=>{const touch=Array.from(e.touches).find(t=>t.identifier===start.id);return touch?{x:touch.clientX-start.x,y:touch.clientY-start.y}:null;});
  if(moves.some(move=>!move)){librarySwipe=null;return;}
  const direction=Math.sign(moves[0].x);
  librarySwipe.matched=moves.every(move=>Math.abs(move.x)>=70&&Math.sign(move.x)===direction&&Math.abs(move.y)<=60&&Math.abs(move.x)>=Math.abs(move.y)*1.5);
},{passive:true});
document.addEventListener('touchend',()=>{
  if(librarySwipe?.matched&&performance.now()-librarySwipe.started<=1200)toggleLibrary();
  librarySwipe=null;
},{passive:true});
document.addEventListener('touchcancel',()=>{librarySwipe=null;},{passive:true});

$('inputToggle').addEventListener('click',()=>{const open=$('inputPanel').hidden;$('inputPanel').hidden=!open;$('consoleOutput').hidden=open;$('inputToggle').setAttribute('aria-expanded',String(open));if(open)$('stdin').focus();});
