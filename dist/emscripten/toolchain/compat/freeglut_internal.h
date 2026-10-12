/* Adapter for freeglut's standalone geometry routines. Window/input handling is
 * Emscripten's GLUT library; geometry calls the linked GL4ES library. */
#ifndef GL_LAB_FREEGLUT_INTERNAL_H
#define GL_LAB_FREEGLUT_INTERNAL_H
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>
typedef struct { char *Name; int Quantity, Height; const GLubyte **Characters; float xorig,yorig; } SFG_Font;
typedef struct { GLfloat X,Y; } SFG_StrokeVertex;
typedef struct { int Number; const SFG_StrokeVertex *Vertices; } SFG_StrokeStrip;
typedef struct { GLfloat Right; int Number; const SFG_StrokeStrip *Strips; } SFG_StrokeChar;
typedef struct { char *Name; int Quantity; GLfloat Height; const SFG_StrokeChar **Characters; } SFG_StrokeFont;
#define freeglut_return_if_fail(expr) do { if(!(expr)) return; } while(0)
#define freeglut_return_val_if_fail(expr,value) do { if(!(expr)) return value; } while(0)
#define FREEGLUT_EXIT_IF_NOT_INITIALISED(name) ((void)0)
static void fgWarning(const char *format, ...) {
  va_list args; va_start(args, format); vfprintf(stderr, format, args); va_end(args); fputc('\n',stderr);
}
static void fgError(const char *format, ...) {
  va_list args; va_start(args, format); vfprintf(stderr, format, args); va_end(args);
  fputc('\n', stderr); abort();
}
#endif
