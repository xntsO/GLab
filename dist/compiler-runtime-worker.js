import {createGraphics} from './graphics.js';
import {runProgram} from './compiler.js';
let canvas,graphics,width=800,height=600;
const send=(type,data)=>self.postMessage({type,data});
self.onmessage=async ({data})=>{
  try {
    if(data.type==='canvas'){canvas=data.canvas;width=data.width;height=data.height;return;}
    if(data.type==='resize'){width=data.width;height=data.height;graphics?.resize(width,height);return;}
    if(data.type==='event'){graphics?.handleEvent(data.event);return;}
    if(data.type==='snapshot'){const blob=await canvas.convertToBlob({type:'image/png'});self.postMessage({type:'snapshot',id:data.id,blob});return;}
    if(data.type==='run'){
      graphics?.stop();
      graphics=createGraphics(canvas,{
        onDiagnostic:message=>send('diagnostic',message),
        onError:error=>send('error',error.message || String(error)),
        onFrame:stats=>send('frame',stats),onTitle:title=>send('title',title),onMenu:menu=>send('menu',menu),onResize:size=>send('resize',size)
      });
      graphics.resize(width,height);
      const result=await runProgram(data.wasm,graphics,{stdin:data.stdin,stdout:text=>send('stdout',text),onExit:code=>self.postMessage({type:'exit',code})});
      self.postMessage({type:'started',id:data.id,exitCode:result.exitCode,active:result.active});
    }
  }catch(error){self.postMessage({type:'error',id:data.id,message:error.message || String(error)});}
};
