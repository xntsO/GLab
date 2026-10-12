# GL4ES browser build package

This package contains GL4ES source pinned to [`ec16bedd8819c475326f4f1a3063772c6d986e06`](https://github.com/ptitSeb/gl4es/tree/ec16bedd8819c475326f4f1a3063772c6d986e06). The upstream MIT license is in `GL4ES-LICENSE.txt`. Header files retain their copyright and license notices.

`gl4es-source.json` contains 189 source and companion files and the 69 translation units selected by upstream `src/CMakeLists.txt` for Emscripten. It includes `src/glx/hardext.c`, and excludes Linux GLX implementations. Compilation uses `NOX11`, `NOEGL`, `STATICLIB`, `NO_GBM`, `DEFAULT_ES=2` and disabled constructor initialization. This follows the [upstream Emscripten build](https://ptitseb.github.io/gl4es/COMPILE.html) and uses the deployed Emception SDK version `3.1.24-git`.

The packaged `libGL.a` was built by browser Emscripten `3.1.24-git`. All 69 compile commands and the archive command returned zero. The archive contains 1,882,630 bytes; the complete build took 50.40 seconds. [Browser build evidence](../../evidence/gl4es-build-evidence.json) contains the actual command records. `provenance.json` records the source and archive SHA256 values.

To rebuild, open `build.html` through the experiment server and select **Build GL4ES archive**. The page writes the source into the compiler worker's filesystem, executes browser `emcc -c` commands, then executes `emar rcs`. Save the two download links as `runtime/libGL.a` and `runtime/gl4es-build-evidence.json`. No native compiler or server compilation endpoint participates in this build.

For a fresh worker, call `installGL4ES(compiler)` from `build-gl4es.js` before compiling a visitor program. It installs the actual archive and upstream headers into `/working/gl4es`. Compile legacy OpenGL programs with these arguments in addition to the application's normal Emscripten runtime arguments:

```text
-I/working/gl4es/include /working/gl4es/libGL.a -sFULL_ES2=1 -sUSE_GLFW=3
```

The merged compiler installs this archive automatically for legacy OpenGL programs. Its compatibility library initializes GL4ES after context creation and flushes queued drawing on GLUT or GLFW buffer swaps. The GL4ES headers map desktop GL calls to `gl4es_gl*` symbols under Emscripten, while GLFW uses the underlying WebGL context implementation.

The integration checks under `../tests/merged-integration.html` compile fresh C/C++, WebGL, GLUT and GLFW programs using the actual merged editor adapter. Browser results include emitted artifact sizes, commands, callback events and captured pixel evidence. Experimental example files and the experiment's example picker are not included in this merged site.
