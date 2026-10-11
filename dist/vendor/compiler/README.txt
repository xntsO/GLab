Compiler assets from https://github.com/binji/wasm-clang
Clang 8.0.1 and LLVM LLD compile C11 / C++17 directly to WebAssembly.
The compiler, linker, in-memory WASI filesystem, and standard library sysroot
are compressed with gzip. The loader decompresses them in the browser using
DecompressionStream. The source code is compiled inside a dedicated worker.

Upstream JavaScript and assets retain their Apache 2.0 / LLVM licenses in
LICENSE and LICENSE.llvm. shared.js is the upstream runtime unmodified.
header.js contains this playground's GL / GLU / GLUT declarations.
Both GL/ and gl/ include spellings are supported, including legacy gl/Gl.h.
windows.h is an empty include-only compatibility stub for old lab source.
It supplies no Windows types, functions, or operating-system access.

Full operating-system APIs, native GPU drivers, and C++ exceptions are outside
this browser target. Filesystem access from a running program is not exposed.
Legacy OpenGL calls are provided by graphics.js on WebGL.
