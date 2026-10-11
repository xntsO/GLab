// Fixed-function compatibility routines. All pointers refer to the live Wasm memory.
export function installExtras(api,ctx) {
  const {fail}=ctx;
  const types={5120:[1,'getInt8',127],5121:[1,'getUint8',255],5122:[2,'getInt16',32767],5123:[2,'getUint16',65535],5124:[4,'getInt32',2147483647],5125:[4,'getUint32',4294967295],5126:[4,'getFloat32',0],5130:[8,'getFloat64',0]};
  const view=()=>new DataView(ctx.memory().buffer);
  const read=(ptr,type,n)=>{const t=types[type];if(!t)fail(`Unsupported array data type ${type}.`);if(ptr<0||n<0||ptr+n*t[0]>ctx.memory().buffer.byteLength)fail('A graphics array points outside WebAssembly memory.',1281);const v=view();return Array.from({length:n},(_,i)=>v[t[1]](ptr+i*t[0],true));};
  const count=n=>{if(!Number.isInteger(n)||n<0||n>1000000)fail('Graphics counts must be integers between zero and one million.',1281);};
  const arrays=new Map(),client=new Set();
  const array=(cap,size,type,stride,ptr)=>{if(!types[type]||!Number.isInteger(stride)||stride<0)fail('Invalid client-array type or stride.',1281);arrays.set(cap,{size,type,stride:stride||size*types[type][0],ptr});};
  const element=(cap,index)=>{const a=arrays.get(cap);if(!a)fail('Enable a client array only after setting its pointer.',1282);return read(a.ptr+index*a.stride,a.type,a.size);};
  api.glEnableClientState=cap=>{if(![32884,32885,32886].includes(cap))fail('Only vertex, normal and color client arrays are supported.');client.add(cap);};
  api.glDisableClientState=cap=>{if(![32884,32885,32886].includes(cap))fail('Only vertex, normal and color client arrays are supported.');client.delete(cap);};
  const isEnabled=api.glIsEnabled;api.glIsEnabled=cap=>[32884,32885,32886].includes(cap)?client.has(cap)?1:0:isEnabled(cap);
  api.glVertexPointer=(size,type,stride,ptr)=>{if(![2,3,4].includes(size)||![5122,5124,5126,5130].includes(type))fail('glVertexPointer requires 2, 3 or 4 short, int, float or double components.',1281);array(32884,size,type,stride,ptr);};
  api.glColorPointer=(size,type,stride,ptr)=>{if(![3,4].includes(size))fail('glColorPointer requires 3 or 4 components.',1281);array(32886,size,type,stride,ptr);};
  api.glNormalPointer=(type,stride,ptr)=>{if(![5120,5122,5124,5126,5130].includes(type))fail('Invalid normal array type.');array(32885,3,type,stride,ptr);};
  api.glArrayElement=index=>{
    count(index);
    for(const [cap,method] of [[32886,'glColor4f'],[32885,'glNormal3f']])if(client.has(cap)){const a=arrays.get(cap),v=element(cap,index),max=types[a.type][2];if(max)for(let j=0;j<v.length;j++)v[j]=Math.max(-1,v[j]/max);if(cap===32886&&v.length===3)v.push(1);api[method](...v);}
    if(client.has(32884)){const v=element(32884,index);api.glVertex4f(v[0],v[1],v[2]??0,v[3]??1);}
  };
  const drawIndices=(mode,indices)=>{if(!client.has(32884))fail('glDrawArrays/glDrawElements require an enabled GL_VERTEX_ARRAY.',1282);api.glBegin(mode);for(const i of indices)api.glArrayElement(i);api.glEnd();};
  api.glDrawArrays=(mode,first,n)=>{count(first);count(n);drawIndices(mode,Array.from({length:n},(_,i)=>first+i));};
  api.glDrawElements=(mode,n,type,ptr)=>{count(n);if(![5121,5123,5125].includes(type))fail('Element indices must be unsigned byte, short or int.');drawIndices(mode,read(ptr,type,n));};
  for(const [base,n] of [['glVertex2',2],['glVertex3',3],['glVertex4',4],['glNormal3',3],['glColor3',3],['glColor4',4]])for(const [suffix,type]of[['fv',5126],['dv',5130],['iv',5124],['sv',5122]])api[base+suffix]=p=>api[base+suffix[0]](...read(p,type,n));
  api.glVertex4d=api.glVertex4f;api.glVertex4i=api.glVertex4f;api.glVertex4s=api.glVertex4f;
  for(const [suffix,type]of[['d',5130],['f',5126]]){
    api['glLoadMatrix'+suffix]=p=>ctx.loadMatrix(read(p,type,16));
    api['glMultMatrix'+suffix]=p=>ctx.multMatrix(read(p,type,16));
  }
  api.glGetDoublev=(name,p)=>{const values=ctx.queryFloat(name);new Float64Array(ctx.memory().buffer,p,values.length).set(values);};

  // Quadrics generate real triangles, lines or points, including inward normals.
  const quadrics=new Map();let nextQuadric=1;
  const quad=id=>{const q=quadrics.get(id);if(!q)fail('GLU quadric object is invalid or deleted.',1281);return q;};
  api.gluNewQuadric=()=>{const id=nextQuadric++;quadrics.set(id,{style:100012,normals:100000,orientation:100020});return id;};
  api.gluDeleteQuadric=id=>quadrics.delete(id);
  api.gluQuadricDrawStyle=(id,value)=>{if(![100010,100011,100012].includes(value))fail('GLU_SILHOUETTE quadrics are unsupported; use GLU_LINE, GLU_POINT or GLU_FILL.');quad(id).style=value;};
  api.gluQuadricNormals=(id,value)=>{if(![100000,100001,100002].includes(value))fail('Invalid quadric normal mode.');quad(id).normals=value;};
  api.gluQuadricOrientation=(id,value)=>{if(![100020,100021].includes(value))fail('Invalid quadric orientation.');quad(id).orientation=value;};
  api.gluQuadricTexture=(id,value)=>{quad(id);if(value)fail('Textured GLU quadrics require texture support, which is unavailable in this renderer.');};
  function mesh(q,slices,stacks,point){
    if(slices<3||stacks<1||slices>200||stacks>200)fail('Quadric slices must be 3–200 and stacks/loops 1–200.',1281);
    const inside=q.orientation===100021;
    const emit=(u,v,n)=>{const p=point(u,v);if(q.normals!==100002)api.glNormal3f(...(n||p.n).map(x=>inside?-x:x));api.glVertex3f(...p.p);};
    api.glBegin(q.style===100010?0:q.style===100011?1:4);
    for(let j=0;j<stacks;j++)for(let i=0;i<slices;i++){
      const corners=[[i/slices,j/stacks],[(i+1)/slices,j/stacks],[(i+1)/slices,(j+1)/stacks],[i/slices,(j+1)/stacks]];
      let flat;if(q.normals===100001){const [a,b,c]=corners.map(v=>point(...v).p);const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);flat=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];const d=Math.hypot(...flat);flat=d?flat.map(x=>x/d):point((i+.5)/slices,(j+.5)/stacks).n;}
      const indices=q.style===100010?[0]:q.style===100011?[0,1,0,3]:inside?[0,2,1,0,3,2]:[0,1,2,0,2,3];
      for(const k of indices)emit(...corners[k],flat);
    }
    // Include the final row for lines/points, without changing triangle counts.
    if(q.style!==100012)for(let i=0;i<slices;i++){emit(i/slices,1);if(q.style===100011)emit((i+1)/slices,1);}
    api.glEnd();
  }
  api.gluSphere=(id,r,s,t)=>{if(r<0)fail('Sphere radius must be nonnegative.',1281);mesh(quad(id),s,t,(u,v)=>{const a=u*2*Math.PI,b=(1-v)*Math.PI,n=[Math.sin(b)*Math.cos(a),Math.sin(b)*Math.sin(a),Math.cos(b)];return {p:n.map(x=>x*r),n};});};
  api.gluCylinder=(id,b,t,h,s,n)=>{if(b<0||t<0||h<=0)fail('Cylinder radii must be nonnegative and height positive.',1281);const d=Math.hypot(h,b-t);mesh(quad(id),s,n,(u,v)=>{const a=u*2*Math.PI,r=b+(t-b)*v;return {p:[r*Math.cos(a),r*Math.sin(a),h*v],n:[h*Math.cos(a)/d,h*Math.sin(a)/d,(b-t)/d]};});};
  api.gluPartialDisk=(id,inner,outer,s,n,start,sweep)=>{if(inner<0||outer<=inner||sweep<=0||sweep>360)fail('Disk requires 0 <= inner < outer and 0 < sweep <= 360.',1281);mesh(quad(id),s,n,(u,v)=>{const a=(start+u*sweep)*Math.PI/180,r=inner+(outer-inner)*v;return {p:[r*Math.sin(a),r*Math.cos(a),0],n:[0,0,1]};});};
  api.gluDisk=(id,inner,outer,s,n)=>api.gluPartialDisk(id,inner,outer,s,n,0,360);

  // Bitmap fonts use browser glyphs. Raster position, clipping and pixel advances
  // follow GL rules; typefaces are documented approximations of GLUT fonts.
  let raster={x:0,y:0,z:0,valid:true,color:[1,1,1,1]},fontCanvas,fontContext;const glyphs=new Map();
  const fonts={1:[13,8,'monospace'],2:[15,9,'monospace'],3:[10,0,'serif'],4:[24,0,'serif'],5:[10,0,'sans-serif'],6:[12,0,'sans-serif'],7:[18,0,'sans-serif']};
  const font=id=>{const f=fonts[id];if(!f)fail('Unknown GLUT bitmap font.');return f;};
  function glyph(id,ch){const [height,fixed,family]=font(id),code=ch>=32&&ch<=255?ch:42,key=id+':'+code;if(glyphs.has(key))return glyphs.get(key);if(!fontContext){fontCanvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(64,64):globalThis.document?.createElement('canvas');fontContext=fontCanvas?.getContext('2d',{willReadFrequently:true});if(!fontContext)fail('Bitmap fonts require a browser 2D canvas.');}
    const text=String.fromCharCode(code);fontContext.font=`${height}px ${family}`;const width=fixed||Math.ceil(fontContext.measureText(text).width);fontCanvas.width=Math.max(1,width+4);fontCanvas.height=height+6;fontContext.font=`${height}px ${family}`;fontContext.textBaseline='alphabetic';fontContext.fillStyle='#fff';fontContext.fillText(text,0,height);const result={width,height,pixels:fontContext.getImageData(0,0,fontCanvas.width,fontCanvas.height),baseline:height};glyphs.set(key,result);return result;}
  function rasterPos(x,y,z=0,w=1){const p=ctx.transformPosition([x,y,z,w]),vp=ctx.viewport();raster={x:vp[0]+(p[0]/p[3]+1)*vp[2]/2,y:vp[1]+(p[1]/p[3]+1)*vp[3]/2,z:p[2]/p[3],color:ctx.rasterColor([x,y,z,w]),valid:p[3]>0&&p.slice(0,3).every(v=>Math.abs(v)<=p[3])};}
  for(const n of [2,3,4])for(const suffix of ['f','d','i','s'])api['glRasterPos'+n+suffix]=(...v)=>rasterPos(...v);
  api.glWindowPos2f=(x,y)=>{raster={x,y,z:-1,valid:true,color:ctx.color().slice()};};api.glWindowPos2i=api.glWindowPos2f;api.glWindowPos2d=api.glWindowPos2f;
  api.glutBitmapCharacter=(id,ch)=>{const g=glyph(id,ch);if(!raster.valid)return;const pixels=[];for(let y=0;y<g.pixels.height;y++)for(let x=0;x<g.pixels.width;x++)if(g.pixels.data[(y*g.pixels.width+x)*4+3]>=128)pixels.push([raster.x+x,raster.y+g.baseline-y-1]);ctx.drawPixels(pixels,raster.z,raster.color);raster.x+=g.width;};
  api.glutBitmapWidth=(id,ch)=>glyph(id,ch).width;
  api.glutBitmapHeight=id=>font(id)[0];
  const drawText=(id,text)=>{const origin=raster.x,height=font(id)[0];for(const ch of text){if(ch==='\n'){raster.x=origin;raster.y-=height;}else api.glutBitmapCharacter(id,ch.charCodeAt(0));}};
  api.glutBitmapString=(id,p)=>drawText(id,ctx.string(p));
  api.glutBitmapLength=(id,p)=>Math.max(0,...ctx.string(p).split('\n').map(line=>Array.from(line).reduce((n,ch)=>n+api.glutBitmapWidth(id,ch.charCodeAt(0)),0)));

  // Display lists store commands and scalar copies, never borrowed Wasm pointers.
  const lists=new Map(),reserved=new Set();let list=null,nextList=1,depth=0,replaying=false;
  api.glGenLists=n=>{count(n);if(!n)return 0;while(Array.from({length:n},(_,i)=>nextList+i).some(id=>reserved.has(id)))nextList++;const first=nextList;for(let i=0;i<n;i++)reserved.add(nextList++);return first;};
  api.glNewList=(id,mode)=>{if(list||!id)fail('glNewList requires a positive name and no active list.',1282);if(![4864,4865].includes(mode))fail('Use GL_COMPILE or GL_COMPILE_AND_EXECUTE.');list={id,mode,commands:[],begin:false};};
  api.glEndList=()=>{if(!list)fail('glEndList without glNewList.',1282);if(list.begin)fail('Close glBegin with glEnd before glEndList.',1282);lists.set(list.id,list.commands);reserved.add(list.id);list=null;};
  api.glIsList=id=>lists.has(id)?1:0;
  api.glDeleteLists=(first,n)=>{count(n);for(let i=0;i<n;i++){lists.delete(first+i);reserved.delete(first+i);}};
  function callList(id){if(++depth>64){depth--;fail('Display list recursion exceeds 64 calls.',1282);}const previous=replaying;replaying=true;try{for(const command of lists.get(id)||[])command();}finally{replaying=previous;depth--;}}
  api.glCallList=callList;
  const execute=command=>{const before=replaying;replaying=true;try{return command();}finally{replaying=before;}};
  const bitmapString=api.glutBitmapString;api.glutBitmapString=(id,p)=>{if(!list||replaying)return bitmapString(id,p);const text=ctx.string(p),command=()=>drawText(id,text);list.commands.push(command);if(list.mode===4865)execute(command);};
  for(const name of Object.keys(api).filter(name=>/^glut(Solid|Wire|BitmapCharacter)/.test(name))){const original=api[name];api[name]=(...args)=>{if(!list||replaying)return original(...args);const command=()=>original(...args);list.commands.push(command);if(list.mode===4865)execute(command);};}
  const never=/^(glGet|glIs|glGen|glDelete|glNewList|glEndList|glEnableClientState|glDisableClientState|glVertexPointer|glNormalPointer|glColorPointer|glDrawArrays|glDrawElements|glArrayElement|glut|glu)/;
  for(const name of Object.keys(api)){
    if(!name.startsWith('gl')||never.test(name))continue;
    const original=api[name];
    api[name]=(...args)=>{
      if(!list||replaying)return original(...args);
      if(name==='glBegin'){if(list.begin)fail('Nested glBegin calls are invalid in a display list.',1282);list.begin=true;}
      if(name==='glEnd'){if(!list.begin)fail('glEnd without glBegin in a display list.',1282);list.begin=false;}
      let command;
      if(name.endsWith('v')||name==='glLoadMatrixf'||name==='glMultMatrixf'||name==='glLoadMatrixd'||name==='glMultMatrixd'){
        const vector=name.match(/^gl(Vertex|Color|Normal)([234])([fdis])v$/);
        if(vector){const values=read(args[0],{f:5126,d:5130,i:5124,s:5122}[vector[3]],+vector[2]);command=()=>api[name.slice(0,-1)](...values);}
        else if(name.startsWith('glLoadMatrix')||name.startsWith('glMultMatrix')){const values=read(args[0],name.endsWith('d')?5130:5126,16);command=()=>ctx[name.startsWith('glLoad')?'loadMatrix':'multMatrix'](values);}
        else fail(`${name} in a display list is unsupported. Set its state outside the list or use its scalar form.`,1282);
      }else command=()=>original(...args);
      list.commands.push(command);if(list.mode===4865)execute(command);
    };
  }
  return {read};
}
