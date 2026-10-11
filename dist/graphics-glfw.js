// One browser canvas with GLFW-style input and a yielding callback loop.
// Synchronous desktop while loops cannot process browser messages in this build.
export function installGlfw(api,ctx){
  const {fail}=ctx;let initialized=false,window=false,closed=false,userPointer=0,timeOffset=0;
  const callbacks={},events=[],keys=new Map(),buttons=new Map();let cursor=[0,0];
  const check=id=>{if(!window||id!==1)fail('GLFW window handle is invalid.',1281);};
  const yieldRequired=()=>fail('A desktop GLFW while loop cannot yield in this browser compiler. Put one frame in a callback and call emscripten_set_main_loop(frame, 0, 1). See compatibility.html.',1282);
  const setCallback=(name,id,fn)=>{check(id);const old=callbacks[name]||0;callbacks[name]=fn;return old;};
  const integers=(ptr,values)=>new Int32Array(ctx.memory().buffer,ptr,values.length).set(values);
  api.glfwInit=()=>{initialized=true;return 1;};
  api.glfwTerminate=()=>{ctx.cancelLoop();window=false;initialized=false;events.length=0;keys.clear();buttons.clear();for(const key of Object.keys(callbacks))delete callbacks[key];};
  api.glfwWindowHint=(hint,value)=>{const defaults={0x22001:0x30001,0x22002:1,0x22003:0,0x22006:0,0x22008:0,0x21005:24,0x21006:0,0x2100d:0,0x2100e:0,0x20003:1};if(hint===0x22002&&[1,2].includes(value))return;if(hint===0x22003&&value<=1&&value>=0)return;if(defaults[hint]===value)return;fail(`GLFW hint 0x${hint.toString(16)}=${value} is unsupported. This canvas implements selected fixed-function commands, not a desktop driver.`);};
  api.glfwCreateWindow=(width,height,title,monitor,share)=>{if(!initialized)fail('Call glfwInit before glfwCreateWindow.',1282);if(window||monitor||share)fail('GLFW supports one window, without monitors or shared contexts.');if(width<1||height<1)fail('GLFW dimensions must be positive.',1281);window=true;closed=false;ctx.hooks.onTitle?.(ctx.string(title));ctx.resize(width,height);return 1;};
  api.glfwDestroyWindow=id=>{check(id);ctx.cancelLoop();window=false;};
  api.glfwMakeContextCurrent=id=>check(id);
  api.glfwGetCurrentContext=()=>window?1:0;
  api.glfwWindowShouldClose=id=>{check(id);if(!closed&&!ctx.isLoop())yieldRequired();return closed?1:0;};
  api.glfwSetWindowShouldClose=(id,value)=>{check(id);closed=Boolean(value);};
  api.glfwSwapBuffers=id=>{check(id);ctx.flush();};
  api.glfwSwapInterval=interval=>{if(interval!==1)fail('GLFW browser rendering uses the browser frame rate. Only glfwSwapInterval(1) is available.');};
  api.glfwPollEvents=()=>{if(!ctx.isLoop())yieldRequired();const pending=events.splice(0);for(const event of pending){if(event.type==='key')keys.set(event.args[0],event.args[2]===0?0:1);if(event.type==='mouse')buttons.set(event.args[0],event.args[1]);if(event.type==='cursor')cursor=event.args;ctx.invoke(callbacks[event.type],1,...event.args);}};
  api.glfwSetWindowTitle=(id,p)=>{check(id);ctx.hooks.onTitle?.(ctx.string(p));};
  api.glfwSetWindowSize=(id,width,height)=>{check(id);ctx.resize(width,height);};
  api.glfwGetFramebufferSize=(id,w,h)=>{check(id);if(w)integers(w,[ctx.canvas.width]);if(h)integers(h,[ctx.canvas.height]);};
  api.glfwGetWindowSize=api.glfwGetFramebufferSize;
  api.glfwSetWindowUserPointer=(id,p)=>{check(id);userPointer=p;};
  api.glfwGetWindowUserPointer=id=>{check(id);return userPointer;};
  api.glfwGetTime=()=>(performance.now()-ctx.created)/1000+timeOffset;
  api.glfwSetTime=value=>{if(value<0||!Number.isFinite(value))fail('GLFW time must be finite and nonnegative.',1281);timeOffset=value-(performance.now()-ctx.created)/1000;};
  api.glfwGetKey=(id,key)=>{check(id);return keys.get(key)||0;};
  api.glfwGetMouseButton=(id,button)=>{check(id);return buttons.get(button)||0;};
  api.glfwGetCursorPos=(id,x,y)=>{check(id);const v=new DataView(ctx.memory().buffer);if(x)v.setFloat64(x,cursor[0],true);if(y)v.setFloat64(y,cursor[1],true);};
  api.glfwSetKeyCallback=(id,p)=>setCallback('key',id,p);
  api.glfwSetCharCallback=(id,p)=>setCallback('char',id,p);
  api.glfwSetMouseButtonCallback=(id,p)=>setCallback('mouse',id,p);
  api.glfwSetCursorPosCallback=(id,p)=>setCallback('cursor',id,p);
  api.glfwSetFramebufferSizeCallback=(id,p)=>setCallback('framebuffer',id,p);
  api.glfwSetWindowSizeCallback=(id,p)=>setCallback('size',id,p);
  const mainLoop=(callback,arg,fps,simulate)=>{if(!callback||!simulate)fail('Use emscripten_set_main_loop with a non-null callback and simulateInfiniteLoop=1 to keep C/C++ state alive.',1282);if(fps!==0&&fps!==60)fail('This browser loop supports fps=0 or 60.');ctx.startLoop(callback,arg);};
  api.emscripten_set_main_loop=(callback,fps,simulate)=>mainLoop(callback,undefined,fps,simulate);
  api.emscripten_set_main_loop_arg=(callback,arg,fps,simulate)=>mainLoop(callback,arg,fps,simulate);
  api.emscripten_cancel_main_loop=()=>ctx.cancelLoop();
  const keyCode=key=>{const special={Escape:256,Enter:257,Tab:258,Backspace:259,Insert:260,Delete:261,ArrowRight:262,ArrowLeft:263,ArrowDown:264,ArrowUp:265,PageUp:266,PageDown:267,Home:268,End:269};if(special[key])return special[key];if(/^F([1-9]|1[0-9]|2[0-5])$/.test(key))return 289+Number(key.slice(1));return typeof key==='number'?key:typeof key==='string'&&key.length===1?key.toUpperCase().charCodeAt(0):-1;};
  function handleEvent(e){if(!window)return;const mods=e.modifiers||0;if(['keyboard','keydown','keyup'].includes(e.type)){const release=e.type==='keyup'||e.state===1,key=keyCode(e.key);if(key>=0)events.push({type:'key',args:[key,0,release?0:e.repeat?2:1,mods]});if(!release&&typeof e.key==='string'&&e.key.length===1)events.push({type:'char',args:[e.key.codePointAt(0)]});}else if(e.type==='mouse'){events.push({type:'cursor',args:[e.x||0,e.y||0]});events.push({type:'mouse',args:[e.button===2?1:e.button===1?2:0,e.state===0?1:0,mods]});}else if(['motion','passive'].includes(e.type))events.push({type:'cursor',args:[e.x||0,e.y||0]});}
  function resizeEvent(width,height){if(window){events.push({type:'framebuffer',args:[width,height]},{type:'size',args:[width,height]});}}
  return {handleEvent,resizeEvent};
}
