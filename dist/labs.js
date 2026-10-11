// Adapted from the COMP 461 OpenGL lab manual. Every code string is a complete
// C/C++ GLUT program; the browser runtime supplies the legacy graphics API.
const header = '#include <GL/glut.h>\n';

function program2D(body, options = {}) {
  const { title = 'COMP 461', width = 500, height = 500,
    bounds = '0.0, 500.0, 0.0, 500.0', background = '1.0, 1.0, 1.0, 1.0',
    extra = '', setup = '' } = options;
  return `${header}${extra}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT);
${body}
    glFlush();
}

void init(void) {
    glClearColor(${background});
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(${bounds});
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
${setup}
}

int main(int argc, char **argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(${width}, ${height});
    glutInitWindowPosition(100, 100);
    glutCreateWindow("${title}");
    init();
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
`;
}

const sphereReshape = `void reshape(int w, int h) {
    if (w < 1) w = 1;
    if (h < 1) h = 1;
    glViewport(0, 0, w, h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    if (w <= h)
        glOrtho(-1.5, 1.5, -1.5*h/w, 1.5*h/w, -10.0, 10.0);
    else
        glOrtho(-1.5*w/h, 1.5*w/h, -1.5, 1.5, -10.0, 10.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}
`;

export const starter = program2D(`    // Add your geometry between glBegin() and glEnd().
    glColor3f(0.0, 0.0, 1.0);
    glBegin(GL_TRIANGLES);
    glVertex2f(100.0, 100.0);
    glVertex2f(400.0, 100.0);
    glVertex2f(250.0, 400.0);
    glEnd();`, { title: 'My OpenGL program' });

export const labs = [
  {
    id: '1A', title: 'Window with clear', group: 'Foundations', page: 14,
    description: 'Create a GLUT window and clear its color buffer.',
    exercise: 'Change the red, green and blue values in glClearColor. Run again to compare backgrounds.',
    notes: ['A blank black window is the expected output. glClearColor sets a value; glClear applies it to the buffer.'],
    code: `${header}
void display(void) {
    glClearColor(0.0, 0.0, 0.0, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);
    glLoadIdentity();
    gluLookAt(0.0, 0.0, 5.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);
    glFlush();
}
int main(int argc, char **argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Window with clear");
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '1B', title: 'Window without clear', group: 'Foundations', page: 14,
    description: 'Compare setting a clear color with actually clearing the window.',
    exercise: 'Set glClearColor to red. Then uncomment glClear and compare the result.',
    notes: ['An uncleared buffer has no portable guaranteed color. The browser may show its initial black buffer.', 'This example deliberately omits glClear, as the manual asks.'],
    code: `${header}
void display(void) {
    glClearColor(0.0, 0.0, 0.0, 1.0);
    // glClear(GL_COLOR_BUFFER_BIT);
    glLoadIdentity();
    gluLookAt(0.0, 0.0, 5.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);
    glFlush();
}
int main(int argc, char **argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Window without clear");
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '2', title: 'First triangle', group: 'Foundations', page: 15,
    description: 'Draw a blue triangle with three vertices in clip coordinates.',
    exercise: 'Give each vertex a different color to see smooth color interpolation.',
    notes: ['The default identity projection shows coordinates between -1 and 1.'],
    code: program2D(`    glBegin(GL_TRIANGLES);
    glColor3f(0.0, 0.0, 1.0);
    glVertex3f(-0.5, -0.5, 0.0);
    glVertex3f( 0.5,  0.0, 0.0);
    glVertex3f( 0.0,  0.5, 0.0);
    glEnd();`, { title: 'Window triangle', width: 320, height: 320, bounds: '-1.0, 1.0, -1.0, 1.0', background: '0.0, 0.0, 0.0, 1.0' })
  },
  {
    id: '3', title: 'A line segment', group: 'Foundations', page: 16,
    description: 'Map a 200 by 150 world window into a 400 by 300 display.',
    exercise: 'Change the endpoints. Add a second line using another pair of vertices.',
    notes: ['GL_LINES treats each pair of vertices as a separate segment.'],
    code: program2D(`    glColor3f(1.0, 0.0, 0.0);
    glBegin(GL_LINES);
    glVertex2i(180, 15);
    glVertex2i(10, 145);
    glEnd();`, { title: 'A line segment', width: 400, height: 300, bounds: '0.0, 200.0, 0.0, 150.0' })
  },
  {
    id: '4', title: 'Line patterns', group: 'Foundations', page: 18,
    description: 'Compare dotted and dashed lines, widths and stipple repeat factors.',
    exercise: 'Change a hexadecimal stipple pattern. Compare one connected strip with separate segments.',
    notes: ['The fifth-row glLineStipple call is restored to display(), where its repeat factor affects that row.', 'The 16-bit pattern repeats along the line. A separate glBegin resets its position.'],
    code: program2D(`    glColor3f(1.0, 1.0, 1.0);
    glEnable(GL_LINE_STIPPLE);
    glLineWidth(1.0);
    glLineStipple(1, 0x0101);
    drawOneLine(50, 125, 150, 125);
    glLineStipple(1, 0x00FF);
    drawOneLine(150, 125, 250, 125);
    glLineStipple(1, 0x1C47);
    drawOneLine(250, 125, 350, 125);

    glLineWidth(5.0);
    glLineStipple(1, 0x0101);
    drawOneLine(50, 100, 150, 100);
    glLineStipple(1, 0x00FF);
    drawOneLine(150, 100, 250, 100);
    glLineStipple(1, 0x1C47);
    drawOneLine(250, 100, 350, 100);

    glLineWidth(1.0);
    glBegin(GL_LINE_STRIP);
    for (int i = 0; i < 7; i++) glVertex2f(50.0 + i*50.0, 75.0);
    glEnd();
    for (int i = 0; i < 6; i++)
        drawOneLine(50.0+i*50.0, 50.0, 50.0+(i+1)*50.0, 50.0);
    glLineStipple(5, 0x1C47);
    drawOneLine(50, 25, 350, 25);
    glDisable(GL_LINE_STIPPLE);`, { title: 'Different line patterns', width: 800, height: 300, bounds: '0.0, 400.0, 0.0, 150.0', background: '0.0, 0.0, 0.0, 1.0', extra: `
void drawOneLine(GLfloat x1, GLfloat y1, GLfloat x2, GLfloat y2) {
    glBegin(GL_LINES);
    glVertex2f(x1, y1);
    glVertex2f(x2, y2);
    glEnd();
}
` })
  },
  {
    id: '5', title: 'Colors, strips & loops', group: 'Foundations', page: 20,
    description: 'Draw colored segments and compare an open line strip with a closed loop.',
    exercise: 'Add a fifth vertex to each zigzag. Which final segment does GL_LINE_LOOP add?',
    notes: ['glColor3f uses color values from 0 to 1. Integer and floating-point vertex functions describe the same coordinate system.'],
    code: program2D(`    glLineWidth(5.0);
    glBegin(GL_LINES);
    glColor3f(0,0,0); glVertex2f(50,50);  glVertex2f(200,50);
    glColor3f(0,0,1); glVertex2f(50,100); glVertex2f(200,100);
    glColor3f(0,1,0); glVertex2f(50,150); glVertex2f(200,150);
    glColor3f(0,1,1); glVertex2f(50,200); glVertex2f(200,200);
    glColor3f(1,0,0); glVertex2f(50,250); glVertex2f(200,250);
    glColor3f(1,0,1); glVertex2f(50,300); glVertex2f(200,300);
    glColor3f(1,1,0); glVertex2f(50,350); glVertex2f(200,350);
    glEnd();
    glColor3f(1,0,1);
    glBegin(GL_LINE_STRIP);
    glVertex2i(250,550); glVertex2i(400,500);
    glVertex2i(250,450); glVertex2i(400,400);
    glEnd();
    glColor3f(1,0,0);
    glBegin(GL_LINE_LOOP);
    glVertex2i(450,550); glVertex2i(600,500);
    glVertex2i(450,450); glVertex2i(600,400);
    glEnd();`, { title: 'Color and GL_LINES', width: 1000, height: 600, bounds: '0.0, 1000.0, 0.0, 600.0' })
  },
  {
    id: '6', title: 'Triangles & polygons', group: 'Foundations', page: 23,
    description: 'Explore triangle strips, fans, quads, quad strips and polygon outlines.',
    exercise: 'Switch GL_LINE to GL_FILL for the strips. Add a vertex and observe the new faces.',
    notes: ['Two displaced triangle-strip vertices are restored inside its glBegin/glEnd pair.', 'Use the valid names GL_TRIANGLES, GL_QUADS and glPolygonMode. The polygon here is convex.'],
    code: program2D(`    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
    glBegin(GL_TRIANGLES);
    glColor3f(0,0,0);
    glVertex2i(50,500); glVertex2i(100,550); glVertex2i(50,600);
    glColor3f(0,0,1);
    glVertex2i(200,500); glVertex2i(200,600); glVertex2i(150,550);
    glEnd();

    glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
    glLineWidth(3.0);
    glBegin(GL_TRIANGLE_STRIP);
    glColor3f(0,1,0);
    glVertex2i(100,450); glVertex2i(50,350);
    glVertex2i(175,400);
    glColor3f(1,0,0); glVertex2i(150,300);
    glEnd();
    glBegin(GL_TRIANGLE_FAN);
    glColor3f(1,0,0); glVertex2i(100,200);
    glVertex2i(50,50); glVertex2i(100,100);
    glColor3f(0,1,0); glVertex2i(150,150);
    glColor3f(0,0,1); glVertex2i(200,200);
    glEnd();

    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
    glColor3f(1,0,1);
    glBegin(GL_QUADS);
    glVertex2i(250,200); glVertex2i(350,200);
    glVertex2i(400,325); glVertex2i(300,325);
    glEnd();
    glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
    glColor3f(0,0,1);
    glBegin(GL_QUAD_STRIP);
    glVertex2i(500,600); glVertex2i(500,400);
    glVertex2i(600,550); glVertex2i(600,350);
    glVertex2i(700,500); glVertex2i(700,300);
    glEnd();
    glBegin(GL_POLYGON);
    glVertex2i(500,200); glVertex2i(500,150); glVertex2i(550,100);
    glVertex2i(600,150); glVertex2i(600,200);
    glEnd();
    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);`, { title: 'Graphic primitives', width: 1000, height: 600, bounds: '0.0, 1000.0, 0.0, 600.0' })
  },
  {
    id: '7', title: 'Midpoint circle', group: 'Foundations', page: 26,
    description: 'Plot eight symmetric points using Bresenham’s midpoint circle algorithm.',
    exercise: 'Draw concentric circles by calling circleMidPoint with the same center and several radii.',
    notes: ['Edit CENTER_X, CENTER_Y and RADIUS near the top. No terminal input is required.', 'The decision value uses integer arithmetic. Drawing commands still use OpenGL.'],
    code: program2D(`    glColor3f(1.0, 0.0, 0.0);
    glPointSize(3.0);
    circleMidPoint(CENTER_X, CENTER_Y, RADIUS);`, { title: 'Midpoint circle algorithm', bounds: '0.0, 300.0, 0.0, 300.0', background: '0.0, 0.0, 0.0, 1.0', extra: `
const GLint CENTER_X = 150, CENTER_Y = 150, RADIUS = 50;

void circlePlotPoints(GLint xc, GLint yc, GLint x, GLint y) {
    glBegin(GL_POINTS);
    glVertex2i(xc+x, yc+y); glVertex2i(xc-x, yc+y);
    glVertex2i(xc+x, yc-y); glVertex2i(xc-x, yc-y);
    glVertex2i(xc+y, yc+x); glVertex2i(xc-y, yc+x);
    glVertex2i(xc+y, yc-x); glVertex2i(xc-y, yc-x);
    glEnd();
}
void circleMidPoint(GLint xc, GLint yc, GLint radius) {
    int x = 0, y = radius;
    int p = 1-radius;
    circlePlotPoints(xc, yc, x, y);
    while (x < y) {
        x++;
        if (p < 0) p += 2*x+1;
        else { y--; p += 2*(x-y)+1; }
        circlePlotPoints(xc, yc, x, y);
    }
}
` })
  },
  {
    id: '8', title: 'Transform with arithmetic', group: 'Transformations', page: 29,
    description: 'Translate, scale and rotate triangle coordinates without OpenGL transform calls.',
    exercise: 'Translate a polygon by (200,200). Then implement uniform scaling by setting sx and sy equal.',
    notes: ['The operations are cumulative: blue original, red translated, green scaled, yellow rotated.', 'The misplaced x translation is restored. fabs is removed from rotation because it incorrectly reflects negative coordinates.', 'The world window includes negative x values so a true 90-degree rotation stays visible.'],
    code: program2D(`    Point vertices[3] = {{50,50}, {100,100}, {150,50}};
    Point rotated[3];
    const GLfloat tx = 100.0, ty = 100.0;
    const GLfloat sx = 2.0, sy = 1.0;
    const GLdouble theta = 3.141592653589793/2.0;
    glColor3f(0,0,1); triangle(vertices);
    translate(vertices, 3, tx, ty);
    glColor3f(1,0,0); triangle(vertices);
    scale(vertices, 3, sx, sy);
    glColor3f(0,1,0); triangle(vertices);
    rotate(vertices, 3, theta, rotated);
    glColor3f(1,1,0); triangle(rotated);`, { title: '2D transformations with arithmetic', width: 700, height: 600, bounds: '-300.0, 600.0, -100.0, 600.0', extra: `#include <math.h>

struct Point { GLfloat x, y; };
void translate(Point *v, int n, GLfloat tx, GLfloat ty) {
    for (int k=0; k<n; k++) { v[k].x += tx; v[k].y += ty; }
}
void scale(Point *v, int n, GLfloat sx, GLfloat sy) {
    for (int k=0; k<n; k++) { v[k].x *= sx; v[k].y *= sy; }
}
void rotate(Point *v, int n, GLdouble theta, Point *out) {
    for (int k=0; k<n; k++) {
        out[k].x = v[k].x*cos(theta)-v[k].y*sin(theta);
        out[k].y = v[k].x*sin(theta)+v[k].y*cos(theta);
    }
}
void triangle(Point *v) {
    glBegin(GL_TRIANGLES);
    for (int k=0; k<3; k++) glVertex2f(v[k].x, v[k].y);
    glEnd();
}
` })
  },
  {
    id: '9', title: 'Transform with OpenGL', group: 'Transformations', page: 34,
    description: 'Compose scaling, rotation and translation on the modelview matrix.',
    exercise: 'Use a quadrilateral. Apply nonuniform scaling, equal x/y translation, then rotate it 270 degrees.',
    notes: ['The matrix calls accumulate as in the manual. OpenGL postmultiplies, so the rightmost transform acts first on each vertex.', 'glLoadIdentity at the start of display prevents transformations accumulating between redraws.'],
    code: `${header}
void triangle(GLfloat offset) {
    glBegin(GL_TRIANGLES);
    glVertex2f(offset, offset);
    glVertex2f(1.0+offset, offset);
    glVertex2f(0.5+offset, 1.0+offset);
    glEnd();
}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    gluLookAt(0,0,5, 0,0,0, 0,1,0);
    glColor3f(1,0,0); triangle(0.0);
    glScalef(1,2,1);
    glColor3f(0,0,1); triangle(0.5);
    glRotatef(180,0,0,1);
    glColor3f(1,0,1); triangle(0.0);
    glTranslatef(2,0,0);
    glColor3f(1,1,0); triangle(0.0);
    glFlush();
}
void reshape(int w, int h) {
    glViewport(0,0,w,h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glFrustum(-1,1,-1,1,1.5,20);
    glMatrixMode(GL_MODELVIEW);
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500,500);
    glutCreateWindow("2D transformations with OpenGL");
    glClearColor(1,1,1,1);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '10', title: 'A solid teapot', group: '3D & interaction', page: 37,
    description: 'Render the classic GLUT teapot in green.',
    exercise: 'Replace glutSolidTeapot with glutWireTeapot and reduce the size to 0.25.',
    notes: ['The displaced glutSolidTeapot call is restored inside display().', 'The unlit solid teapot is a green silhouette, as in the manual. Lab 13 introduces lighting.'],
    code: `${header}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glColor3f(0.4,0.9,0.2);
    glutSolidTeapot(0.5);
    glFlush();
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(500,500);
    glutCreateWindow("Hello, teapot!");
    glClearColor(0,0,0,1);
    glEnable(GL_DEPTH_TEST);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '11', title: 'Shapes & mouse events', group: '3D & interaction', page: 38,
    description: 'Spin wireframe shapes and select sphere, cube, cone, torus or teapot.',
    exercise: 'Decrease ROT_INC. Change the middle button to decrease speed instead of resetting it.',
    notes: ['Left click increases speed. Middle click resets speed. Right click opens the shape menu. Keys 1–5 also select shapes.', 'The misplaced perspective call and menu cases are restored. Rotation uses the manual’s function pointer.'],
    code: `${header}
const GLfloat ROT_INC = 0.1;
GLfloat angle = 0.0, speed = ROT_INC;
void drawSphere(void) { glutWireSphere(6.0,20,20); }
void drawCube(void) { glutWireCube(6.0); }
void drawCone(void) { glutWireCone(6.0,8.0,10,20); }
void drawTorus(void) { glutWireTorus(1.0,6.0,10,20); }
void drawTeapot(void) { glutWireTeapot(6.0); }
void (*drawShape)(void) = drawSphere;
void setShape(int value) {
    switch (value) {
        case 1: drawShape = drawSphere; break;
        case 2: drawShape = drawCube; break;
        case 3: drawShape = drawCone; break;
        case 4: drawShape = drawTorus; break;
        case 5: drawShape = drawTeapot; break;
    }
    glutPostRedisplay();
}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glPushMatrix();
    glRotatef(angle,1,1,1);
    (*drawShape)();
    glPopMatrix();
    glutSwapBuffers();
}
void reshape(int w, int h) {
    if (h < 1) h = 1;
    glViewport(0,0,w,h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(60.0,(GLdouble)w/h,0.1,40.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    gluLookAt(0,0,20, 0,0,0, 0,1,0);
}
void keyboard(unsigned char key, int x, int y) {
    if (key >= '1' && key <= '5') setShape(key-'0');
}
void mouse(int button, int state, int x, int y) {
    if (state != GLUT_DOWN) return;
    if (button == GLUT_LEFT_BUTTON) speed += ROT_INC;
    if (button == GLUT_MIDDLE_BUTTON) speed = ROT_INC;
    glutPostRedisplay();
}
void idle(void) {
    angle += speed;
    if (angle >= 360.0) angle -= 360.0;
    glutPostRedisplay();
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(500,500);
    glutCreateWindow("3D shapes and mouse events");
    glClearColor(1,1,1,1);
    glColor3f(0,0,0);
    glEnable(GL_DEPTH_TEST);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMouseFunc(mouse);
    glutKeyboardFunc(keyboard);
    glutIdleFunc(idle);
    glutCreateMenu(setShape);
    glutAddMenuEntry("Sphere",1);
    glutAddMenuEntry("Cube",2);
    glutAddMenuEntry("Cone",3);
    glutAddMenuEntry("Torus",4);
    glutAddMenuEntry("Teapot",5);
    glutAttachMenu(GLUT_RIGHT_BUTTON);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '12', title: 'Spinning plane', group: '3D & interaction', page: 44,
    description: 'Animate a white square with double buffering and an idle callback.',
    exercise: 'Make the middle button decrease rotation speed. Add vertex colors and smooth shading.',
    notes: ['Left click starts spinning. Middle or right click stops it.', 'The manual’s displaced rotation, color and rectangle calls are restored between push and pop, before drawing.'],
    code: `${header}
GLfloat spin = 0.0;
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT);
    glPushMatrix();
    glRotatef(spin,0,0,1);
    glColor3f(1,1,1);
    glRectf(-25,-25,25,25);
    glPopMatrix();
    glutSwapBuffers();
}
void spinDisplay(void) {
    spin += 2.0;
    if (spin > 360.0) spin -= 360.0;
    glutPostRedisplay();
}
void reshape(int w, int h) {
    glViewport(0,0,w,h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-50,50,-50,50,-1,1);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}
void mouse(int button, int state, int x, int y) {
    if (state != GLUT_DOWN) return;
    if (button == GLUT_LEFT_BUTTON) glutIdleFunc(spinDisplay);
    if (button == GLUT_MIDDLE_BUTTON || button == GLUT_RIGHT_BUTTON)
        glutIdleFunc(0);
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500,500);
    glutCreateWindow("Spinning plane");
    glClearColor(0,0,0,1);
    glShadeModel(GL_FLAT);
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMouseFunc(mouse);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '13', title: 'Lighting a sphere', group: 'Light & materials', page: 47,
    description: 'Use smooth shading, a directional light and a specular material.',
    exercise: 'Compare shininess values 5, 50 and 100. Move the light by changing its x and y components.',
    notes: ['The final light-position value is 0, so the light is directional.', 'Increasing shininess makes the highlight smaller and sharper.'],
    code: `${header}
void init(void) {
    GLfloat specular[] = {1,1,1,1};
    GLfloat shininess[] = {50};
    GLfloat lightPosition[] = {1,1,1,0};
    glClearColor(0,0,0,1);
    glShadeModel(GL_SMOOTH);
    glMaterialfv(GL_FRONT,GL_SPECULAR,specular);
    glMaterialfv(GL_FRONT,GL_SHININESS,shininess);
    glLightfv(GL_LIGHT0,GL_POSITION,lightPosition);
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0);
    glEnable(GL_DEPTH_TEST);
}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glutSolidSphere(1.0,20,16);
    glFlush();
}
${sphereReshape}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(500,500);
    glutCreateWindow("Lighting a sphere");
    init();
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '14', title: 'Change material color', group: 'Light & materials', page: 49,
    description: 'Adjust a lit sphere’s red, green and blue diffuse reflection.',
    exercise: 'Change the color step from 0.1 to 0.05. Compare GL_DIFFUSE with GL_AMBIENT_AND_DIFFUSE.',
    notes: ['Left click changes red, middle click changes green, right click changes blue. Keys R, G and B do the same.', 'The displaced clear and color-update calls are restored inside their callbacks. The initial tracked color matches the material.'],
    code: `${header}
GLfloat diffuseMaterial[4] = {0.5,0.5,0.5,1.0};
void init(void) {
    GLfloat specular[] = {1,1,1,1};
    GLfloat lightPosition[] = {1,1,1,0};
    glClearColor(0,0,0,1);
    glShadeModel(GL_SMOOTH);
    glEnable(GL_DEPTH_TEST);
    glMaterialfv(GL_FRONT,GL_DIFFUSE,diffuseMaterial);
    glMaterialfv(GL_FRONT,GL_SPECULAR,specular);
    glMaterialf(GL_FRONT,GL_SHININESS,25.0);
    glLightfv(GL_LIGHT0,GL_POSITION,lightPosition);
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0);
    glColorMaterial(GL_FRONT,GL_DIFFUSE);
    glEnable(GL_COLOR_MATERIAL);
    glColor4fv(diffuseMaterial);
}
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glutSolidSphere(1.0,20,16);
    glFlush();
}
void changeColor(int channel) {
    diffuseMaterial[channel] += 0.1;
    if (diffuseMaterial[channel] > 1.0) diffuseMaterial[channel] = 0.0;
    glColor4fv(diffuseMaterial);
    glutPostRedisplay();
}
void mouse(int button, int state, int x, int y) {
    if (state != GLUT_DOWN) return;
    if (button == GLUT_LEFT_BUTTON) changeColor(0);
    if (button == GLUT_MIDDLE_BUTTON) changeColor(1);
    if (button == GLUT_RIGHT_BUTTON) changeColor(2);
}
void keyboard(unsigned char key, int x, int y) {
    if (key == 'r' || key == 'R') changeColor(0);
    if (key == 'g' || key == 'G') changeColor(1);
    if (key == 'b' || key == 'B') changeColor(2);
}
${sphereReshape}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(500,500);
    glutCreateWindow("Sphere material color");
    init();
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMouseFunc(mouse);
    glutKeyboardFunc(keyboard);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '15', title: 'Perspective & camera', group: 'Light & materials', page: 53,
    description: 'Draw a slate-blue wire sphere through a perspective projection.',
    exercise: 'Change CAMERA_Z and the field of view. Replace the wire sphere with a solid sphere.',
    notes: ['The missing glutInit is added. The misplaced height guard is repaired so only a zero height becomes 1.', 'The camera moves to z = -4.5 in the modelview transform. The light is positioned after that transform.'],
    code: `${header}
const GLfloat CAMERA_Z = -4.5;
GLfloat ambientLight[] = {0.3,0.3,0.3,1};
GLfloat diffuseLight[] = {0.8,0.8,0.8,1};
GLfloat specularLight[] = {1,1,1,1};
GLfloat specularMaterial[] = {0.7,0.7,0.7,1};
GLfloat lightPosition[] = {-50,50,100,1};
void display(void) {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glColor3ub(150,150,250);
    glPushMatrix();
    glRotatef(45,1,1,1);
    glutWireSphere(1.0,30,30);
    glPopMatrix();
    glutSwapBuffers();
}
void init(void) {
    glClearColor(0,0,0,1);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_LIGHTING);
    glLightfv(GL_LIGHT0,GL_AMBIENT,ambientLight);
    glLightfv(GL_LIGHT0,GL_DIFFUSE,diffuseLight);
    glLightfv(GL_LIGHT0,GL_SPECULAR,specularLight);
    glEnable(GL_LIGHT0);
    glColorMaterial(GL_FRONT,GL_AMBIENT_AND_DIFFUSE);
    glEnable(GL_COLOR_MATERIAL);
    glMaterialfv(GL_FRONT,GL_SPECULAR,specularMaterial);
    glMateriali(GL_FRONT,GL_SHININESS,128);
}
void reshape(int w, int h) {
    if (h < 1) h = 1;
    glViewport(0,0,w,h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(50.0,(GLfloat)w/h,1.0,200.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glTranslatef(0,0,CAMERA_Z);
    glLightfv(GL_LIGHT0,GL_POSITION,lightPosition);
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(500,500);
    glutCreateWindow("Perspective sphere");
    init();
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
`
  },
  {
    id: '16', title: 'Twelve sphere materials', group: 'Light & materials', page: 57,
    description: 'Compare ambient, diffuse, specular and emissive materials in a 3 by 4 grid.',
    exercise: 'Change the blue diffuse color and the emission color. Compare low and high shininess.',
    notes: ['Rows, top to bottom: no ambient, gray ambient, colored ambient. Columns: diffuse only, shininess 5, shininess 100, emission.', 'Repeated sphere blocks are expressed as loops with the same material values.', 'The orthographic bounds include all three complete rows, avoiding clipping at the default aspect ratio.'],
    code: `${header}
void init(void) {
    GLfloat ambient[] = {0,0,0,1};
    GLfloat white[] = {1,1,1,1};
    GLfloat position[] = {0,3,2,0};
    GLfloat modelAmbient[] = {0.4,0.4,0.4,1};
    GLfloat localViewer[] = {0};
    glClearColor(0.0,0.1,0.1,1.0);
    glEnable(GL_DEPTH_TEST);
    glShadeModel(GL_SMOOTH);
    glLightfv(GL_LIGHT0,GL_AMBIENT,ambient);
    glLightfv(GL_LIGHT0,GL_DIFFUSE,white);
    glLightfv(GL_LIGHT0,GL_SPECULAR,white);
    glLightfv(GL_LIGHT0,GL_POSITION,position);
    glLightModelfv(GL_LIGHT_MODEL_AMBIENT,modelAmbient);
    glLightModelfv(GL_LIGHT_MODEL_LOCAL_VIEWER,localViewer);
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0);
}
void display(void) {
    GLfloat noMaterial[] = {0,0,0,1};
    GLfloat grayAmbient[] = {0.7,0.7,0.7,1};
    GLfloat colorAmbient[] = {0.8,0.8,0.2,1};
    GLfloat diffuse[] = {0.1,0.5,0.8,1};
    GLfloat specular[] = {1,1,1,1};
    GLfloat emission[] = {0.3,0.2,0.2,1};
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    for (int row=0; row<3; row++) {
        for (int column=0; column<4; column++) {
            glPushMatrix();
            glTranslatef(-3.75+2.5*column,3.0-3.0*row,0);
            if (row == 0) glMaterialfv(GL_FRONT,GL_AMBIENT,noMaterial);
            if (row == 1) glMaterialfv(GL_FRONT,GL_AMBIENT,grayAmbient);
            if (row == 2) glMaterialfv(GL_FRONT,GL_AMBIENT,colorAmbient);
            glMaterialfv(GL_FRONT,GL_DIFFUSE,diffuse);
            glMaterialfv(GL_FRONT,GL_SPECULAR,noMaterial);
            glMaterialf(GL_FRONT,GL_SHININESS,0);
            glMaterialfv(GL_FRONT,GL_EMISSION,noMaterial);
            if (column == 1 || column == 2)
                glMaterialfv(GL_FRONT,GL_SPECULAR,specular);
            if (column == 1) glMaterialf(GL_FRONT,GL_SHININESS,5);
            if (column == 2) glMaterialf(GL_FRONT,GL_SHININESS,100);
            if (column == 3) glMaterialfv(GL_FRONT,GL_EMISSION,emission);
            glutSolidSphere(1.0,16,16);
            glPopMatrix();
        }
    }
    glFlush();
}
void reshape(int w, int h) {
    if (w < 1) w = 1;
    if (h < 1) h = 1;
    glViewport(0,0,w,h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    GLfloat aspect = (GLfloat)w/h;
    if (aspect >= 1.2) glOrtho(-5.0*aspect,5.0*aspect,-5,5,-10,10);
    else glOrtho(-6,6,-6.0/aspect,6.0/aspect,-10,10);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
}
int main(int argc, char **argv) {
    glutInit(&argc,argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(600,450);
    glutCreateWindow("Twelve sphere materials");
    init();
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutMainLoop();
    return 0;
}
`
  }
];
