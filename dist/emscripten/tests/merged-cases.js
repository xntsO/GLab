export function mergedCases(seed, labs, starter) {
  const cases = [
    {name:'C stdin, stderr and Emscripten target',language:'c',stdin:'17 23\n',expected:`merge=${seed};sum=40;emscripten=1`,stderr:'stderr-preserved',source:`#include <stdio.h>
#include <emscripten.h>
#ifndef __EMSCRIPTEN__
#error The merged editor must compile for Emscripten
#endif
int main(void) { int a=0,b=0; if(scanf("%d %d",&a,&b)!=2) return 31; printf("merge=${seed};sum=%d;emscripten=1\\n",a+b); fprintf(stderr,"stderr-preserved\\n"); return 0; }`},
    {name:'C stdin preserves UTF-8 bytes',language:'c',stdin:'مرحبا λ\n',expected:'utf8=مرحبا λ',source:'#include <stdio.h>\nint main(void){char line[100];if(!fgets(line,sizeof(line),stdin))return 33;printf("utf8=%s",line);return 0;}'},
    {name:'native Emscripten WebGL and GLES2 pixels',language:'c',expected:'native-webgl=255,0,0,255;error=0',size:[96,96],pixel:[255,0,0,255],source:`#include <stdio.h>
#include <emscripten/html5.h>
#include <GLES2/gl2.h>
int main(void){emscripten_set_canvas_element_size("#canvas",96,96);EmscriptenWebGLContextAttributes a;emscripten_webgl_init_context_attributes(&a);a.majorVersion=1;a.preserveDrawingBuffer=EM_TRUE;EMSCRIPTEN_WEBGL_CONTEXT_HANDLE c=emscripten_webgl_create_context("#canvas",&a);if(c<=0)return 45;if(emscripten_webgl_make_context_current(c)!=EMSCRIPTEN_RESULT_SUCCESS)return 46;glViewport(0,0,96,96);glClearColor(1,0,0,1);glClear(GL_COLOR_BUFFER_BIT);unsigned char p[4];glReadPixels(48,48,1,1,GL_RGBA,GL_UNSIGNED_BYTE,p);printf("native-webgl=%u,%u,%u,%u;error=%u\\n",p[0],p[1],p[2],p[3],glGetError());return 0;}`},
    {name:'C++ standard library and in-memory files',language:'cpp',expected:`stl=${seed};sum=14;file=42`,source:`#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
#include <map>
#include <sstream>
#include <fstream>
int main() { std::vector<int> v={3,1,2}; std::sort(v.begin(),v.end()); int sum=std::accumulate(v.begin(),v.end(),0,[](int s,int x){return s+x*x;}); std::map<std::string,int> m={{"answer",42}}; {std::ofstream f("/merge-test.txt"); f<<m.at("answer");} int restored=0; std::ifstream("/merge-test.txt")>>restored; std::ostringstream out; out<<"stl=${seed};sum="<<sum<<";file="<<restored; std::cout<<out.str()<<std::endl; return restored==42?0:32; }`},
    {name:'unchanged starter GLUT and GLU source',language:'cpp',source:starter,active:true,size:[500,500],title:'My OpenGL program',pixel:[0,0,255,255]},
    {name:'unchanged lab 2 fixed-function triangle',language:'cpp',source:labs.find(lab=>lab.id==='2').code,active:true,size:[320,320],title:'Window triangle',pixel:[0,0,255,255]},
    {name:'unchanged lab 9 matrix transforms',language:'cpp',source:labs.find(lab=>lab.id==='9').code,active:true,nonUniform:true},
    {name:'unchanged lab 10 freeglut teapot',language:'cpp',source:labs.find(lab=>lab.id==='10').code,active:true,nonUniform:true},
    {name:'unchanged lab 11 GLU perspective and animation',language:'cpp',source:labs.find(lab=>lab.id==='11').code,active:true,nonUniform:true},
    {name:'unchanged lab 13 lighting and solid sphere',language:'cpp',source:labs.find(lab=>lab.id==='13').code,active:true,size:[500,500],nonUniform:true},
    {name:'fresh GLFW3 and GL4ES fixed-function pixels',language:'c',expected:'glfw-gl4es-pixel=255,0,255,255;error=0',size:[128,128],pixel:[255,0,255,255],source:`#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <GL/gl.h>
#include <stdio.h>
int main(void) { if(!glfwInit())return 41; glfwWindowHint(GLFW_CLIENT_API,GLFW_OPENGL_ES_API); glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,2); GLFWwindow *w=glfwCreateWindow(128,128,"Merged GLFW GL4ES",0,0); if(!w)return 42; glfwMakeContextCurrent(w); glViewport(0,0,128,128); glClearColor(0,0,0,1); glClear(GL_COLOR_BUFFER_BIT); glMatrixMode(GL_PROJECTION); glLoadIdentity(); glOrtho(-1,1,-1,1,-1,1); glMatrixMode(GL_MODELVIEW); glLoadIdentity(); glColor3f(1,0,1); glBegin(GL_TRIANGLES); glVertex2f(-.8f,-.8f); glVertex2f(.8f,-.8f); glVertex2f(0,.8f); glEnd(); glFlush(); unsigned char p[4]; glReadPixels(64,64,1,1,GL_RGBA,GL_UNSIGNED_BYTE,p); printf("glfw-gl4es-pixel=%u,%u,%u,%u;error=%u\\n",p[0],p[1],p[2],p[3],glGetError()); glfwSwapBuffers(w); return 0; }`},
    {name:'GLFW swap flush submits GL4ES rectangle',language:'c',active:true,size:[128,128],title:'GLFW rectangle swap',updatedTitle:'GLFW presented rectangle',pixel:[255,0,255,255],source:`#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <GL/gl.h>
#include <emscripten.h>
static GLFWwindow *window;static int titled;
static void display(void){if(!titled){glfwSetWindowTitle(window,"GLFW presented rectangle");titled=1;}glClearColor(0,0,0,1);glClear(GL_COLOR_BUFFER_BIT);glColor3f(1,0,1);glRectf(-.75f,-.75f,.75f,.75f);glfwSwapBuffers(window);glfwPollEvents();}
int main(void){if(!glfwInit())return 47;glfwWindowHint(GLFW_CLIENT_API,GLFW_OPENGL_ES_API);glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,2);window=glfwCreateWindow(128,128,"GLFW rectangle swap",0,0);if(!window)return 48;glfwMakeContextCurrent(window);glViewport(0,0,128,128);glMatrixMode(GL_PROJECTION);glLoadIdentity();glOrtho(-1,1,-1,1,-1,1);glMatrixMode(GL_MODELVIEW);glLoadIdentity();emscripten_set_main_loop(display,0,1);return 0;}`},
    {name:'nonzero exit status',language:'c',expected:'exit-marker',exitCode:7,source:'#include <stdio.h>\nint main(void){puts("exit-marker");return 7;}'},
    {name:'compiler options reach Emscripten driver',language:'c',args:['-O2','-DMERGED_OPTION=2468'],expected:'option=2468',source:'#include <stdio.h>\n#ifndef MERGED_OPTION\n#error Expected editor compiler options\n#endif\nint main(void){printf("option=%d\\n",MERGED_OPTION);return 0;}'},
    {name:'GLU quadric sphere retains old API',language:'c',active:true,size:[128,128],pixel:[0,0,255,255],source:`#include <GL/glut.h>
#include <GL/glu.h>
static void display(void){glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);glColor3f(0,0,1);GLUquadric *q=gluNewQuadric();gluQuadricDrawStyle(q,GLU_FILL);gluQuadricNormals(q,GLU_SMOOTH);gluSphere(q,.6,24,16);gluDeleteQuadric(q);glFlush();}
int main(int argc,char **argv){glutInit(&argc,argv);glutInitDisplayMode(GLUT_RGB|GLUT_SINGLE|GLUT_DEPTH);glutInitWindowSize(128,128);glutCreateWindow("GLU quadric");glClearColor(0,0,0,1);glEnable(GL_DEPTH_TEST);glutDisplayFunc(display);glutMainLoop();return 0;}`},
    {name:'GLUT bitmap fonts retain old API',language:'c',active:true,size:[160,96],nonUniform:true,source:`#include <GL/glut.h>
static void display(void){glClear(GL_COLOR_BUFFER_BIT);glColor3f(1,1,1);glRasterPos2f(-.8f,0);const char *p="GL Lab";while(*p)glutBitmapCharacter(GLUT_BITMAP_8_BY_13,*p++);glFlush();}
int main(int argc,char **argv){glutInit(&argc,argv);glutInitDisplayMode(GLUT_RGB|GLUT_SINGLE);glutInitWindowSize(160,96);glutCreateWindow("Bitmap fonts");glClearColor(0,0,0,1);glutDisplayFunc(display);glutMainLoop();return 0;}`},
    {name:'GLUT popup menu forwards selected value',language:'c',active:true,size:[96,96],pixel:[255,0,0,255],menuPixel:[0,255,0,255],source:`#include <GL/glut.h>
#include <stdio.h>
static int green=0;
static void display(void){glClearColor(!green,green,0,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();}
static void chosen(int value){printf("menu=%d\\n",value);green=value==42;glutPostRedisplay();}
int main(int argc,char **argv){glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("GLUT menu");glutDisplayFunc(display);glutCreateMenu(chosen);glutAddMenuEntry("Green",42);glutAttachMenu(GLUT_RIGHT_BUTTON);glutMainLoop();return 0;}`},
    {name:'keyboard and mouse callbacks change GLUT pixels',language:'c',active:true,size:[96,96],pixel:[255,0,0,255],inputPixel:[0,255,0,255],mousePixel:[0,0,255,255],source:`#include <GL/glut.h>
#include <stdio.h>
static int color=0;
static void display(void){glClearColor(color==0,color==1,color==2,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();}
static void key(unsigned char k,int x,int y){if(k=='a'){color=1;glutPostRedisplay();}}
static void mouse(int button,int state,int x,int y){if(button==GLUT_LEFT_BUTTON&&state==GLUT_DOWN){printf("mouse=%d,%d\\n",x,y);color=2;glutPostRedisplay();}}
int main(int argc,char **argv){glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("Input callback check");glutDisplayFunc(display);glutKeyboardFunc(key);glutMouseFunc(mouse);glutMainLoop();return 0;}`},
    {name:'GLFW browser main loop and cancellation',language:'c',active:true,loopEnded:true,expected:'glfw-loop=3',size:[96,96],pixel:[0,255,0,255],source:`#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <GL/gl.h>
#include <emscripten.h>
#include <stdio.h>
static GLFWwindow *window;static int count;
static void frame(void){glClearColor(0,1,0,1);glClear(GL_COLOR_BUFFER_BIT);glfwSwapBuffers(window);if(++count==3){printf("glfw-loop=%d\\n",count);emscripten_cancel_main_loop();}}
int main(void){if(!glfwInit())return 43;glfwWindowHint(GLFW_CLIENT_API,GLFW_OPENGL_ES_API);glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,2);window=glfwCreateWindow(96,96,"GLFW browser loop",0,0);if(!window)return 44;glfwMakeContextCurrent(window);emscripten_set_main_loop(frame,0,1);return 0;}`}
  ];

  const glutInputSource=String.raw`#include <GL/glut.h>
#include <stdio.h>
static int held,ticks,idles,draws;
static void display(void){draws++;glClearColor(held&&ticks>=3&&idles&&draws>1?0:1,held&&ticks>=3&&idles&&draws>1?1:0,0,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();}
static void key(unsigned char k,int x,int y){printf("key=%d,%d,%d,%d\n",k,x,y,glutGetModifiers());held=1;}
static void up(unsigned char k,int x,int y){printf("up=%d,%d,%d,%d\n",k,x,y,glutGetModifiers());held=0;}
static void special(int k,int x,int y){printf("special=%d,%d,%d,%d\n",k,x,y,glutGetModifiers());}
static void specialup(int k,int x,int y){printf("specialup=%d,%d,%d,%d\n",k,x,y,glutGetModifiers());}
static void mouse(int b,int s,int x,int y){printf("mouse=%d,%d,%d,%d,%d\n",b,s,x,y,glutGetModifiers());}
static void motion(int x,int y){printf("motion=%d,%d,%d\n",x,y,glutGetModifiers());}
static void passive(int x,int y){printf("passive=%d,%d,%d\n",x,y,glutGetModifiers());}
static void entry(int state){printf("entry=%d,%d\n",state,glutGetModifiers());}
static void timer(int value){ticks++;glutPostRedisplay();glutTimerFunc(20,timer,value);}
static void idle(void){idles++;}
int main(int argc,char **argv){glutInit(&argc,argv);glutInitWindowSize(96,96);glutCreateWindow("Input regression");glutDisplayFunc(display);glutKeyboardFunc(key);glutKeyboardUpFunc(up);glutSpecialFunc(special);glutSpecialUpFunc(specialup);glutMouseFunc(mouse);glutMotionFunc(motion);glutPassiveMotionFunc(passive);glutEntryFunc(entry);glutTimerFunc(20,timer,7);glutIdleFunc(idle);glutMainLoop();return 0;}`;
  const glutCase=(name,inputSteps)=>({name:'input regression GLUT '+name,language:'c',active:true,size:[96,96],pixel:[255,0,0,255],source:glutInputSource,inputSteps});
  const keySteps=(key,value,kind='key',modifiers=0)=>['keydown','keyup'].map((type,i)=>({event:{type,key,modifiers},expected:`${i?(kind==='key'?'up':'specialup'):kind}=${value},23,41,${modifiers}\n`,count:1}));
  cases.push(glutCase('special keys and releases',[
    ...['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','PageUp','PageDown','Home','End','Insert'].flatMap((key,i)=>keySteps(key,100+i,'special',7)),
    ...Array.from({length:12},(_,i)=>keySteps('F'+(i+1),i+1,'special')).flat()
  ]));
  cases.push(glutCase('characters controls repeat and game loop',[
    ...[['a',97,0],['A',65,1],['Z',90,0],['1',49,0],['!',33,1],['?',63,1],['\\',92,0],['~',126,1],['Enter',13,0],['Escape',27,0],[' ',32,0],['Tab',9,0],['Backspace',8,0],['Delete',127,0],['c',3,2],['x',120,4]].flatMap(([k,v,m])=>keySteps(k,v,'key',m)),
    {event:{type:'keydown',key:'a'},expected:'key=97,23,41,0\n',count:1},
    {event:{type:'keydown',key:'a',repeat:true},expected:'key=97,23,41,0\n',count:1,pixel:[0,255,0,255]},
    {event:{type:'keyup',key:'a'},expected:'up=97,23,41,0\n',count:1}
  ]));
  cases.push({...glutCase('mouse coordinates motion wheel modifiers and entry',[
    {event:{type:'passive',x:7,y:11,modifiers:1},expected:'passive=7,11,1\n',count:1},
    ...[0,1,2].flatMap(button=>[
      {event:{type:'mouse',button,state:0,x:15,y:27,modifiers:7},expected:`mouse=${button},0,15,27,7\n`,count:1},
      {event:{type:'motion',buttons:[1,4,2][button],x:32,y:47,modifiers:2},expected:'motion=32,47,2\n',count:1},
      {event:{type:'mouse',button,state:1,x:35,y:49,modifiers:4},expected:`mouse=${button},1,35,49,4\n`,count:1}
    ]),
    ...[-100,100].map(deltaY=>({event:{type:'wheel',deltaY,modifiers:3},expected:`mouse=${deltaY<0?3:4},0,23,41,3\nmouse=${deltaY<0?3:4},1,23,41,3\n`,count:1})),
    {event:{type:'entry',state:1,modifiers:1},expected:'entry=1,1\n',count:1},
    {event:{type:'entry',state:0,modifiers:0},expected:'entry=0,0\n',count:1}
  ]),mirrorInput:true});
  cases.push({name:'input regression GLFW callbacks polling repeat characters and scroll',language:'c',active:true,size:[96,96],pixel:[255,0,0,255],source:String.raw`#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <GL/gl.h>
#include <emscripten.h>
#include <stdio.h>
static GLFWwindow *w;
static void key(GLFWwindow *v,int k,int scan,int action,int mods){printf("key=%d,%d,%d,poll=%d\n",k,action,mods,glfwGetKey(v,k));}
static void character(GLFWwindow *v,unsigned int c){printf("char=%u\n",c);}
static void mouse(GLFWwindow *v,int b,int action,int mods){double x,y;glfwGetCursorPos(v,&x,&y);printf("mouse=%d,%d,%d,%g,%g,poll=%d\n",b,action,mods,x,y,glfwGetMouseButton(v,b));}
static void cursor(GLFWwindow *v,double x,double y){printf("cursor=%g,%g\n",x,y);}
static void scroll(GLFWwindow *v,double x,double y){printf("scroll=%g,%g\n",x,y);}
static void enter(GLFWwindow *v,int state){printf("entry=%d\n",state);}
static void frame(void){glClearColor(1,0,0,1);glClear(GL_COLOR_BUFFER_BIT);glfwSwapBuffers(w);glfwPollEvents();}
int main(void){if(!glfwInit())return 1;glfwWindowHint(GLFW_CLIENT_API,GLFW_OPENGL_ES_API);glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,2);w=glfwCreateWindow(96,96,"GLFW input",0,0);if(!w)return 2;glfwMakeContextCurrent(w);glfwSetKeyCallback(w,key);glfwSetCharCallback(w,character);glfwSetMouseButtonCallback(w,mouse);glfwSetCursorPosCallback(w,cursor);glfwSetScrollCallback(w,scroll);glfwSetCursorEnterCallback(w,enter);emscripten_set_main_loop(frame,0,1);return 0;}`,inputSteps:[
    {event:{type:'keydown',key:'A',code:'KeyA',modifiers:1},expected:'key=65,1,1,poll=1\nchar=65\n',count:1},
    {event:{type:'keydown',key:'A',code:'KeyA',modifiers:1,repeat:true},expected:'key=65,2,1,poll=1\nchar=65\n',count:1},
    {event:{type:'keyup',key:'a',code:'KeyA'},expected:'key=65,0,0,poll=0\n',count:1},
    {event:{type:'keydown',key:'Shift',code:'ShiftLeft',modifiers:1},expected:'key=340,1,1,poll=1\n',count:1},
    {event:{type:'keyup',key:'Shift',code:'ShiftLeft'},expected:'key=340,0,0,poll=0\n',count:1},
    ...keySteps('ArrowLeft',263).map(s=>({...s,expected:s.event.type==='keydown'?'key=263,1,0,poll=1\n':'key=263,0,0,poll=0\n'})),
    {event:{type:'passive',x:17,y:29},expected:'cursor=17,29\n',count:1},
    ...[0,1,2].flatMap(button=>[0,1].map(state=>({event:{type:'mouse',button,state,x:31,y:43,modifiers:6},expected:`mouse=${[0,2,1][button]},${1-state},6,31,43,poll=${1-state}\n`,count:1}))),
    {event:{type:'wheel',deltaX:2,deltaY:-100},expected:'scroll=2,1\n',count:1},
    {event:{type:'wheel',deltaY:100},expected:'scroll=0,-1\n',count:1},
    {event:{type:'entry',state:1},expected:'entry=1\n',count:1},
    {event:{type:'entry',state:0},expected:'entry=0\n',count:1}
  ]});


  cases.push({...glutCase('visible canvas scale letterboxing focus wheel and blur',[
    {css:'width:384px;height:192px;object-fit:contain',dom:{type:'pointermove',x:143,y:83},expected:'passive=23,41,0\n',count:1},
    {dom:{type:'keydown',key:'ArrowUp',code:'ArrowUp'},expected:'special=101,23,41,0\n',count:1},
    {dom:{type:'keyup',key:'ArrowUp',code:'ArrowUp'},expected:'specialup=101,23,41,0\n',count:1},
    {dom:{type:'wheel',x:143,y:83,deltaY:-100,modifiers:1},expected:'mouse=3,0,23,41,1\nmouse=3,1,23,41,1\n',count:1},
    {css:'width:192px;height:384px;object-fit:contain',dom:{type:'pointermove',x:63,y:191},expected:'passive=31,47,0\n',count:1},
    {dom:{type:'keydown',key:' ',code:'Space'},expected:'key=32,31,47,0\n',count:1},
    {dom:{type:'blur'},expected:'up=32,31,47,0\n',count:1}
  ]),canvasInput:true});

  const selected=new Set(['2','9','10','11','13']);
  for(const lab of labs){if(selected.has(lab.id))continue;cases.push({name:`unchanged lab ${lab.id} ${lab.title}`,language:'cpp',source:lab.code,active:true,capture:true,...(lab.id==='1A'?{pixel:[0,0,0,255]}:lab.id==='1B'?{}:{nonUniform:true})});}
  return cases;
}
