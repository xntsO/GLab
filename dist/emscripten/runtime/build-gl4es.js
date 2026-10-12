const sourceUrl = new URL('./gl4es-source.json', import.meta.url);
export const gl4esDirectory = '/working/gl4es';
export const gl4esLinkArguments = ['-I/working/gl4es/include', '/working/gl4es/libGL.a', '-sFULL_ES2=1'];

export async function buildGL4ES(compiler, onProgress = () => {}) {
  const started = performance.now();
  const manifest = await fetch(sourceUrl, {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error(`GL4ES source package HTTP ${response.status}`);
    return response.json();
  });
  const info = await compiler.initialize();
  if (info.version !== manifest.emscriptenVersion) throw new Error(`GL4ES package expects Emscripten ${manifest.emscriptenVersion}, found ${info.version}`);
  await compiler.writeFiles(manifest.files.map(file => ({...file, path: `${gl4esDirectory}/${file.path}`})));
  const objects = [];
  const records = [];
  for (let index = 0; index < manifest.sources.length; index++) {
    const source = manifest.sources[index];
    const object = `${gl4esDirectory}/objects/${source.replaceAll('/', '_').replace(/\.c$/, '.o')}`;
    onProgress({index, total: manifest.sources.length, source});
    // Creating the object parent directory through the same filesystem API keeps
    // all source and generated object files in the compiler worker's MEMFS.
    if (!index) await compiler.writeFiles([{path: `${gl4esDirectory}/objects/.keep`, content: ''}]);
    const argv = ['emcc', `${gl4esDirectory}/${source}`, '-c', ...manifest.flags,
      `-I${gl4esDirectory}/include`, `-I${gl4esDirectory}/src/util`, `-I${gl4esDirectory}/src/glx`, '-o', object];
    const commandStarted = performance.now();
    const result = await compiler.runCommand(argv);
    records.push({source, argv, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr,
      durationSeconds: (performance.now() - commandStarted) / 1000});
    if (result.exitCode !== 0) throw Object.assign(new Error(`GL4ES compilation failed for ${source}: ${(result.stderr || []).join('\n')}`), {records});
    objects.push(object);
  }
  const archiveCommand = ['emar', 'rcs', `${gl4esDirectory}/libGL.a`, ...objects];
  const archiveResult = await compiler.runCommand(archiveCommand);
  records.push({argv: archiveCommand, exitCode: archiveResult.exitCode, stdout: archiveResult.stdout, stderr: archiveResult.stderr});
  if (archiveResult.exitCode !== 0) throw Object.assign(new Error(`GL4ES archive failed: ${(archiveResult.stderr || []).join('\n')}`), {records});
  const archive = await compiler.readFile(`${gl4esDirectory}/libGL.a`);
  const result = {repository: manifest.repository, revision: manifest.revision, emscriptenVersion: info.version,
    sourceCount: manifest.sources.length, archiveBytes: archive.length,
    durationSeconds: (performance.now() - started) / 1000, stats: archiveResult.stats, records};
  onProgress({index: manifest.sources.length, total: manifest.sources.length, done: true});
  return {archive, evidence: result, headers: manifest.files.filter(file => file.path.startsWith('include/'))};
}

export async function installGL4ES(compiler, {signal, onProgress = () => {}} = {}) {
  onProgress('Loading the GL4ES archive and headers…');
  const [manifest, response] = await Promise.all([
    fetch(sourceUrl, {cache: 'no-store', signal}).then(response => response.json()),
    fetch(new URL('./libGL.a', import.meta.url), {signal})
  ]);
  if (!response.ok) throw new Error('Build the pinned GL4ES archive with runtime/build.html first.');
  const archive = new Uint8Array(await response.arrayBuffer());
  signal?.throwIfAborted();
  onProgress('Installing GL4ES into the browser compiler…');
  await compiler.writeFiles([
    ...manifest.files.filter(file => file.path.startsWith('include/')).map(file => ({...file, path: `${gl4esDirectory}/${file.path}`})),
    {path: `${gl4esDirectory}/libGL.a`, bytes: archive}
  ]);
  return {revision: manifest.revision, archiveBytes: archive.length};
}
