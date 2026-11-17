import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot();
  console.log('\n==', f.split('/').pop());
  let tris = 0, verts = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
    tris += (idx ? idx.getCount() : pos.getCount()) / 3; verts += pos.getCount();
    console.log(' prim', m.getName(), 'attrs', p.listSemantics().join(','), 'mode', p.getMode());
  }
  console.log(' tris', tris, 'verts', verts);
  for (const t of root.listTextures()) console.log(' tex', t.getName(), t.getMimeType(), t.getSize()?.join('x'), (t.getImage()?.byteLength/1024|0)+'KB');
  for (const mat of root.listMaterials()) console.log(' mat', mat.getName(), 'base', !!mat.getBaseColorTexture(), 'normal', !!mat.getNormalTexture(), 'mr', !!mat.getMetallicRoughnessTexture(), 'emis', !!mat.getEmissiveTexture(), 'metal', mat.getMetallicFactor(), 'rough', mat.getRoughnessFactor());
  for (const s of root.listSkins()) {
    const j = s.listJoints(); console.log(' skin joints', j.length);
    const parentOf = new Map(); for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
    const depth = (n) => { let d = 0; while (parentOf.get(n)) { n = parentOf.get(n); d++; } return d; };
    console.log('  ' + j.map((n) => '  '.repeat(Math.max(0, depth(n) - depth(j[0]))) + n.getName()).join('\n  '));
  }
  for (const a of root.listAnimations()) console.log(' anim', a.getName(), a.listChannels().length, 'channels');
  for (const n of root.listScenes()[0].listChildren()) console.log(' top node', n.getName(), 'T', n.getTranslation().map(v=>+v.toFixed(3)), 'R', n.getRotation().map(v=>+v.toFixed(3)), 'S', n.getScale().map(v=>+v.toFixed(3)));
  console.log(' extensions', root.listExtensionsUsed().map(e=>e.extensionName).join(','));
}
