#include <GL/glut.h>
#include <GL/glu.h>
#include <gl4esinit.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <math.h>
#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>

extern void *emscripten_GetProcAddress(const char *name);
extern int __real_glutCreateWindow(const char *title);
extern void __real_glutMainLoop(void);
extern void __real_glutSwapBuffers(void);
extern void __real_emscripten_cancel_main_loop(void);
extern void __real_glfwMakeContextCurrent(GLFWwindow *window);
extern void __real_glfwSwapBuffers(GLFWwindow *window);
extern GLFWwindow *__real_glfwCreateWindow(int width,int height,const char *title,GLFWmonitor *monitor,GLFWwindow *share);
extern void __real_glfwSetWindowTitle(GLFWwindow *window,const char *title);
static int initialized;
static void framebuffer_size(int *width, int *height) {
  emscripten_get_canvas_element_size("#canvas", width, height);
}
static void initialize_graphics(void) {
  if (initialized) return;
  set_getprocaddress(emscripten_GetProcAddress);
  set_getmainfbsize(framebuffer_size);
  initialize_gl4es(); initialized = 1;
  int w, h; framebuffer_size(&w, &h); glViewport(0, 0, w, h);
}
int __wrap_glutCreateWindow(const char *title) {
  int window = __real_glutCreateWindow(title);
  if (window) initialize_graphics();
  EM_ASM({ if (Module.gllabEvent) Module.gllabEvent('title', UTF8ToString($0)); }, title);
  return window;
}
void __wrap_glfwMakeContextCurrent(GLFWwindow *window) {
  __real_glfwMakeContextCurrent(window);
  if (window) initialize_graphics();
}
void __wrap_glfwSwapBuffers(GLFWwindow *window) {
  glFlush();
  __real_glfwSwapBuffers(window);
}
GLFWwindow *__wrap_glfwCreateWindow(int width,int height,const char *title,GLFWmonitor *monitor,GLFWwindow *share) {
  GLFWwindow *window=__real_glfwCreateWindow(width,height,title,monitor,share);
  if(window) EM_ASM({ if (Module.gllabEvent) Module.gllabEvent('title',UTF8ToString($0)); },title);
  return window;
}
void __wrap_glfwSetWindowTitle(GLFWwindow *window,const char *title) {
  __real_glfwSetWindowTitle(window,title);
  EM_ASM({ if (Module.gllabEvent) Module.gllabEvent('title',UTF8ToString($0)); },title);
}
void glutSetWindowTitle(const char *title) {
  EM_ASM({ if (Module.gllabEvent) Module.gllabEvent('title', UTF8ToString($0)); }, title);
}
void glutSetIconTitle(const char *title) { glutSetWindowTitle(title); }
void __wrap_glutMainLoop(void) {
  // The upstream GLUT loop schedules callbacks and unwinds main without a
  // runtime keepalive. Preserve Wasm/GL state while those callbacks are active.
  EM_ASM({ noExitRuntime=true; if (Module.gllabEvent) Module.gllabEvent('loopStart', null); });
  __real_glutMainLoop();
}
void __wrap_glutSwapBuffers(void) {
  // WebGL presents its canvas automatically, but GL4ES's queued geometry must
  // first reach WebGL. Desktop swapping implies the same OpenGL flush.
  glFlush();
  __real_glutSwapBuffers();
}
void __wrap_emscripten_cancel_main_loop(void) {
  __real_emscripten_cancel_main_loop();
  EM_ASM({ if (Module.gllabEvent) Module.gllabEvent('loopEnd', null); });
}
void glutLeaveMainLoop(void) {
  emscripten_cancel_main_loop();
  EM_ASM({ if (typeof GLUT !== 'undefined') { GLUT.displayFunc=0; GLUT.idleFunc=0; }
  });
}
void gluOrtho2D(GLdouble l, GLdouble r, GLdouble b, GLdouble t) { glOrtho(l,r,b,t,-1,1); }
void gluPerspective(GLdouble fovy, GLdouble aspect, GLdouble near, GLdouble far) {
  GLdouble top = near * tan(fovy * 3.14159265358979323846 / 360.0);
  glFrustum(-top*aspect, top*aspect, -top, top, near, far);
}
static void normalize(GLdouble v[3]) { GLdouble d=sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); if(d) for(int i=0;i<3;i++) v[i]/=d; }
static void cross(const GLdouble a[3],const GLdouble b[3],GLdouble out[3]) {
  out[0]=a[1]*b[2]-a[2]*b[1];out[1]=a[2]*b[0]-a[0]*b[2];out[2]=a[0]*b[1]-a[1]*b[0];
}
void gluLookAt(GLdouble ex,GLdouble ey,GLdouble ez,GLdouble cx,GLdouble cy,GLdouble cz,GLdouble ux,GLdouble uy,GLdouble uz) {
  GLdouble f[3]={cx-ex,cy-ey,cz-ez},up[3]={ux,uy,uz},s[3],u[3];
  normalize(f);cross(f,up,s);normalize(s);cross(s,f,u);
  GLdouble m[16]={s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,0,0,0,1};
  glMultMatrixd(m);glTranslated(-ex,-ey,-ez);
}
void gluPickMatrix(GLdouble x,GLdouble y,GLdouble width,GLdouble height,GLint viewport[4]) {
  if(width<=0||height<=0)return;
  glTranslated((viewport[2]-2*(x-viewport[0]))/width,(viewport[3]-2*(y-viewport[1]))/height,0);
  glScaled(viewport[2]/width,viewport[3]/height,1);
}
