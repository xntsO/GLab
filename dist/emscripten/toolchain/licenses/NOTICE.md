# Compiler dependency notices

This distribution retains Emception's MIT and Apache 2.0 license texts in the parent directory. `LICENSE.Emception` contains the upstream symlink target; `LICENSE.MIT` contains that target's full text.

The nested `emscripten/` tree contains license and copyright files extracted directly from the shipped compiler filesystem package. These cover Emscripten and the packaged libc++, libc++abi, libunwind, compiler-rt, musl, SDL, Acorn, Terser, and LEB128 components.

The following additional texts accompany the tool executables in the package:

| Component | Local notice | Primary source used to obtain the text |
| --- | --- | --- |
| LLVM | `LLVM.LICENSE` | [LLVM 15.0.1 license](https://github.com/llvm/llvm-project/blob/llvmorg-15.0.1/llvm/LICENSE.TXT) |
| Binaryen | `Binaryen.LICENSE` | [Binaryen 110 license](https://github.com/WebAssembly/binaryen/blob/version_110/LICENSE) |
| CPython | `CPython.LICENSE` | [CPython 3.12.0 license](https://github.com/python/cpython/blob/v3.12.0/LICENSE) |
| Brotli | `Brotli.LICENSE` | [Brotli 1.0.9 license](https://github.com/google/brotli/blob/v1.0.9/LICENSE) |
| QuickJS inside Quicknode | `QuickJS.LICENSE` | [QuickJS license](https://github.com/bellard/quickjs/blob/master/LICENSE) |

The deployed compiler package identifies Emscripten as `3.1.24-git` and includes a Python 3.12 standard-library directory. It does not include a complete record of the exact source commits used to build every LLVM, Binaryen, CPython, Brotli, or QuickJS executable. The source tags in the table identify where the accompanying license texts were obtained; they do not establish the exact executable versions. The unmodified deployed assets themselves are pinned by SHA256 in `../manifest.json`.

The experiment's separately prepared GL4ES source and archive have their own license and provenance files in `../../runtime/`.
