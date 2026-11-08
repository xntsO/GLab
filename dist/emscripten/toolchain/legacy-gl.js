const directory = '/working/gl-lab-compat';
const sources = ['legacy-gl.c', 'quadrics.c', 'freeglut_geometry.c', 'freeglut_teapot.c', 'freeglut_font.c', 'freeglut_font_data.c', 'freeglut_stroke_mono_roman.c', 'freeglut_stroke_roman.c', 'freeglut_glutfont_definitions.c'];
const resources = [...sources, 'freeglut_teapot_data.h', 'freeglut_internal.h', 'GL/freeglut.h', 'GL/glut.h', 'GL/orbit.h', 'library-menus.js', 'library-input.js'];
export const legacyGLLinkArguments = [
  '-I' + directory, directory + '/libGLLabCompat.a',
  '--js-library', directory + '/library-menus.js',
  '--js-library', directory + '/library-input.js',
  '-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=["$GLLabMenus"]',
  '-Wl,--wrap=glutCreateWindow', '-Wl,--wrap=glfwMakeContextCurrent',
  '-Wl,--wrap=glfwSwapBuffers',
  '-Wl,--wrap=glfwCreateWindow', '-Wl,--wrap=glfwSetWindowTitle',
  '-Wl,--wrap=glutMainLoop', '-Wl,--wrap=glutSwapBuffers', '-Wl,--wrap=emscripten_cancel_main_loop', '-sUSE_GLFW=3'
];
export async function installLegacyGL(compiler, {signal,onProgress=()=>{}}={}) {
  const files = await Promise.all(resources.map(async name => {
    const response = await fetch(new URL('./compat/' + name + '?v=3', import.meta.url), {signal});
    if (!response.ok) throw new Error('Cannot load GL Lab graphics support: ' + name);
    return {path: directory + '/' + name, content: await response.text()};
  }));
  signal?.throwIfAborted();
  await compiler.writeFiles(files);
  // em++ treats .c inputs as C++. Compile the support library with emcc once so
  // its ABI is identical for C and C++ visitor programs.
  const objects=[];
  for (const [index,name] of sources.entries()) {
    signal?.throwIfAborted();
    onProgress(`Preparing graphics libraries ${index+1}/${sources.length}.`);
    const object=directory + '/' + name.replace(/\.c$/, '.o');
    const result=await compiler.runCommand(['emcc',directory+'/'+name,'-c','-O1','-std=gnu11','-DTARGET_HOST_POSIX_X11=1','-I/working/gl4es/include','-I'+directory,'-o',object]);
    if(result.exitCode!==0)throw new Error('Cannot compile GL Lab graphics support: '+[...result.stdout,...result.stderr].join('\n'));
    objects.push(object);
  }
  const archive=await compiler.runCommand(['emar','rcs',directory+'/libGLLabCompat.a',...objects]);
  if(archive.exitCode!==0)throw new Error('Cannot link GL Lab graphics support: '+[...archive.stdout,...archive.stderr].join('\n'));
}
