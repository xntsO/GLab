import {installExtras} from './graphics-extras.js?v=5';
import {installGlfw} from './graphics-glfw.js?v=5';
// A browser implementation of the OpenGL 1.x commands used by COMP461.
// Positions and normals follow the fixed-function matrix and lighting rules.
export const GL = Object.freeze({ POINTS:0, LINES:1, LINE_LOOP:2, LINE_STRIP:3, TRIANGLES:4, TRIANGLE_STRIP:5, TRIANGLE_FAN:6, QUADS:7, QUAD_STRIP:8, POLYGON:9, MODELVIEW:5888, PROJECTION:5889, COLOR_BUFFER_BIT:16384, DEPTH_BUFFER_BIT:256, DEPTH_TEST:2929, LIGHTING:2896, LIGHT0:16384, NORMALIZE:2977, COLOR_MATERIAL:2903, LINE_STIPPLE:2852, BLEND:3042, CULL_FACE:2884, FLAT:7424, SMOOTH:7425, POINT:6912, LINE:6913, FILL:6914, FRONT:1028, BACK:1029, FRONT_AND_BACK:1032, AMBIENT:4608, DIFFUSE:4609, SPECULAR:4610, POSITION:4611, SHININESS:5633, EMISSION:5632, AMBIENT_AND_DIFFUSE:5634 });
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{let n=0;for(let k=0;k<4;k++)n+=a[k*4+i%4]*b[Math.floor(i/4)*4+k];return n;});
const transform=(m,v)=>Array.from({length:4},(_,r)=>m[r]*v[0]+m[r+4]*v[1]+m[r+8]*v[2]+m[r+12]*v[3]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
function normalMatrix(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],d=dot(a,cross(b,c));return d?[...cross(b,c).map(x=>x/d),...cross(c,a).map(x=>x/d),...cross(a,b).map(x=>x/d)]:[1,0,0,0,1,0,0,0,1];}

export function createGraphics(canvas,hooks={}) {
  const schedule=globalThis.requestAnimationFrame?.bind(globalThis)||(fn=>setTimeout(fn,16));
  const cancel=globalThis.cancelAnimationFrame?.bind(globalThis)||clearTimeout;
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:true});
  if(!gl)throw new Error('WebGL is unavailable. Enable browser hardware acceleration to run OpenGL programs.');
  const makeShader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();
  gl.attachShader(program,makeShader(gl.VERTEX_SHADER,'attribute vec4 aPosition; attribute vec4 aColor; uniform float uPointSize; varying vec4 vColor; void main(){ gl_Position=aPosition; gl_PointSize=uPointSize; vColor=aColor; }'));
  gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec4 vColor; void main(){ gl_FragColor=vColor; }'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const buffer=gl.createBuffer(),pLoc=gl.getAttribLocation(program,'aPosition'),cLoc=gl.getAttribLocation(program,'aColor'),pointLoc=gl.getUniformLocation(program,'uPointSize');
  let memory,table,stopped=false,running=false,raf=0,pending=true,mode=GL.MODELVIEW,beginMode=null,vertices=[],color=[1,1,1,1],normal=[0,0,1],error=0,pointSize=1,lineWidth=1,shade=GL.SMOOTH,polygonMode=GL.FILL,stippleFactor=1,stipplePattern=65535,windowWidth=640,windowHeight=480,displayMode=0,currentMenu=0,menuNode,mouseDown=false;
  const matrices={[GL.MODELVIEW]:[identity()],[GL.PROJECTION]:[identity()]},enabled=new Set(),callbacks={},timers=new Set(),listeners=[],menus=new Map(),attachedMenus=new Map(),created=performance.now();
  const stats={frames:0,drawCalls:0,vertices:0,lastFrameMs:0,width:canvas.width,height:canvas.height};
  const material={ambient:[.2,.2,.2,1],diffuse:[.8,.8,.8,1],specular:[0,0,0,1],emission:[0,0,0,1],shininess:0};
  let globalAmbient=[.2,.2,.2,1],colorMaterial=GL.AMBIENT_AND_DIFFUSE,localViewer=false;
  const lights=Array.from({length:8},(_,i)=>({ambient:[0,0,0,1],diffuse:i?[0,0,0,1]:[1,1,1,1],specular:i?[0,0,0,1]:[1,1,1,1],position:[0,0,1,0],spotDirection:[0,0,-1],spotCutoff:180,spotExponent:0,constant:1,linear:0,quadratic:0}));
  let viewport=[0,0,canvas.width,canvas.height],modifiers=0,glfw;
  const fail=(message,code=1280)=>{error ||= code;hooks.onDiagnostic?.(message);throw new Error(message);};
  const current=()=>matrices[mode][matrices[mode].length-1];
  const mult=m=>{const s=matrices[mode];s[s.length-1]=multiply(current(),m);};
  const floats=(ptr,n)=>{if(!memory)throw new Error('OpenGL runtime memory is not attached.');return Array.from(new Float32Array(memory.buffer,ptr,n));};
  const string=ptr=>{const bytes=new Uint8Array(memory.buffer);let end=ptr;while(bytes[end]&&end<bytes.length)end++;return new TextDecoder().decode(bytes.subarray(ptr,end));};
  const invoke=(index,...args)=>{if(!index||stopped)return;try{table.get(index)(...args);}catch(e){stop();if(e.isProgramExit)return;hooks.onError?.(e);if(!hooks.onError)console.error(e);}};
  function litColor(position,n,col) {
    if(!enabled.has(GL.LIGHTING))return col;
    const mv=matrices[GL.MODELVIEW].at(-1),eye=transform(mv,position),nm=normalMatrix(mv);
    let nn=[nm[0]*n[0]+nm[3]*n[1]+nm[6]*n[2],nm[1]*n[0]+nm[4]*n[1]+nm[7]*n[2],nm[2]*n[0]+nm[5]*n[1]+nm[8]*n[2]];
    if(enabled.has(GL.NORMALIZE))nn=normalize(nn);
    const mat={...material};if(enabled.has(GL.COLOR_MATERIAL)){if(colorMaterial===GL.AMBIENT||colorMaterial===GL.AMBIENT_AND_DIFFUSE)mat.ambient=col;if(colorMaterial===GL.DIFFUSE||colorMaterial===GL.AMBIENT_AND_DIFFUSE)mat.diffuse=col;if(colorMaterial===GL.SPECULAR)mat.specular=col;if(colorMaterial===GL.EMISSION)mat.emission=col;}
    const out=mat.emission.slice(0,3).map((x,i)=>x+mat.ambient[i]*globalAmbient[i]);
    for(let j=0;j<8;j++){if(!enabled.has(GL.LIGHT0+j))continue;const l=lights[j];let lv=l.position.slice(0,3),attenuation=1;
      if(l.position[3]){lv=subtract(lv.map(v=>v/l.position[3]),eye.slice(0,3));const d=Math.hypot(...lv);attenuation=1/(l.constant+l.linear*d+l.quadratic*d*d);}
      lv=normalize(lv);if(l.spotCutoff!==180){const cosine=dot(lv.map(v=>-v),normalize(l.spotDirection));attenuation*=cosine<Math.cos(l.spotCutoff*Math.PI/180)?0:Math.pow(Math.max(0,cosine),l.spotExponent);}
      const diffuse=Math.max(0,dot(nn,lv)),view=localViewer?normalize(eye.slice(0,3).map(v=>-v)):[0,0,1],half=normalize(lv.map((v,i)=>v+view[i])),specular=diffuse>0?Math.pow(Math.max(0,dot(nn,half)),mat.shininess):0;
      for(let i=0;i<3;i++)out[i]+=attenuation*(mat.ambient[i]*l.ambient[i]+mat.diffuse[i]*l.diffuse[i]*diffuse+mat.specular[i]*l.specular[i]*specular);
    }return [...out.map(v=>Math.min(1,Math.max(0,v))),mat.diffuse[3]];
  }
  const vertex=(x,y,z=0,w=1)=>{if(beginMode===null)fail('glVertex requires glBegin/glEnd.',1282);const p=[x,y,z,w];vertices.push({p,c:litColor(p,normal,color)});if(vertices.length>1000000)fail('A drawing batch exceeded one million vertices.');};
  function draw(mode,items){if(!items.length)return;const data=new Float32Array(items.length*8);items.forEach((v,i)=>{data.set(v.p,i*8);data.set(v.c,i*8+4);});gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STREAM_DRAW);gl.enableVertexAttribArray(pLoc);gl.enableVertexAttribArray(cLoc);gl.vertexAttribPointer(pLoc,4,gl.FLOAT,false,32,0);gl.vertexAttribPointer(cLoc,4,gl.FLOAT,false,32,16);gl.uniform1f(pointLoc,pointSize);gl.drawArrays(mode,0,items.length);stats.drawCalls++;stats.vertices+=items.length;}
  function drawLines(pairs,reset=false){const out=[];let distance=0;for(const [a,b] of pairs){if(reset)distance=0;if(a.p[3]<=0||b.p[3]<=0)continue;const dx=(b.p[0]/b.p[3]-a.p[0]/a.p[3])*viewport[2]/2,dy=(b.p[1]/b.p[3]-a.p[1]/a.p[3])*viewport[3]/2,length=Math.hypot(dx,dy);if(!length)continue;
    const segments=[];if(enabled.has(GL.LINE_STIPPLE)){let start=null;for(let p=0;p<=length;p++){const on=p<length&&((stipplePattern>> (Math.floor((distance+p)/stippleFactor)%16))&1);if(on&&start===null)start=p;if(!on&&start!==null){segments.push([start/length,Math.min(p,length)/length]);start=null;}}}else segments.push([0,1]);distance+=length;
    for(const [t0,t1] of segments){const mix=t=>({p:a.p.map((x,i)=>x+(b.p[i]-x)*t),c:a.c.map((x,i)=>x+(b.c[i]-x)*t)}),u=mix(t0),v=mix(t1);const ox=-dy/length*lineWidth/viewport[2],oy=dx/length*lineWidth/viewport[3];const offset=(v,s)=>({p:[v.p[0]+s*ox*v.p[3],v.p[1]+s*oy*v.p[3],v.p[2],v.p[3]],c:v.c});out.push(offset(u,1),offset(u,-1),offset(v,1),offset(v,1),offset(u,-1),offset(v,-1));}
  }draw(gl.TRIANGLES,out);}
  function end(){if(beginMode===null)fail('glEnd called without glBegin.',1282);const primitive=beginMode;beginMode=null;const mvp=multiply(matrices[GL.PROJECTION].at(-1),matrices[GL.MODELVIEW].at(-1));const v=vertices.map(v=>({p:transform(mvp,v.p),c:v.c}));vertices=[];
    const faces=[],pairs=[];const face=indices=>faces.push(indices.map(i=>v[i]));
    if(primitive===GL.POINTS){draw(gl.POINTS,v);return;}
    if(primitive===GL.LINES){for(let i=0;i+1<v.length;i+=2)pairs.push([v[i],v[i+1]]);}
    else if(primitive===GL.LINE_STRIP||primitive===GL.LINE_LOOP){for(let i=0;i+1<v.length;i++)pairs.push([v[i],v[i+1]]);if(primitive===GL.LINE_LOOP&&v.length>1)pairs.push([v.at(-1),v[0]]);}
    else if(primitive===GL.TRIANGLES){for(let i=0;i+2<v.length;i+=3)face([i,i+1,i+2]);}
    else if(primitive===GL.TRIANGLE_STRIP){for(let i=2;i<v.length;i++)face(i%2?[i-1,i-2,i]:[i-2,i-1,i]);}
    else if(primitive===GL.TRIANGLE_FAN){for(let i=2;i<v.length;i++)face([0,i-1,i]);}
    else if(primitive===GL.QUADS){for(let i=0;i+3<v.length;i+=4)face([i,i+1,i+2,i+3]);}
    else if(primitive===GL.QUAD_STRIP){for(let i=0;i+3<v.length;i+=2)face([i,i+1,i+3,i+2]);}
    else if(primitive===GL.POLYGON){if(v.length>=3)faces.push(v);}
    else fail(`Unsupported glBegin mode ${primitive}.`);
    const triangles=[],points=[];for(let f of faces){if(shade===GL.FLAT){const c=f.at(-1).c;f=f.map(x=>({p:x.p,c}));}if(polygonMode===GL.LINE){for(let i=0;i<f.length;i++)pairs.push([f[i],f[(i+1)%f.length]]);}else if(polygonMode===GL.POINT)points.push(...f);else for(let i=2;i<f.length;i++)triangles.push(f[0],f[i-1],f[i]);}
    draw(gl.TRIANGLES,triangles);draw(gl.POINTS,points);drawLines(pairs,primitive===GL.LINES);
  }
  function shape(wire,fn){const old=polygonMode;if(wire)polygonMode=GL.LINE;try{fn();}finally{polygonMode=old;}}
  function grid(n,m,point,wire){n=Math.max(3,Math.min(200,n|0));m=Math.max(1,Math.min(200,m|0));shape(wire,()=>{api.glBegin(GL.QUADS);for(let j=0;j<m;j++)for(let i=0;i<n;i++)for(const [u,v]of[[i/n,j/m],[(i+1)/n,j/m],[(i+1)/n,(j+1)/m],[i/n,(j+1)/m]]){const p=point(u,v);normal=p.n;vertex(...p.p);}end();});}
  const sphere=(r,slices,stacks,wire)=>grid(slices,stacks,(u,v)=>{const t=u*2*Math.PI,p=(1-v)*Math.PI,n=[Math.sin(p)*Math.cos(t),Math.sin(p)*Math.sin(t),Math.cos(p)];return {p:n.map(x=>x*r),n};},wire);
  const torus=(inner,outer,sides,rings,wire)=>grid(rings,sides,(u,v)=>{const a=u*2*Math.PI,b=v*2*Math.PI,n=[Math.cos(a)*Math.cos(b),Math.sin(a)*Math.cos(b),Math.sin(b)];return {p:[(outer+inner*Math.cos(b))*Math.cos(a),(outer+inner*Math.cos(b))*Math.sin(a),inner*Math.sin(b)],n};},wire);
  function cone(base,height,slices,stacks,wire){grid(slices,stacks,(u,v)=>{const a=u*2*Math.PI;return {p:[base*(1-v)*Math.cos(a),base*(1-v)*Math.sin(a),height*v],n:normalize([height*Math.cos(a),height*Math.sin(a),base])};},wire);shape(wire,()=>{normal=[0,0,-1];api.glBegin(GL.TRIANGLE_FAN);vertex(0,0,0);for(let i=slices;i>=0;i--)vertex(base*Math.cos(i*2*Math.PI/slices),base*Math.sin(i*2*Math.PI/slices),0);end();});}
  function cube(size,wire){const s=size/2,positions=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]],faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]],normals=[[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];shape(wire,()=>{api.glBegin(GL.QUADS);faces.forEach((f,i)=>{normal=normals[i];f.forEach(j=>vertex(...positions[j]));});end();});}
  function teapot(size,wire){const bern=t=>[(1-t)**3,3*t*(1-t)**2,3*t*t*(1-t),t**3],der=t=>[-3*(1-t)**2,3*(1-t)**2-6*t*(1-t),6*t*(1-t)-3*t*t,3*t*t];for(let patch=0;patch<32;patch++){grid(wire?8:12,wire?8:12,(u,v)=>{const bu=bern(u),bv=bern(v),du=der(u),dv=der(v),p=[0,0,0],su=[0,0,0],sv=[0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++){const k=TEAPOT_PATCHES[patch*16+i*4+j]*3;for(let a=0;a<3;a++){const value=TEAPOT_VERTICES[k+a];p[a]+=value*bu[i]*bv[j];su[a]+=value*du[i]*bv[j];sv[a]+=value*bu[i]*dv[j];}}const n=normalize(cross(sv,su));return {p:[p[0]*size/2,(p[2]-1.575)*size/2,-p[1]*size/2],n:[n[0],n[2],-n[1]]};},wire);}}
  function frame(){raf=0;if(stopped||!running)return;const start=performance.now();if(callbacks.idle)invoke(callbacks.idle);if(stopped||!running)return;if((pending||callbacks.isGlfw)&&callbacks.display){pending=false;if(callbacks.displayArg===undefined)invoke(callbacks.display);else invoke(callbacks.display,callbacks.displayArg);if(stopped||!running)return;stats.frames++;stats.lastFrameMs=performance.now()-start;hooks.onFrame?.({...stats});}if(!stopped&&running)raf=schedule(frame);}
  function cancelLoop(){const wasRunning=running;running=false;if(raf)cancel(raf);raf=0;if(wasRunning)queueMicrotask(()=>hooks.onLoopEnd?.());}
  function resize(width=canvas.width,height=canvas.height){if(stopped)return;canvas.width=Math.max(1,width|0);canvas.height=Math.max(1,height|0);viewport=[0,0,canvas.width,canvas.height];gl.viewport(...viewport);stats.width=canvas.width;stats.height=canvas.height;hooks.onResize?.({width:canvas.width,height:canvas.height});if(callbacks.reshape)invoke(callbacks.reshape,canvas.width,canvas.height);glfw?.resizeEvent(canvas.width,canvas.height);pending=true;}
  function stop(){if(stopped)return;stopped=true;running=false;if(raf)cancel(raf);timers.forEach(clearTimeout);listeners.forEach(([target,name,fn])=>target.removeEventListener(name,fn));menuNode?.remove();gl.deleteBuffer(buffer);gl.deleteProgram(program);}
  const on=(target,name,fn)=>{target.addEventListener(name,fn);listeners.push([target,name,fn]);};
  const mouseXY=e=>{const r=canvas.getBoundingClientRect();return [Math.round((e.clientX-r.left)*canvas.width/r.width),Math.round((e.clientY-r.top)*canvas.height/r.height)];};
  const button=e=>e.button===1?1:e.button===2?2:0;
  function showMenu(id,x,y){menuNode?.remove();const menu=menus.get(id);if(!menu)return;if(hooks.onMenu){hooks.onMenu({menu:id,items:menu.items,x,y});return;}if(!globalThis.document)return;menuNode=document.createElement('div');menuNode.setAttribute('role','menu');menuNode.style.cssText=`position:fixed;z-index:9999;left:${x}px;top:${y}px;min-width:180px;background:#172235;color:#fff;padding:5px;border:1px solid #637086;border-radius:7px;box-shadow:0 6px 22px #0008;font:14px sans-serif`;menu.items.forEach(item=>{const b=document.createElement('button');b.textContent=item.label+(item.sub?' ›':'');b.setAttribute('role','menuitem');b.style.cssText='display:block;width:100%;text-align:left;padding:9px 12px;border:0;background:transparent;color:inherit;cursor:pointer';b.addEventListener('mouseenter',()=>b.style.background='#33445e');b.addEventListener('mouseleave',()=>b.style.background='transparent');b.addEventListener('click',()=>{if(item.sub)showMenu(item.sub,x+160,y);else{menuNode.remove();invoke(menu.callback,item.value);pending=true;}});menuNode.appendChild(b);});document.body.appendChild(menuNode);menuNode.querySelector('button')?.focus();}
  if(canvas.addEventListener){canvas.tabIndex=0;on(canvas,'contextmenu',e=>e.preventDefault());on(canvas,'mousedown',e=>{e.preventDefault();canvas.focus();mouseDown=true;const b=button(e);if(attachedMenus.has(b))showMenu(attachedMenus.get(b),e.clientX,e.clientY);else invoke(callbacks.mouse,b,0,...mouseXY(e));});on(globalThis.window||canvas,'mouseup',e=>{if(mouseDown)invoke(callbacks.mouse,button(e),1,...mouseXY(e));mouseDown=false;});on(canvas,'mousemove',e=>invoke(mouseDown?callbacks.motion:callbacks.passive,...mouseXY(e)));
  }
  const special={F1:1,F2:2,F3:3,F4:4,F5:5,F6:6,F7:7,F8:8,F9:9,F10:10,F11:11,F12:12,ArrowLeft:100,ArrowUp:101,ArrowRight:102,ArrowDown:103,PageUp:104,PageDown:105,Home:106,End:107,Insert:108};
  if(canvas.addEventListener)for(const event of ['keydown','keyup'])on(canvas,event,e=>{modifiers=(e.shiftKey?1:0)|(e.ctrlKey?2:0)|(e.altKey?4:0);let key=special[e.key];if(key){e.preventDefault();invoke(callbacks[event==='keydown'?'special':'specialUp'],key,0,0);}else{key=e.key==='Escape'?27:e.key==='Enter'?13:e.key==='Backspace'?8:e.key==='Tab'?9:e.key.length===1?e.key.charCodeAt(0):0;if(key){e.preventDefault();invoke(callbacks[event==='keydown'?'keyboard':'keyboardUp'],key,0,0);}}});
  if(globalThis.document)on(document,'pointerdown',e=>{if(menuNode&&!menuNode.contains(e.target))menuNode.remove();});
  const api={
    glBegin:m=>{if(beginMode!==null)fail('Nested glBegin calls are invalid.',1282);if(m<0||m>9)fail(`Unsupported primitive ${m}.`);beginMode=m;vertices=[];},glEnd:end,
    glVertex2f:(x,y)=>vertex(x,y),glVertex3f:(x,y,z)=>vertex(x,y,z),glVertex4f:vertex,glNormal3f:(x,y,z)=>normal=[x,y,z],glNormal3fv:p=>normal=floats(p,3),
    glColor3f:(r,g,b)=>color=[r,g,b,1],glColor4f:(r,g,b,a)=>color=[r,g,b,a],glColor3ub:(r,g,b)=>color=[r/255,g/255,b/255,1],glColor4ub:(r,g,b,a)=>color=[r/255,g/255,b/255,a/255],glColor3fv:p=>color=[...floats(p,3),1],glColor4fv:p=>color=floats(p,4),
    glClearColor:(r,g,b,a)=>gl.clearColor(r,g,b,a),glClear:mask=>{if(mask&~(GL.COLOR_BUFFER_BIT|GL.DEPTH_BUFFER_BIT))fail('Only color and depth clear buffers are available.');gl.clear(mask);},glClearDepth:d=>gl.clearDepth(d),glFlush:()=>gl.flush(),glFinish:()=>gl.finish(),
    glEnable:cap=>{if([GL.DEPTH_TEST,GL.BLEND,GL.CULL_FACE,3089].includes(cap))gl.enable(cap);else if(![GL.LIGHTING,GL.NORMALIZE,GL.COLOR_MATERIAL,GL.LINE_STIPPLE,...lights.map((_,i)=>GL.LIGHT0+i)].includes(cap))fail(`glEnable capability 0x${cap.toString(16)} is unsupported. Browser antialiasing is selected when creating the canvas.`);enabled.add(cap);},
    glDisable:cap=>{if([GL.DEPTH_TEST,GL.BLEND,GL.CULL_FACE,3089].includes(cap))gl.disable(cap);else if(![GL.LIGHTING,GL.NORMALIZE,GL.COLOR_MATERIAL,GL.LINE_STIPPLE,...lights.map((_,i)=>GL.LIGHT0+i)].includes(cap))fail(`glDisable capability 0x${cap.toString(16)} is unsupported.`);enabled.delete(cap);},glIsEnabled:cap=>{if(![GL.DEPTH_TEST,GL.BLEND,GL.CULL_FACE,3089,GL.LIGHTING,GL.NORMALIZE,GL.COLOR_MATERIAL,GL.LINE_STIPPLE,...lights.map((_,i)=>GL.LIGHT0+i)].includes(cap))fail(`glIsEnabled capability 0x${cap.toString(16)} is unsupported.`);return enabled.has(cap)?1:0;},
    glMatrixMode:m=>{if(!matrices[m])fail(`Matrix mode ${m} is unsupported.`);mode=m;},glLoadIdentity:()=>matrices[mode][matrices[mode].length-1]=identity(),glLoadMatrixf:p=>matrices[mode][matrices[mode].length-1]=floats(p,16),glMultMatrixf:p=>mult(floats(p,16)),
    glPushMatrix:()=>{if(matrices[mode].length>=64)fail('Matrix stack overflow.',1283);matrices[mode].push(current().slice());},glPopMatrix:()=>{if(matrices[mode].length<=1)fail('Matrix stack underflow.',1284);matrices[mode].pop();},
    glTranslatef:(x,y,z)=>mult([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]),glScalef:(x,y,z)=>mult([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]),
    glRotatef:(angle,x,y,z)=>{if(!Math.hypot(x,y,z))return;[x,y,z]=normalize([x,y,z]);const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),t=1-c;mult([t*x*x+c,t*x*y+s*z,t*x*z-s*y,0,t*x*y-s*z,t*y*y+c,t*y*z+s*x,0,t*x*z+s*y,t*y*z-s*x,t*z*z+c,0,0,0,0,1]);},
    glOrtho:(l,r,b,t,n,f)=>{if(r===l||b===t||n===f)fail('glOrtho has a zero extent.',1281);mult([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);},
    glFrustum:(l,r,b,t,n,f)=>{if(n<=0||f<=0||r===l||b===t||n===f)fail('glFrustum requires positive clipping distances and nonzero extents.',1281);mult([2*n/(r-l),0,0,0,0,2*n/(t-b),0,0,(r+l)/(r-l),(t+b)/(t-b),-(f+n)/(f-n),-1,0,0,-2*f*n/(f-n),0]);},
    glViewport:(x,y,w,h)=>{viewport=[x,y,w,h];gl.viewport(x,y,w,h);},glPointSize:s=>pointSize=Math.max(1,s),glLineWidth:s=>lineWidth=Math.max(1,s),glLineStipple:(factor,pattern)=>{stippleFactor=Math.max(1,Math.min(256,factor));stipplePattern=pattern&65535;},glShadeModel:m=>{if(m!==GL.FLAT&&m!==GL.SMOOTH)fail('Unsupported shading model.');shade=m;},glPolygonMode:(face,m)=>{if(![GL.POINT,GL.LINE,GL.FILL].includes(m))fail('Unsupported polygon mode.');polygonMode=m;},
    glDepthFunc:f=>gl.depthFunc(f),glDepthMask:b=>gl.depthMask(Boolean(b)),glBlendFunc:(s,d)=>gl.blendFunc(s,d),glCullFace:f=>gl.cullFace(f),glFrontFace:f=>gl.frontFace(f),glScissor:(x,y,w,h)=>gl.scissor(x,y,w,h),
    glLightfv:(which,pname,p)=>{const l=lights[which-GL.LIGHT0];if(!l)fail(`Unsupported light ${which}.`);const key={4608:'ambient',4609:'diffuse',4610:'specular',4611:'position',4612:'spotDirection'}[pname];if(key){const value=floats(p,pname===4612?3:4);l[key]=pname===4611?transform(matrices[GL.MODELVIEW].at(-1),value):value;}else api.glLightf(which,pname,floats(p,1)[0]);},
    glLightf:(which,pname,value)=>{const l=lights[which-GL.LIGHT0],key={4613:'spotExponent',4614:'spotCutoff',4615:'constant',4616:'linear',4617:'quadratic'}[pname];if(!l||!key)fail(`Unsupported glLight parameter ${pname}.`);l[key]=value;},
    glMaterialfv:(face,pname,p)=>{const key={4608:'ambient',4609:'diffuse',4610:'specular',5632:'emission'}[pname];if(key)material[key]=floats(p,4);else if(pname===5634)material.ambient=material.diffuse=floats(p,4);else if(pname===5633)material.shininess=floats(p,1)[0];else fail(`Unsupported material parameter ${pname}.`);},
    glMaterialf:(face,pname,value)=>{if(pname!==GL.SHININESS)fail(`Unsupported scalar material parameter ${pname}.`);material.shininess=Math.max(0,Math.min(128,value));},glLightModelfv:(pname,p)=>{if(pname===2899)globalAmbient=floats(p,4);else api.glLightModeli(pname,floats(p,1)[0]);},glLightModeli:(pname,value)=>{if(pname===2897)localViewer=Boolean(value);else if(pname===2898){if(value)fail('Two-sided lighting is unsupported.');}else fail(`Unsupported light model ${pname}.`);},glColorMaterial:(face,pname)=>colorMaterial=pname,
    glGetError:()=>{const e=error||gl.getError();error=0;return e;},glGetFloatv:(pname,p)=>{const v=pname===2982?matrices[GL.MODELVIEW].at(-1):pname===2983?matrices[GL.PROJECTION].at(-1):pname===2816?color:pname===2849?[lineWidth]:pname===2833?[pointSize]:null;if(!v)fail(`Unsupported glGetFloatv parameter ${pname}.`);new Float32Array(memory.buffer,p,v.length).set(v);},glGetIntegerv:(pname,p)=>{const v=pname===2978?viewport:pname===2976?[mode]:null;if(!v)fail(`Unsupported glGetIntegerv parameter ${pname}.`);new Int32Array(memory.buffer,p,v.length).set(v);},
    glRectf:(x1,y1,x2,y2)=>{api.glBegin(GL.QUADS);vertex(x1,y1);vertex(x2,y1);vertex(x2,y2);vertex(x1,y2);end();},
    gluOrtho2D:(l,r,b,t)=>api.glOrtho(l,r,b,t,-1,1),gluPerspective:(fovy,aspect,n,f)=>{const top=n*Math.tan(fovy*Math.PI/360);api.glFrustum(-top*aspect,top*aspect,-top,top,n,f);},
    gluLookAt:(ex,ey,ez,cx,cy,cz,ux,uy,uz)=>{const f=normalize([cx-ex,cy-ey,cz-ez]),s=normalize(cross(f,[ux,uy,uz])),u=cross(s,f);mult([s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,0,0,0,1]);api.glTranslatef(-ex,-ey,-ez);},
    glutInit:()=>{},glutInitDisplayMode:m=>{if(m&(1|4|32|256|512))fail('GLUT color-index, accumulation, stencil and stereo buffers are unavailable. Use GLUT_RGB | GLUT_DOUBLE | GLUT_DEPTH.');displayMode=m;},glutInitWindowSize:(w,h)=>{windowWidth=w;windowHeight=h;},glutInitWindowPosition:()=>hooks.onDiagnostic?.('GLUT window position is ignored because output stays in the browser canvas.'),glutCreateWindow:p=>{hooks.onTitle?.(string(p));resize(windowWidth,windowHeight);return 1;},glutSetWindowTitle:p=>hooks.onTitle?.(string(p)),glutGetWindow:()=>1,
    glutDisplayFunc:p=>callbacks.display=p,glutReshapeFunc:p=>callbacks.reshape=p,glutKeyboardFunc:p=>callbacks.keyboard=p,glutKeyboardUpFunc:p=>callbacks.keyboardUp=p,glutSpecialFunc:p=>callbacks.special=p,glutSpecialUpFunc:p=>callbacks.specialUp=p,glutMouseFunc:p=>callbacks.mouse=p,glutMotionFunc:p=>callbacks.motion=p,glutPassiveMotionFunc:p=>callbacks.passive=p,glutIdleFunc:p=>callbacks.idle=p,
    glutMainLoop:()=>{running=true;if(callbacks.reshape)invoke(callbacks.reshape,canvas.width,canvas.height);pending=true;if(!raf)raf=schedule(frame);},glutLeaveMainLoop:()=>{cancelLoop();stop();},glutPostRedisplay:()=>pending=true,glutSwapBuffers:()=>gl.flush(),
    glutTimerFunc:(ms,callback,value)=>{const id=setTimeout(()=>{timers.delete(id);invoke(callback,value);},ms);timers.add(id);},glutGet:p=>{if(p===700)return Math.floor(performance.now()-created);if(p===102)return canvas.width;if(p===103)return canvas.height;if(p===104)return gl.getParameter(3410)+gl.getParameter(3411)+gl.getParameter(3412)+gl.getParameter(3413);if(p===105||p>=111&&p<=114)return 0;if(p>=106&&p<=110)return gl.getParameter({106:3414,107:3410,108:3411,109:3412,110:3413}[p]);if(p===115)return displayMode&2?1:0;if(p===116)return 1;if(p===200)return globalThis.screen?.width||canvas.width;if(p===201)return globalThis.screen?.height||canvas.height;if(p===500)return windowWidth;if(p===501)return windowHeight;fail(`Unsupported glutGet parameter ${p}.`);},glutGetModifiers:()=>modifiers,
    glutSolidSphere:(r,s,t)=>sphere(r,s,t,false),glutWireSphere:(r,s,t)=>sphere(r,s,t,true),glutSolidCube:s=>cube(s,false),glutWireCube:s=>cube(s,true),glutSolidTorus:(i,o,s,r)=>torus(i,o,s,r,false),glutWireTorus:(i,o,s,r)=>torus(i,o,s,r,true),glutSolidCone:(b,h,s,t)=>cone(b,h,s,t,false),glutWireCone:(b,h,s,t)=>cone(b,h,s,t,true),glutSolidTeapot:s=>teapot(s,false),glutWireTeapot:s=>teapot(s,true),
    glutCreateMenu:callback=>{const id=menus.size+1;menus.set(id,{callback,items:[]});currentMenu=id;return id;},glutSetMenu:id=>currentMenu=id,glutGetMenu:()=>currentMenu,glutAddMenuEntry:(p,value)=>{const menu=menus.get(currentMenu);if(!menu)fail('No active GLUT menu.');menu.items.push({label:string(p),value});},glutAddSubMenu:(p,sub)=>{const menu=menus.get(currentMenu);if(!menu)fail('No active GLUT menu.');menu.items.push({label:string(p),sub});},glutAttachMenu:button=>attachedMenus.set(button,currentMenu),glutDetachMenu:button=>attachedMenus.delete(button),glutDestroyMenu:id=>menus.delete(id),
  };
  for(const base of ['glVertex2','glVertex3','glColor3','glColor4','glNormal3'])for(const suffix of ['d','i','s'])api[base+suffix]=api[base+'f'];
  for(const base of ['glTranslate','glScale','glRotate'])api[base+'d']=api[base+'f'];api.glRecti=api.glRectf;api.glMateriali=api.glMaterialf;
  for(const [suffix,max]of [['i',2147483647],['s',32767],['b',127]]){api['glColor3'+suffix]=(r,g,b)=>api.glColor3f(Math.max(-1,r/max),Math.max(-1,g/max),Math.max(-1,b/max));api['glColor4'+suffix]=(r,g,b,a)=>api.glColor4f(Math.max(-1,r/max),Math.max(-1,g/max),Math.max(-1,b/max),Math.max(-1,a/max));}
  for(const [suffix,max]of [['i',2147483647],['s',32767]])api['glNormal3'+suffix]=(x,y,z)=>api.glNormal3f(Math.max(-1,x/max),Math.max(-1,y/max),Math.max(-1,z/max));
  const queryFloat=pname=>{const v=pname===2982?matrices[GL.MODELVIEW].at(-1):pname===2983?matrices[GL.PROJECTION].at(-1):pname===2816?color:pname===2849?[lineWidth]:pname===2833?[pointSize]:null;if(!v)fail(`Unsupported matrix/state query ${pname}.`);return v;};
  api.glGetFloatv=(pname,p)=>{const v=queryFloat(pname);new Float32Array(memory.buffer,p,v.length).set(v);};
  installExtras(api,{fail,memory:()=>memory,string,viewport:()=>viewport,color:()=>color,queryFloat,loadMatrix:m=>matrices[mode][matrices[mode].length-1]=m.slice(),multMatrix:mult,
    transformPosition:p=>transform(multiply(matrices[GL.PROJECTION].at(-1),matrices[GL.MODELVIEW].at(-1)),p),rasterColor:p=>litColor(p,normal,color),
    drawPixels:(pixels,z,c)=>{const out=[];for(const [x,y] of pixels){const item=(dx,dy)=>({p:[(x+dx-viewport[0])*2/viewport[2]-1,(y+dy-viewport[1])*2/viewport[3]-1,z,1],c});out.push(item(0,0),item(1,0),item(1,1),item(0,0),item(1,1),item(0,1));}const cull=enabled.has(GL.CULL_FACE);if(cull)gl.disable(GL.CULL_FACE);draw(gl.TRIANGLES,out);if(cull)gl.enable(GL.CULL_FACE);}
  });
  glfw=installGlfw(api,{fail,memory:()=>memory,string,invoke,resize,canvas,hooks,flush:()=>gl.flush(),created,startLoop:(callback,arg)=>{callbacks.display=callback;callbacks.displayArg=arg;callbacks.isGlfw=true;running=true;pending=true;if(!raf)raf=schedule(frame);},cancelLoop,isLoop:()=>running&&!stopped});
  function handleEvent(e){if(stopped)return;modifiers=e.modifiers||0;const x=e.x||0,y=e.y||0;switch(e.type){case 'resize':resize(e.width,e.height);break;case 'keyboard':case 'keydown':case 'keyup':{let key=e.key;if(typeof key==='string'){const specialKey=special[key];if(specialKey){invoke(callbacks[e.type==='keyup'?'specialUp':'special'],specialKey,x,y);break;}key=key==='Escape'?27:key==='Enter'?13:key==='Backspace'?8:key==='Tab'?9:key.length===1?key.charCodeAt(0):0;}if(key)invoke(callbacks[e.type==='keyup'||e.state===1?'keyboardUp':'keyboard'],key,x,y);break;}case 'special':invoke(callbacks[e.state===1?'specialUp':'special'],e.key,x,y);break;case 'mouse':if(e.state===0&&attachedMenus.has(e.button))showMenu(attachedMenus.get(e.button),x,y);else invoke(callbacks.mouse,e.button,e.state,x,y);break;case 'motion':invoke(callbacks.motion,x,y);break;case 'passive':invoke(callbacks.passive,x,y);break;case 'menuOpen':showMenu(e.menu,x,y);break;case 'menu':{const menu=menus.get(e.menu);if(menu)invoke(menu.callback,e.value);pending=true;break;}}}
  return {imports:{env:api},api,handleEvent:e=>{glfw.handleEvent(e);handleEvent(e);},attach(instance){const exports=instance.exports||instance;memory=exports.memory;table=exports.__indirect_function_table||exports.table;if(!memory||!table)throw new Error('The compiled module must export memory and its function table.');},stop,resize,get stats(){return {...stats};},get running(){return running&&!stopped;}};
}

/* Utah teapot control points from three.js TeapotGeometry.
https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/TeapotGeometry.js

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
const TEAPOT_PATCHES = [
			/*rim*/
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
			3, 16, 17, 18, 7, 19, 20, 21, 11, 22, 23, 24, 15, 25, 26, 27,
			18, 28, 29, 30, 21, 31, 32, 33, 24, 34, 35, 36, 27, 37, 38, 39,
			30, 40, 41, 0, 33, 42, 43, 4, 36, 44, 45, 8, 39, 46, 47, 12,
			/*body*/
			12, 13, 14, 15, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
			15, 25, 26, 27, 51, 60, 61, 62, 55, 63, 64, 65, 59, 66, 67, 68,
			27, 37, 38, 39, 62, 69, 70, 71, 65, 72, 73, 74, 68, 75, 76, 77,
			39, 46, 47, 12, 71, 78, 79, 48, 74, 80, 81, 52, 77, 82, 83, 56,
			56, 57, 58, 59, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
			59, 66, 67, 68, 87, 96, 97, 98, 91, 99, 100, 101, 95, 102, 103, 104,
			68, 75, 76, 77, 98, 105, 106, 107, 101, 108, 109, 110, 104, 111, 112, 113,
			77, 82, 83, 56, 107, 114, 115, 84, 110, 116, 117, 88, 113, 118, 119, 92,
			/*handle*/
			120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135,
			123, 136, 137, 120, 127, 138, 139, 124, 131, 140, 141, 128, 135, 142, 143, 132,
			132, 133, 134, 135, 144, 145, 146, 147, 148, 149, 150, 151, 68, 152, 153, 154,
			135, 142, 143, 132, 147, 155, 156, 144, 151, 157, 158, 148, 154, 159, 160, 68,
			/*spout*/
			161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176,
			164, 177, 178, 161, 168, 179, 180, 165, 172, 181, 182, 169, 176, 183, 184, 173,
			173, 174, 175, 176, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196,
			176, 183, 184, 173, 188, 197, 198, 185, 192, 199, 200, 189, 196, 201, 202, 193,
			/*lid*/
			203, 203, 203, 203, 204, 205, 206, 207, 208, 208, 208, 208, 209, 210, 211, 212,
			203, 203, 203, 203, 207, 213, 214, 215, 208, 208, 208, 208, 212, 216, 217, 218,
			203, 203, 203, 203, 215, 219, 220, 221, 208, 208, 208, 208, 218, 222, 223, 224,
			203, 203, 203, 203, 221, 225, 226, 204, 208, 208, 208, 208, 224, 227, 228, 209,
			209, 210, 211, 212, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240,
			212, 216, 217, 218, 232, 241, 242, 243, 236, 244, 245, 246, 240, 247, 248, 249,
			218, 222, 223, 224, 243, 250, 251, 252, 246, 253, 254, 255, 249, 256, 257, 258,
			224, 227, 228, 209, 252, 259, 260, 229, 255, 261, 262, 233, 258, 263, 264, 237,
			/*bottom*/
			265, 265, 265, 265, 266, 267, 268, 269, 270, 271, 272, 273, 92, 119, 118, 113,
			265, 265, 265, 265, 269, 274, 275, 276, 273, 277, 278, 279, 113, 112, 111, 104,
			265, 265, 265, 265, 276, 280, 281, 282, 279, 283, 284, 285, 104, 103, 102, 95,
			265, 265, 265, 265, 282, 286, 287, 266, 285, 288, 289, 270, 95, 94, 93, 92
		];
const TEAPOT_VERTICES = [
			1.4, 0, 2.4,
			1.4, - 0.784, 2.4,
			0.784, - 1.4, 2.4,
			0, - 1.4, 2.4,
			1.3375, 0, 2.53125,
			1.3375, - 0.749, 2.53125,
			0.749, - 1.3375, 2.53125,
			0, - 1.3375, 2.53125,
			1.4375, 0, 2.53125,
			1.4375, - 0.805, 2.53125,
			0.805, - 1.4375, 2.53125,
			0, - 1.4375, 2.53125,
			1.5, 0, 2.4,
			1.5, - 0.84, 2.4,
			0.84, - 1.5, 2.4,
			0, - 1.5, 2.4,
			- 0.784, - 1.4, 2.4,
			- 1.4, - 0.784, 2.4,
			- 1.4, 0, 2.4,
			- 0.749, - 1.3375, 2.53125,
			- 1.3375, - 0.749, 2.53125,
			- 1.3375, 0, 2.53125,
			- 0.805, - 1.4375, 2.53125,
			- 1.4375, - 0.805, 2.53125,
			- 1.4375, 0, 2.53125,
			- 0.84, - 1.5, 2.4,
			- 1.5, - 0.84, 2.4,
			- 1.5, 0, 2.4,
			- 1.4, 0.784, 2.4,
			- 0.784, 1.4, 2.4,
			0, 1.4, 2.4,
			- 1.3375, 0.749, 2.53125,
			- 0.749, 1.3375, 2.53125,
			0, 1.3375, 2.53125,
			- 1.4375, 0.805, 2.53125,
			- 0.805, 1.4375, 2.53125,
			0, 1.4375, 2.53125,
			- 1.5, 0.84, 2.4,
			- 0.84, 1.5, 2.4,
			0, 1.5, 2.4,
			0.784, 1.4, 2.4,
			1.4, 0.784, 2.4,
			0.749, 1.3375, 2.53125,
			1.3375, 0.749, 2.53125,
			0.805, 1.4375, 2.53125,
			1.4375, 0.805, 2.53125,
			0.84, 1.5, 2.4,
			1.5, 0.84, 2.4,
			1.75, 0, 1.875,
			1.75, - 0.98, 1.875,
			0.98, - 1.75, 1.875,
			0, - 1.75, 1.875,
			2, 0, 1.35,
			2, - 1.12, 1.35,
			1.12, - 2, 1.35,
			0, - 2, 1.35,
			2, 0, 0.9,
			2, - 1.12, 0.9,
			1.12, - 2, 0.9,
			0, - 2, 0.9,
			- 0.98, - 1.75, 1.875,
			- 1.75, - 0.98, 1.875,
			- 1.75, 0, 1.875,
			- 1.12, - 2, 1.35,
			- 2, - 1.12, 1.35,
			- 2, 0, 1.35,
			- 1.12, - 2, 0.9,
			- 2, - 1.12, 0.9,
			- 2, 0, 0.9,
			- 1.75, 0.98, 1.875,
			- 0.98, 1.75, 1.875,
			0, 1.75, 1.875,
			- 2, 1.12, 1.35,
			- 1.12, 2, 1.35,
			0, 2, 1.35,
			- 2, 1.12, 0.9,
			- 1.12, 2, 0.9,
			0, 2, 0.9,
			0.98, 1.75, 1.875,
			1.75, 0.98, 1.875,
			1.12, 2, 1.35,
			2, 1.12, 1.35,
			1.12, 2, 0.9,
			2, 1.12, 0.9,
			2, 0, 0.45,
			2, - 1.12, 0.45,
			1.12, - 2, 0.45,
			0, - 2, 0.45,
			1.5, 0, 0.225,
			1.5, - 0.84, 0.225,
			0.84, - 1.5, 0.225,
			0, - 1.5, 0.225,
			1.5, 0, 0.15,
			1.5, - 0.84, 0.15,
			0.84, - 1.5, 0.15,
			0, - 1.5, 0.15,
			- 1.12, - 2, 0.45,
			- 2, - 1.12, 0.45,
			- 2, 0, 0.45,
			- 0.84, - 1.5, 0.225,
			- 1.5, - 0.84, 0.225,
			- 1.5, 0, 0.225,
			- 0.84, - 1.5, 0.15,
			- 1.5, - 0.84, 0.15,
			- 1.5, 0, 0.15,
			- 2, 1.12, 0.45,
			- 1.12, 2, 0.45,
			0, 2, 0.45,
			- 1.5, 0.84, 0.225,
			- 0.84, 1.5, 0.225,
			0, 1.5, 0.225,
			- 1.5, 0.84, 0.15,
			- 0.84, 1.5, 0.15,
			0, 1.5, 0.15,
			1.12, 2, 0.45,
			2, 1.12, 0.45,
			0.84, 1.5, 0.225,
			1.5, 0.84, 0.225,
			0.84, 1.5, 0.15,
			1.5, 0.84, 0.15,
			- 1.6, 0, 2.025,
			- 1.6, - 0.3, 2.025,
			- 1.5, - 0.3, 2.25,
			- 1.5, 0, 2.25,
			- 2.3, 0, 2.025,
			- 2.3, - 0.3, 2.025,
			- 2.5, - 0.3, 2.25,
			- 2.5, 0, 2.25,
			- 2.7, 0, 2.025,
			- 2.7, - 0.3, 2.025,
			- 3, - 0.3, 2.25,
			- 3, 0, 2.25,
			- 2.7, 0, 1.8,
			- 2.7, - 0.3, 1.8,
			- 3, - 0.3, 1.8,
			- 3, 0, 1.8,
			- 1.5, 0.3, 2.25,
			- 1.6, 0.3, 2.025,
			- 2.5, 0.3, 2.25,
			- 2.3, 0.3, 2.025,
			- 3, 0.3, 2.25,
			- 2.7, 0.3, 2.025,
			- 3, 0.3, 1.8,
			- 2.7, 0.3, 1.8,
			- 2.7, 0, 1.575,
			- 2.7, - 0.3, 1.575,
			- 3, - 0.3, 1.35,
			- 3, 0, 1.35,
			- 2.5, 0, 1.125,
			- 2.5, - 0.3, 1.125,
			- 2.65, - 0.3, 0.9375,
			- 2.65, 0, 0.9375,
			- 2, - 0.3, 0.9,
			- 1.9, - 0.3, 0.6,
			- 1.9, 0, 0.6,
			- 3, 0.3, 1.35,
			- 2.7, 0.3, 1.575,
			- 2.65, 0.3, 0.9375,
			- 2.5, 0.3, 1.125,
			- 1.9, 0.3, 0.6,
			- 2, 0.3, 0.9,
			1.7, 0, 1.425,
			1.7, - 0.66, 1.425,
			1.7, - 0.66, 0.6,
			1.7, 0, 0.6,
			2.6, 0, 1.425,
			2.6, - 0.66, 1.425,
			3.1, - 0.66, 0.825,
			3.1, 0, 0.825,
			2.3, 0, 2.1,
			2.3, - 0.25, 2.1,
			2.4, - 0.25, 2.025,
			2.4, 0, 2.025,
			2.7, 0, 2.4,
			2.7, - 0.25, 2.4,
			3.3, - 0.25, 2.4,
			3.3, 0, 2.4,
			1.7, 0.66, 0.6,
			1.7, 0.66, 1.425,
			3.1, 0.66, 0.825,
			2.6, 0.66, 1.425,
			2.4, 0.25, 2.025,
			2.3, 0.25, 2.1,
			3.3, 0.25, 2.4,
			2.7, 0.25, 2.4,
			2.8, 0, 2.475,
			2.8, - 0.25, 2.475,
			3.525, - 0.25, 2.49375,
			3.525, 0, 2.49375,
			2.9, 0, 2.475,
			2.9, - 0.15, 2.475,
			3.45, - 0.15, 2.5125,
			3.45, 0, 2.5125,
			2.8, 0, 2.4,
			2.8, - 0.15, 2.4,
			3.2, - 0.15, 2.4,
			3.2, 0, 2.4,
			3.525, 0.25, 2.49375,
			2.8, 0.25, 2.475,
			3.45, 0.15, 2.5125,
			2.9, 0.15, 2.475,
			3.2, 0.15, 2.4,
			2.8, 0.15, 2.4,
			0, 0, 3.15,
			0.8, 0, 3.15,
			0.8, - 0.45, 3.15,
			0.45, - 0.8, 3.15,
			0, - 0.8, 3.15,
			0, 0, 2.85,
			0.2, 0, 2.7,
			0.2, - 0.112, 2.7,
			0.112, - 0.2, 2.7,
			0, - 0.2, 2.7,
			- 0.45, - 0.8, 3.15,
			- 0.8, - 0.45, 3.15,
			- 0.8, 0, 3.15,
			- 0.112, - 0.2, 2.7,
			- 0.2, - 0.112, 2.7,
			- 0.2, 0, 2.7,
			- 0.8, 0.45, 3.15,
			- 0.45, 0.8, 3.15,
			0, 0.8, 3.15,
			- 0.2, 0.112, 2.7,
			- 0.112, 0.2, 2.7,
			0, 0.2, 2.7,
			0.45, 0.8, 3.15,
			0.8, 0.45, 3.15,
			0.112, 0.2, 2.7,
			0.2, 0.112, 2.7,
			0.4, 0, 2.55,
			0.4, - 0.224, 2.55,
			0.224, - 0.4, 2.55,
			0, - 0.4, 2.55,
			1.3, 0, 2.55,
			1.3, - 0.728, 2.55,
			0.728, - 1.3, 2.55,
			0, - 1.3, 2.55,
			1.3, 0, 2.4,
			1.3, - 0.728, 2.4,
			0.728, - 1.3, 2.4,
			0, - 1.3, 2.4,
			- 0.224, - 0.4, 2.55,
			- 0.4, - 0.224, 2.55,
			- 0.4, 0, 2.55,
			- 0.728, - 1.3, 2.55,
			- 1.3, - 0.728, 2.55,
			- 1.3, 0, 2.55,
			- 0.728, - 1.3, 2.4,
			- 1.3, - 0.728, 2.4,
			- 1.3, 0, 2.4,
			- 0.4, 0.224, 2.55,
			- 0.224, 0.4, 2.55,
			0, 0.4, 2.55,
			- 1.3, 0.728, 2.55,
			- 0.728, 1.3, 2.55,
			0, 1.3, 2.55,
			- 1.3, 0.728, 2.4,
			- 0.728, 1.3, 2.4,
			0, 1.3, 2.4,
			0.224, 0.4, 2.55,
			0.4, 0.224, 2.55,
			0.728, 1.3, 2.55,
			1.3, 0.728, 2.55,
			0.728, 1.3, 2.4,
			1.3, 0.728, 2.4,
			0, 0, 0,
			1.425, 0, 0,
			1.425, 0.798, 0,
			0.798, 1.425, 0,
			0, 1.425, 0,
			1.5, 0, 0.075,
			1.5, 0.84, 0.075,
			0.84, 1.5, 0.075,
			0, 1.5, 0.075,
			- 0.798, 1.425, 0,
			- 1.425, 0.798, 0,
			- 1.425, 0, 0,
			- 0.84, 1.5, 0.075,
			- 1.5, 0.84, 0.075,
			- 1.5, 0, 0.075,
			- 1.425, - 0.798, 0,
			- 0.798, - 1.425, 0,
			0, - 1.425, 0,
			- 1.5, - 0.84, 0.075,
			- 0.84, - 1.5, 0.075,
			0, - 1.5, 0.075,
			0.798, - 1.425, 0,
			1.425, - 0.798, 0,
			0.84, - 1.5, 0.075,
			1.5, - 0.84, 0.075
		];
