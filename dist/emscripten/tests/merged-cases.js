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
  const selected=new Set(['2','9','10','11','13']);
  for(const lab of labs){if(selected.has(lab.id))continue;cases.push({name:`unchanged lab ${lab.id} ${lab.title}`,language:'cpp',source:lab.code,active:true,capture:true,...(lab.id==='1A'?{pixel:[0,0,0,255]}:lab.id==='1B'?{}:{nonUniform:true})});}
  return cases;
}
