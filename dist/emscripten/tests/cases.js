export const baseArgs = ['-O0', '-sMODULARIZE=1', '-sEXPORT_NAME=AcceptanceModule', '-sINVOKE_RUN=0', '-sEXIT_RUNTIME=1', '-sENVIRONMENT=web', '-sASSERTIONS=1', '-sFILESYSTEM=1', '-sEXPORTED_RUNTIME_METHODS=["callMain","FS"]'];

export function stdioCase(seed) {
  const value = seed * seed + 17;
  return {language: 'c', expected: `fresh=${seed};computed=${value}`, source: `#include <stdio.h>
#include <emscripten.h>
#ifndef __EMSCRIPTEN__
#error Acceptance requires an actual Emscripten target
#endif
int main(int argc, char **argv) {
  int result = ${seed} * ${seed} + 17;
  FILE *file = fopen("/acceptance.txt", "w+");
  if (!file) return 91;
  fprintf(file, "%d", result); rewind(file);
  int restored = 0; fscanf(file, "%d", &restored); fclose(file);
  if (restored != result) return 92;
  printf("fresh=${seed};computed=%d\\n", restored);
  printf("emcc=%d.%d.%d;clock=%d\\n", __EMSCRIPTEN_major__, __EMSCRIPTEN_minor__, __EMSCRIPTEN_tiny__, emscripten_get_now() > 0);
  fprintf(stderr, "stderr-fresh=${seed}\\n");
  EM_ASM({ console.log("acceptance-em-asm"); Module.print("em-asm=" + ($0 + 3)); }, result);
  return 0;
}`, expectedEmAsm: `em-asm=${value + 3}`, expectedStderr: `stderr-fresh=${seed}`, emscriptenVersion:true};
}

export function cppCase(seed) {
  const value = [seed, seed + 4, seed * 2, seed - 1].reduce((sum, x) => sum + x * x, 0);
  return {language: 'cpp', expected: `cpp-fresh=${seed};sum=${value}`, source: `#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
#include <sstream>
#include <string>
#include <emscripten.h>
#ifndef __EMSCRIPTEN__
#error Acceptance requires an actual Emscripten C++ target
#endif
int main() {
  std::vector<int> values = {${seed}, ${seed + 4}, ${seed * 2}, ${seed - 1}};
  std::sort(values.begin(), values.end());
  int result = std::accumulate(values.begin(), values.end(), 0, [](int sum, int x) { return sum + x * x; });
  std::ostringstream text; text << "cpp-fresh=${seed};sum=" << result;
  std::cout << text.str() << std::endl;
  EM_ASM({ Module.print("cpp-emscripten-runtime"); });
  return 0;
}`};
}

export function webglCase(seed, color) {
  return {language:'c', color, expected:`webgl-fresh=${seed}`, source:`#include <stdio.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <GLES2/gl2.h>
int main() {
  EmscriptenWebGLContextAttributes attributes;
  emscripten_webgl_init_context_attributes(&attributes);
  attributes.majorVersion = 1; attributes.preserveDrawingBuffer = EM_TRUE;
  EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context = emscripten_webgl_create_context("#canvas", &attributes);
  if (context <= 0 || emscripten_webgl_make_context_current(context) != EMSCRIPTEN_RESULT_SUCCESS) return 71;
  glViewport(0, 0, 128, 128);
  glClearColor(${color[0] / 255}, ${color[1] / 255}, ${color[2] / 255}, 1); glClear(GL_COLOR_BUFFER_BIT);
  unsigned char pixel[4]; glReadPixels(64,64,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
  printf("webgl-fresh=${seed};context=%d;pixel=%d,%d,%d,%d;error=%d\\n",context,pixel[0],pixel[1],pixel[2],pixel[3],glGetError());
  EM_ASM({ window.__acceptanceCapture(); });
  return 0;
}`};
}

export function glfwCase(seed, color) {
  return {language:'c', args:['-sUSE_GLFW=3'], color, expected:`glfw-fresh=${seed}`, source:`#include <stdio.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <GLFW/glfw3.h>
int main() {
  if (!glfwInit()) return 81;
  glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
  GLFWwindow *window = glfwCreateWindow(96,96,"Fresh GLFW ${seed}",0,0);
  if (!window) return 82;
  glfwMakeContextCurrent(window);
  int width,height; glfwGetFramebufferSize(window,&width,&height); glViewport(0,0,width,height);
  glClearColor(${color[0] / 255},${color[1] / 255},${color[2] / 255},1); glClear(GL_COLOR_BUFFER_BIT);
  unsigned char pixel[4]; glReadPixels(width/2,height/2,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
  printf("glfw-fresh=${seed};context=%d;size=%dx%d;pixel=%d,%d,%d,%d;error=%d\\n",emscripten_webgl_get_current_context(),width,height,pixel[0],pixel[1],pixel[2],pixel[3],glGetError());
  EM_ASM({ window.__acceptanceCapture(); });
  glfwSwapBuffers(window); glfwPollEvents();
  return 0;
}`};
}

export function gl4esCase(seed, args) {
  return {language:'c', args, color:[255,0,255], expected:`gl4es-fresh=${seed}`, source:`#include <stdio.h>
#include <emscripten.h>
#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>
#include <GL/gl.h>
#include <gl4esinit.h>
extern void *emscripten_GetProcAddress(const char *name);
static void framebuffer_size(int *width,int *height) { *width=128;*height=128; }
int main() {
  if (!glfwInit()) return 83;
  glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,2);
  GLFWwindow *window = glfwCreateWindow(128,128,"GL4ES fixed function ${seed}",0,0);
  if (!window) return 84;
  glfwMakeContextCurrent(window);
  set_getprocaddress(emscripten_GetProcAddress);
  set_getmainfbsize(framebuffer_size);
  initialize_gl4es();
  printf("gl4es-version=%s\\n",glGetString(GL_VERSION));
  glViewport(0,0,128,128); glClearColor(0,0,0,1); glClear(GL_COLOR_BUFFER_BIT);
  glMatrixMode(GL_PROJECTION); glLoadIdentity(); glOrtho(-1,1,-1,1,-1,1);
  glMatrixMode(GL_MODELVIEW); glLoadIdentity();
  glColor3f(1,0,1); glBegin(GL_TRIANGLES);
  glVertex2f(-0.8f,-0.8f); glVertex2f(0.8f,-0.8f); glVertex2f(0.0f,0.8f); glEnd(); glFlush();
  unsigned char pixel[4]; glReadPixels(64,64,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
  printf("gl4es-fresh=${seed};pixel=%d,%d,%d,%d;error=%d\\n",pixel[0],pixel[1],pixel[2],pixel[3],glGetError());
  EM_ASM({ window.__acceptanceCapture(); });
  return 0;
}`};
}
