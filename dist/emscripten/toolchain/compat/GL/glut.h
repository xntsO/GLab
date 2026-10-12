#ifndef GL_LAB_GLUT_H
#define GL_LAB_GLUT_H
#include_next <GL/glut.h>
#ifdef __cplusplus
extern "C" {
#endif
void glutLeaveMainLoop(void);
void glutBitmapString(void *font, const unsigned char *text);
int glutBitmapHeight(void *font);
void glutStrokeString(void *font, const unsigned char *text);
GLfloat glutStrokeHeight(void *font);
void glutSolidCylinder(GLdouble radius, GLdouble height, GLint slices, GLint stacks);
void glutWireCylinder(GLdouble radius, GLdouble height, GLint slices, GLint stacks);
#ifdef __cplusplus
}
#endif
#endif
