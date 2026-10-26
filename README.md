# GLab

A C/C++ and OpenGL workspace that compiles and runs programs in your browser.

**Try it:** [gl-lab.fhas.sa](https://gl-lab.fhas.sa)

GLab uses Emscripten through Emception to compile C11 and C++17 to WebAssembly. GL4ES translates supported legacy OpenGL calls to WebGL. Compilation runs in a worker; generated programs run in a sandboxed frame. Source code is not sent to a compilation server.

## Features

- Code editor with browser-local drafts, import/export, line wrapping, and compiler diagnostics.
- Desktop and mobile layouts, resizable and collapsible panels, and dark/light themes.
- GLUT/GLFW graphics, supported GLU helpers, keyboard and mouse input, PNG capture, and a separate output window.
- Standard input supplied before each run, console output, build arguments, and JS/Wasm export.
- English and Arabic guides and a hidden teaching library.

## Run locally

Clone the repository and serve the static directory with Python 3:

```sh
git clone https://github.com/xntsO/GLab.git
cd GLab
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:8000>. No Node package installation or build step is required. Use HTTP or HTTPS, not a `file://` URL. Keep the checked-in compiler assets and license notices together. The repository contains roughly 133 MB of assets; first use downloads the compiler tools plus the libraries needed by your program.

## Source map

| Path | Purpose |
| --- | --- |
| `dist/index.html`, `style.css`, `app.js`, `workspace-ui.js` | Workspace UI, editor, drafts, and controls |
| `dist/emscripten-compiler.js` | Browser compiler integration |
| `dist/emscripten-adapter.js` | Compiler/runner interface used by the editor |
| `dist/emscripten/toolchain/` | Compiler worker, compressed SDK, and native compatibility helpers |
| `dist/emscripten/runtime/` | Sandboxed program execution and GL4ES source/archive |
| `dist/output*` | Separate graphics window and message protocol |
| `dist/emscripten/tests/` | Compiler/runtime integration checks |
| `dist/about.html`, `dist/ar/`, `dist/compatibility.html` | Guides and compatibility information |

Older compiler and graphics assets remain in the tree for historical compatibility. The editor's active backend is selected by its import of `emscripten-adapter.js`.

## Verify a change

With the local server running, open:

```text
http://127.0.0.1:8000/emscripten/tests/merged-integration.html?autorun
```

The suite has 35 checks for compilation, standard-library behavior, graphics pixels, input, error recovery, and the output mirror. It does not replace testing the actual editor. For UI changes, also exercise desktop and phone layouts, Run/Stop, draft preservation, build options, and the pop-out window. Report the browser used and the checks actually run.

## Limitations

- Emscripten is pinned to `3.1.24-git`; this is not the latest SDK.
- GL4ES/WebGL supports a subset of desktop OpenGL. One source file and one graphics window are supported.
- Input is supplied before running. In-memory program files are discarded when the run is disposed.
- Native operating-system APIs and arbitrary installed packages are unavailable. Pthread builds are outside the supported configuration.
- A synchronous infinite loop can block the browser tab. Animation must yield through GLUT callbacks or an Emscripten main loop.
- Compilation can use hundreds of MB of memory. Actual phone performance depends on the browser and device.

See the [compatibility guide](https://gl-lab.fhas.sa/compatibility) for more detail.

## Source synchronization and deployment

This repository was initialized from the Cloud Site's version-10 source commit, `6d569db69c5bfdbedd3546352b518549ce64fe84`, retaining its Git history.

GitHub pushes do **not** automatically deploy the live Site. `.openai/hosting.json` identifies the existing hosted project; it contains no credential. Contributors can serve `dist` independently and should use their own Site identity when deploying a fork.

The maintainer should synchronize the latest Sites source before making local changes, reconcile any local/GitHub changes without discarding either history, and push the reconciled source to both remotes. Use the Sites plugin's source workflow for Sites authentication; keep short-lived credentials out of Git and shell arguments. Publish only the intended tested commit. If Cloud work changes the Sites branch, repeat synchronization before pushing or deploying from this device. No scheduled or automatic synchronization is configured by this repository.

## License

Original GLab code is available under the [MIT License](LICENSE). Bundled dependencies retain their own licenses and copyright notices; see [THIRD_PARTY.md](THIRD_PARTY.md). The root license does not replace their terms.
