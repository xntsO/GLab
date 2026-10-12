# Browser Emscripten integration

This directory contains the complete compiler asset set advertised by the deployed [upstream Emception demo](https://jprendes.github.io/emception/). Its actual packaged Emscripten version is `3.1.24-git`. The compiler runs in a Web Worker on the visitor's device. The worker executes upstream Python `emcc.py`, Wasm LLVM, Wasm Binaryen, and Quicknode to generate new JavaScript and WebAssembly for the supplied source.

`manifest.json` pins all 253 upstream worker and tool assets by download URL, byte length, and SHA256. They total 371,719,667 bytes. The reference source revision is `5ff1975a5d286b200edc380ba8cc0de94d5c0cdc`, as returned by upstream's master-branch metadata on acquisition. This does not establish that revision as the exact build commit of the deployed binaries. The artifact hashes establish the exact distributed version.

## Client API

```js
import { createCompiler } from './compiler-client.js';
const compiler = createCompiler({ onLog: (text, stream) => console.log(stream, text) });
await compiler.initialize();
const result = await compiler.compile({
  source: '#include <cstdio>\nint main(){ std::puts("fresh source"); }',
  language: 'cpp',
  basename: 'visitor',
  args: ['-O0', '-sMODULARIZE=1', '-sEXPORT_NAME=VisitorModule']
});
// result.exitCode, result.stdout, result.stderr
// result.files = [{ path: 'visitor.js', bytes: Uint8Array }, ...]
```

`compile` initializes automatically and defaults to GNU C11 or GNU C++17, preserving the GNU extensions used by Emscripten APIs such as `EM_ASM`. Later `args` can override the standard. Arguments pass as an array to the actual Emscripten driver. Each compile gets an independent source/output directory, and the worker removes it after copying generated files. Emscripten's compiler cache remains available between compilations.

`writeFiles([{path:'/working/lib/source.c', content:'...'}])` and `runCommand(['emcc', ...args])` support library preparation. `runCommand` also supports `em++`, `emar`, and `emranlib`, and returns the driver's exit code and diagnostics. `readFile('/working/lib/libGL.a')` retrieves generated archives. `cancel()` terminates the worker and rejects pending requests; the next compile initializes a fresh worker. `dispose()` does the same.

`compiler-worker.js` imports the unmodified upstream worker bundle and accesses its `globalThis.emception` instance directly. The upstream worker also contains Comlink, but the adapter uses its own small message protocol. Only this adapter implements the client API; it does not replace Emscripten's compiler, linker, Python driver, or JavaScript library generator.

## Assets and caching

The total vendored package includes every advertised library variant, including archives for settings that the UI does not enable. Browsers load the selected libraries lazily. The compressed filesystem package is 23,510,428 bytes; the filesystem and Brotli helper Wasm assets total 951,284 bytes. The filesystem package expands to 120,908,814 bytes and includes these compiler executables:

| Packed executable | Bytes |
| --- | ---: |
| `/wasm/llvm-box.wasm` | 59,447,023 |
| `/wasm/binaryen-box.wasm` | 6,342,560 |
| `/wasm/python.wasm` | 5,800,581 |
| `/wasm/quicknode.wasm` | 1,067,304 |

Upstream caches the filesystem package and selected libraries in IndexedDB. `stats()` returns resource timing entries from inside the worker, measured initialization time, and actual available Wasm heap sizes. These are session observations. A warm IndexedDB cache can avoid network downloads, and a warm HTTP cache can report zero transfer bytes. Resource timings from such a run do not establish first-use download size. Wasm heap bytes also omit JavaScript objects, filesystem buffers, saved module memory snapshots, and browser overhead.

## Restore and verification

Run `python restore_assets.py` beside the manifest. It verifies existing asset hashes, downloads only missing or mismatched files, and refuses content with a different SHA256. Local acquisition scripts and package inventory are in the experiment's `work/emception` directory. No native Emscripten installation is required by visitors.

The parent browser acceptance harness has executed fresh C/C++ compilation, changed-source outputs, syntax-error recovery, C++ standard-library use, stdio, in-memory files, `EM_ASM`, WebGL, and GLFW against this distribution. Its saved evidence belongs to the experiment's tests/evidence directory. GL4ES preparation uses the additional command APIs above and has separate build and rendering checks.

This is a pinned historical Emscripten SDK. Options and ports added after `3.1.24-git` need explicit compatibility checks. The complete upstream asset set does not mean every driver setting, port, pthread mode, or browser device has been tested.

## Primary sources and licenses

[Emception source and build instructions](https://github.com/jprendes/emception) describe its browser compiler architecture. [Its build assembly](https://github.com/jprendes/emception/blob/5ff1975a5d286b200edc380ba8cc0de94d5c0cdc/build-emception.sh) packages the tool runtimes. The delivered asset names and lazy library mappings come from the acquired upstream deployed worker itself.

`LICENSE.MIT` and `LICENSE.Apache-2.0` accompany upstream Emception. `LICENSE.Emception` retains the upstream symlink target text. The `licenses/` tree retains license files extracted from the actual packaged Emscripten filesystem, including Emscripten, compiler-rt, libc++, libc++abi, libunwind, musl, SDL, Acorn, Terser, and LEB128. Additional tool dependency license files accompany the distribution where available.


## Public hosting packaging

This deployment keeps all 249 library archives as lossless Brotli files to fit the Sites expanded archive limit. The public worker maps synchronous archive reads to these compressed files and decodes them with the existing initialized Brotli helper before the unmodified upstream compiler sees them. asset-compression.json records both compressed and original hashes. All archive compression round trips were verified. Original Emscripten library bytes and the canonical manifest remain unchanged.
