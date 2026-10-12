# GL Lab native graphics compatibility

The `freeglut_*.c` and `freeglut_teapot_data.h` files are
unmodified freeglut 2.8.0 source files from revision
`d14a852a70a505e28f8e0b2b47ecde3c3cbe1143`.
Source: https://github.com/freeglut/freeglut/tree/v2.8.0/src
The copyright and license notices remain in the files.

The local `freeglut_internal.h` supplies only the geometry routines' C standard
library includes and fatal allocation handler. Emscripten provides the window,
event-loop, keyboard, mouse, reshape, idle, and timer implementations. GL4ES
provides the OpenGL API; the freeglut shapes call it from compiled WebAssembly.
`legacy-gl.c` initializes GL4ES after GLUT/GLFW creates a current context and
implements GLU's projection and camera helpers. `quadrics.c` implements the
previously supported GLU sphere, cylinder, disk and partial-disk operations.
The upstream freeglut fonts draw through GL4ES's bitmap and immediate-mode APIs.
`library-menus.js` invokes real
Wasm menu callbacks through the existing GL Lab menu UI.

The browser runtime supports one canvas/window. Other GLU operations that need
the full GLU library are not supplied by this compatibility package and produce
ordinary unresolved-symbol diagnostics instead of switching engines.
