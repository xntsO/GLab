# Third-party components

The root MIT license covers original GLab code. Bundled third-party code, binaries, fonts, and data retain their upstream licenses. Preserve their notices when redistributing this project.

| Component | Retained notices and provenance |
| --- | --- |
| Emception and Emscripten toolchain | `dist/emscripten/toolchain/LICENSE.MIT`, `LICENSE.Apache-2.0`, `LICENSE.Emception`, and `licenses/NOTICE.md` |
| LLVM, Binaryen, CPython, Brotli, QuickJS, and SDK libraries | `dist/emscripten/toolchain/licenses/`, including the nested Emscripten notices |
| GL4ES | `dist/emscripten/runtime/GL4ES-LICENSE.txt`, `README.md`, and `provenance.json`; source notices are retained in `gl4es-source.json` |
| freeglut geometry, fonts, and teapot data | Copyright/license headers in `dist/emscripten/toolchain/compat/freeglut_*`; revision documented in that directory's `README.md` |
| CodeMirror | `dist/vendor/codemirror/LICENSE` |
| Atkinson Hyperlegible Next and Mono | SIL Open Font License texts in `dist/vendor/fonts/OFL-Atkinson-Hyperlegible-Next.txt` and `OFL-Atkinson-Hyperlegible-Mono.txt` |
| Older wasm-clang assets retained in the tree | `dist/vendor/compiler/LICENSE`, `LICENSE.llvm`, and `README.txt` |

Compiler asset hashes are recorded in `dist/emscripten/toolchain/manifest.json`. Its notices distinguish known source references from executable versions that were not fully recorded upstream. No broader version/provenance guarantee is implied.
