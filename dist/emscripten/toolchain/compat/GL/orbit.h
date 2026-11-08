/* GL Lab orbit controls: click and drag to turn and move a 3D scene.
 * Header-only, for C and C++ GLUT programs. Supplied by GL Lab; copy this
 * file next to your program to build it outside the browser.
 *
 *   #include <GL/orbit.h>
 *
 *   void display(void) {
 *       glClear(...);
 *       glPushMatrix();
 *       orbitApply();          // after the camera, before the shapes
 *       ...draw...
 *       glPopMatrix();
 *       ...swap or flush...
 *   }
 *   int main(...) {
 *       ...
 *       orbitInstall(NULL);    // or orbitInstall(myMouse) to keep your clicks
 *       glutMainLoop();
 *   }
 *
 * Left drag rotates around the origin of the frame where orbitApply() runs.
 * Right drag, or Shift + left drag, moves the scene so it follows the pointer.
 * The mouse wheel zooms. A click without dragging still reaches the function
 * given to orbitInstall, as a GLUT_DOWN followed by a GLUT_UP.
 * A program with its own glutMotionFunc can call orbitMotion(x, y) from it.
 * orbitReset() returns to the starting view.
 */
#ifndef GL_LAB_ORBIT_H
#define GL_LAB_ORBIT_H

#include <GL/glut.h>
#include <stdlib.h>

typedef void (*OrbitClickFunc)(int button, int state, int x, int y);

static float orbitYaw = 0.0f, orbitPitch = 0.0f, orbitZoom = 1.0f;
static float orbitPan[3] = {0.0f, 0.0f, 0.0f};
static OrbitClickFunc orbitClick = 0;
static int orbitButton = -1, orbitMoving = 0, orbitDragged = 0;
static int orbitPressX = 0, orbitPressY = 0, orbitLastX = 0, orbitLastY = 0;
/* projection * modelview where orbitApply() ran, and its inverse */
static float orbitView[16], orbitViewInverse[16];
static int orbitViewport[4] = {0, 0, 1, 1}, orbitHaveView = 0;

/* Invert a column-major 4x4 matrix by Gauss-Jordan elimination. */
static inline int orbitInvert(const float m[16], float out[16]) {
    float a[4][8];
    int r, c, k;
    for (r = 0; r < 4; r++)
        for (c = 0; c < 4; c++) {
            a[r][c] = m[c*4 + r];
            a[r][c + 4] = r == c ? 1.0f : 0.0f;
        }
    for (c = 0; c < 4; c++) {
        int best = c;
        float pivot;
        for (r = c + 1; r < 4; r++)
            if ((a[r][c] < 0 ? -a[r][c] : a[r][c]) > (a[best][c] < 0 ? -a[best][c] : a[best][c])) best = r;
        if (a[best][c] == 0.0f) return 0;
        for (k = 0; k < 8; k++) { float t = a[c][k]; a[c][k] = a[best][k]; a[best][k] = t; }
        pivot = a[c][c];
        for (k = 0; k < 8; k++) a[c][k] /= pivot;
        for (r = 0; r < 4; r++)
            if (r != c) {
                float f = a[r][c];
                for (k = 0; k < 8; k++) a[r][k] -= f*a[c][k];
            }
    }
    for (r = 0; r < 4; r++)
        for (c = 0; c < 4; c++) out[c*4 + r] = a[r][c + 4];
    return 1;
}

/* Apply the dragged view to the current modelview matrix. */
static inline void orbitApply(void) {
    float m[16], p[16];
    int r, c, k;
    glGetFloatv(GL_MODELVIEW_MATRIX, m);
    glGetFloatv(GL_PROJECTION_MATRIX, p);
    glGetIntegerv(GL_VIEWPORT, orbitViewport);
    for (c = 0; c < 4; c++)
        for (r = 0; r < 4; r++) {
            float sum = 0.0f;
            for (k = 0; k < 4; k++) sum += p[k*4 + r]*m[c*4 + k];
            orbitView[c*4 + r] = sum;
        }
    orbitHaveView = orbitInvert(orbitView, orbitViewInverse);

    glTranslatef(orbitPan[0], orbitPan[1], orbitPan[2]);
    glRotatef(orbitPitch, 1.0f, 0.0f, 0.0f);
    glRotatef(orbitYaw, 0.0f, 1.0f, 0.0f);
    if (orbitZoom != 1.0f) {
        glEnable(GL_NORMALIZE);  /* keep lighting correct while scaled */
        glScalef(orbitZoom, orbitZoom, orbitZoom);
    }
}

static inline void orbitReset(void) {
    orbitYaw = orbitPitch = 0.0f;
    orbitZoom = 1.0f;
    orbitPan[0] = orbitPan[1] = orbitPan[2] = 0.0f;
    glutPostRedisplay();
}

/* Move the pan point by a window-pixel step, keeping its screen depth. */
static inline void orbitMoveBy(int dx, int dy) {
    float clip[4], ndc[4], world[4];
    int r, k;
    if (!orbitHaveView) return;
    for (r = 0; r < 4; r++)
        clip[r] = orbitView[r]*orbitPan[0] + orbitView[4 + r]*orbitPan[1] + orbitView[8 + r]*orbitPan[2] + orbitView[12 + r];
    if (clip[3] <= 0.0f) return;
    ndc[0] = clip[0]/clip[3] + 2.0f*dx/orbitViewport[2];
    ndc[1] = clip[1]/clip[3] - 2.0f*dy/orbitViewport[3];  /* window y grows downward */
    ndc[2] = clip[2]/clip[3];
    ndc[3] = 1.0f;
    for (r = 0; r < 4; r++) {
        world[r] = 0.0f;
        for (k = 0; k < 4; k++) world[r] += orbitViewInverse[k*4 + r]*ndc[k];
    }
    if (world[3] == 0.0f) return;
    for (r = 0; r < 3; r++) orbitPan[r] = world[r]/world[3];
}

static inline void orbitMotion(int x, int y) {
    int dx, dy;
    if (orbitButton == -1) return;
    if (!orbitDragged && abs(x - orbitPressX) + abs(y - orbitPressY) < 4) return;
    orbitDragged = 1;
    dx = x - orbitLastX;
    dy = y - orbitLastY;
    orbitLastX = x;
    orbitLastY = y;
    if (orbitMoving) {
        orbitMoveBy(dx, dy);
    } else {
        orbitYaw += dx*0.5f;
        orbitPitch += dy*0.5f;
        if (orbitPitch > 90.0f) orbitPitch = 90.0f;
        if (orbitPitch < -90.0f) orbitPitch = -90.0f;
    }
    glutPostRedisplay();
}

static inline void orbitMouse(int button, int state, int x, int y) {
    if (button == 3 || button == 4) {  /* mouse wheel */
        if (state == GLUT_DOWN) {
            orbitZoom *= button == 3 ? 1.1f : 1.0f/1.1f;
            if (orbitZoom < 0.2f) orbitZoom = 0.2f;
            if (orbitZoom > 5.0f) orbitZoom = 5.0f;
            glutPostRedisplay();
        }
        return;
    }
    if (state == GLUT_DOWN) {
        if (orbitButton != -1) return;  /* already dragging */
        orbitButton = button;
        orbitMoving = button != GLUT_LEFT_BUTTON || (glutGetModifiers() & GLUT_ACTIVE_SHIFT);
        orbitDragged = 0;
        orbitPressX = orbitLastX = x;
        orbitPressY = orbitLastY = y;
        return;
    }
    if (button != orbitButton) return;
    orbitButton = -1;
    if (!orbitDragged && orbitClick) {  /* a click, not a drag */
        orbitClick(button, GLUT_DOWN, x, y);
        orbitClick(button, GLUT_UP, x, y);
    }
}

/* Take over the GLUT mouse and motion callbacks; clicks go to click. */
static inline void orbitInstall(OrbitClickFunc click) {
    orbitClick = click;
    glutMouseFunc(orbitMouse);
    glutMotionFunc(orbitMotion);
}

#endif
