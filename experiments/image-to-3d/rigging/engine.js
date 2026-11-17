// In-engine test harness for Experiment 2: Three.js + Rapier, the same stack as the game.
// Loads one rigged character (plus clip files), then runs deformation, weapon, ragdoll, hit-region and
// lighting tests. Everything is driven from window.__engine so scripts/engine_tests.mjs can automate it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from '@dimforge/rapier3d-compat';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const V = () => new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// Scene, lighting presets
// ---------------------------------------------------------------------------------------------
export function createStage(canvas, { preserve = false } = {}) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	const scene = new THREE.Scene();
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	const hemi = new THREE.HemisphereLight();
	const key = new THREE.DirectionalLight();
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 20 });
	key.shadow.bias = -0.0005;
	const rim = new THREE.DirectionalLight();
	const torch = new THREE.PointLight(0xff9a4a, 0, 6, 1.6);
	scene.add(hemi, key, rim, torch);
	const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x3b3f36, roughness: 1 }));
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;
	scene.add(ground);
	const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
	camera.position.set(0, 1.0, 3.4);
	const controls = new OrbitControls(camera, canvas);
	controls.target.set(0, 0.55, 0);
	const stage = { renderer, scene, camera, controls, hemi, key, rim, torch, ground };
	setLighting(stage, 'day');
	const resize = () => {
		const { clientWidth: w, clientHeight: h } = canvas.parentElement;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	};
	addEventListener('resize', resize);
	resize();
	return stage;
}

export function setLighting(stage, mode) {
	const { scene, renderer, hemi, key, rim, torch, ground } = stage;
	if (mode === 'night') {
		scene.background = new THREE.Color(0x0b1020);
		scene.fog = new THREE.Fog(0x0b1020, 5, 14);
		scene.environmentIntensity = 0.12;
		renderer.toneMappingExposure = 1.2;
		hemi.color.set(0x5b6f9c); hemi.groundColor.set(0x141018); hemi.intensity = 0.55;
		key.color.set(0x9fb6ff); key.intensity = 0.9; key.position.set(-3, 5, 2);
		rim.color.set(0x7fa0ff); rim.intensity = 0.7; rim.position.set(2, 2.5, -3.5);
		torch.intensity = 3.2; torch.position.set(0.9, 1.0, 1.2);
		ground.material.color.set(0x2a2d33);
	} else {
		scene.background = new THREE.Color(0x8fa6bf);
		scene.fog = new THREE.Fog(0x8fa6bf, 8, 20);
		scene.environmentIntensity = 0.55;
		renderer.toneMappingExposure = 1.15;
		hemi.color.set(0xd8e6ff); hemi.groundColor.set(0x5a4a38); hemi.intensity = 1.4;
		key.color.set(0xfff0d8); key.intensity = 2.8; key.position.set(3, 5, 2.5);
		rim.color.set(0xcfe0ff); rim.intensity = 0.8; rim.position.set(-3, 2.5, -3.5);
		torch.intensity = 0;
		ground.material.color.set(0x5d6a4a);
	}
}

// ---------------------------------------------------------------------------------------------
// Loading: rig + clips from separate files, bound by bone name
// ---------------------------------------------------------------------------------------------
export async function loadCharacter(entry, base = '') {
	const gltf = await loader.loadAsync(base + entry.rigged);
	const inner = gltf.scene;
	const root = new THREE.Group();
	inner.rotation.y = ((entry.facing ?? 0) * Math.PI) / 180;
	root.add(inner);
	const skinned = [];
	inner.traverse((o) => {
		if (o.isSkinnedMesh) skinned.push(o);
		if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
	});
	if (!skinned.length) throw new Error(`${entry.rigged}: no SkinnedMesh`);
	const skeleton = skinned[0].skeleton;
	// Node rest pose (glTF translations) before skeleton.pose() replaces it with the bind pose.
	const nodeRest = new Map(skeleton.bones.map((b) => [b, b.position.clone()]));
	// Facing: Tripo API exports do not share one forward axis, so derive it from the skeleton (foot -> toe
	// for bipeds, tail -> root for tailed creatures) and turn it to +Z. entry.facing adds a manual yaw.
	skeleton.pose();
	root.updateMatrixWorld(true);
	const autoYaw = facingYaw(skeleton);
	inner.rotation.y = (((entry.facing ?? 0) + (entry.autoFacing === false ? 0 : autoYaw)) * Math.PI) / 180;
	root.updateMatrixWorld(true);
	const box = new THREE.Box3();
	for (const m of skinned) box.union(skinnedBox(m));
	const size = box.getSize(V());
	const s = (entry.height ?? 1.1) / size.y;
	root.scale.setScalar(s);
	const c = box.getCenter(V());
	root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
	root.updateMatrixWorld(true);

	const clips = {};
	for (const a of gltf.animations) clips[clipName(a.name)] = a;
	for (const file of entry.clipFiles ?? []) {
		const g = await loader.loadAsync(base + file);
		for (const a of g.animations) { const c = a.clone(); c.name = clipName(a.name); clips[c.name] = c; }
	}
	for (const [name, file] of Object.entries(entry.clips ?? {})) {
		const g = await loader.loadAsync(base + file);
		if (!g.animations.length) continue;
		// A per-clip file may carry several takes; keep the longest.
		const take = g.animations.reduce((a, b) => (b.duration > a.duration ? b : a));
		clips[name] = take.clone();
		clips[name].name = name;
	}
	// Tripo's quadruped export binds the skin with the root bone ~0.4 m above the root's node translation,
	// and its clips key the root at the node value, sinking the body into the ground. Rebase every position
	// track onto the bind pose: add (bind - node rest) for the bone it drives.
	skeleton.pose();
	const bindRest = new Map(skeleton.bones.map((b) => [b, b.position.clone()]));
	const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
	const restMismatch = [];
	for (const b of skeleton.bones) {
		const d = bindRest.get(b).clone().sub(nodeRest.get(b));
		if (d.length() > 1e-3 * (entry.height ?? 1) / s) restMismatch.push({ bone: b.name, offset: +d.length().toFixed(4) });
	}
	for (const clip of Object.values(clips)) for (const track of clip.tracks) {
		if (!track.name.endsWith('.position')) continue;
		const b = byName.get(track.name.slice(0, -'.position'.length));
		if (!b) continue;
		const d = bindRest.get(b).clone().sub(nodeRest.get(b));
		if (d.lengthSq() < 1e-10) continue;
		for (let i = 0; i < track.values.length; i += 3) { track.values[i] += d.x; track.values[i + 1] += d.y; track.values[i + 2] += d.z; }
	}
	const mixer = new THREE.AnimationMixer(inner);
	const bones = mapBones(skeleton);
	return { entry, root, inner, skinned, skeleton, clips, mixer, bones, height: entry.height ?? 1.1, scale: s, autoYaw, restMismatch };
}

function facingYaw(skeleton) {
	const W = (b) => b.getWorldPosition(new THREE.Vector3());
	const fwd = new THREE.Vector3();
	for (const b of skeleton.bones) {
		const { part } = partOf(b.name);
		const toe = b.children.find((k) => k.isBone && partOf(k.name).part === 'toe');
		if (part === 'foot' && toe) fwd.add(W(toe).sub(W(b)));
	}
	if (fwd.x ** 2 + fwd.z ** 2 < 1e-8) {
		const tail = skeleton.bones.find((b) => /tail/i.test(b.name));
		if (tail) fwd.copy(W(skeleton.bones[0])).sub(W(tail));
	}
	if (fwd.x ** 2 + fwd.z ** 2 < 1e-8) return 0;
	// Snap to the nearest quarter turn: exports are axis-aligned; feet splay a few degrees.
	const yaw = (-Math.atan2(fwd.x, fwd.z) * 180) / Math.PI;
	return Math.round(yaw / 90) * 90;
}

function clipName(n) {
	const l = n.toLowerCase();
	for (const k of ['idle', 'walk', 'run', 'attack', 'slash', 'hit', 'hurt', 'death', 'die', 'fall'])
		if (l.includes(k)) return { slash: 'attack', hurt: 'hit', die: 'death', fall: 'death' }[k] ?? k;
	return n;
}

function skinnedBox(mesh) {
	const box = new THREE.Box3();
	const p = V();
	const n = mesh.geometry.attributes.position.count;
	const step = Math.max(1, Math.floor(n / 4000));
	mesh.updateMatrixWorld(true);
	for (let i = 0; i < n; i += step) {
		mesh.getVertexPosition(i, p);
		box.expandByPoint(p.applyMatrix4(mesh.matrixWorld));
	}
	return box;
}

// ---------------------------------------------------------------------------------------------
// Bone mapping: canonical humanoid parts from Mixamo, Tripo, Blender-style or other names
// ---------------------------------------------------------------------------------------------
const PART_RULES = [
	['finger', /thumb|index|middle|ring|pinky|finger|digit/],
	['toe', /toe/],
	['hand', /hand|wrist/],
	['forearm', /fore_?arm|lower_?arm|elbow/],
	['clavicle', /clavicle|shoulder|collar/],
	['upperarm', /upper_?arm|arm/],
	['thigh', /thigh|up_?leg|upper_?leg/],
	['shin', /shin|calf|lower_?leg|knee|leg/],
	['foot', /foot|ankle/],
	['head', /head/],
	['neck', /neck/],
	['hips', /hips|pelvis/],
	['spine', /spine|chest|torso|abdomen|belly/],
	['tail', /tail/],
	['end', /_end$|end$|top$|tip$|nub$/]
];

export function partOf(name) {
	const n = name.toLowerCase().replace(/^mixamorig[:_]?/, '');
	if (/_end$|end$|top_?end|nub$/.test(n)) return { part: 'end', side: null };
	for (const [part, re] of PART_RULES) {
		const m = n.match(re);
		if (!m) continue;
		const rest = (n.slice(0, m.index) + ' ' + n.slice(m.index + m[0].length)).replace(/[0-9]/g, ' ');
		let side = null;
		if (/left/.test(n) || /(^|[^a-z])l([^a-z]|$)/.test(rest) || /(^|[^a-z])l$/.test(rest.trim()) || /^l[^a-z]/.test(rest.trim())) side = 'l';
		if (/right/.test(n) || /(^|[^a-z])r([^a-z]|$)/.test(rest) || /(^|[^a-z])r$/.test(rest.trim()) || /^r[^a-z]/.test(rest.trim())) side = 'r';
		// Sanitized Blender names like "forearmL": trailing single letter after the part word.
		if (!side && /^\s*l\s*$/.test(rest)) side = 'l';
		if (!side && /^\s*r\s*$/.test(rest)) side = 'r';
		return { part, side };
	}
	return { part: 'other', side: null };
}

export function mapBones(skeleton) {
	const byKey = {};
	const info = new Map();
	for (const b of skeleton.bones) {
		const p = partOf(b.name);
		info.set(b, p);
		const key = p.side ? `${p.part}_${p.side}` : p.part;
		(byKey[key] ??= []).push(b);
	}
	// For multi-bone parts (spine1..3) keep the chain order: first = closest to the root.
	const depth = (b) => { let d = 0; for (let x = b; x.parent; x = x.parent) d++; return d; };
	for (const k of Object.keys(byKey)) byKey[k].sort((a, b) => depth(a) - depth(b));
	const one = (k, last = false) => (byKey[k] ? byKey[k][last ? byKey[k].length - 1 : 0] : null);
	const canon = {
		hips: one('hips') ?? skeleton.bones[0], spine: one('spine'), chest: one('spine', true), neck: one('neck'), head: one('head'),
		clavicle_l: one('clavicle_l'), clavicle_r: one('clavicle_r'),
		upperarm_l: one('upperarm_l'), upperarm_r: one('upperarm_r'), forearm_l: one('forearm_l'), forearm_r: one('forearm_r'),
		hand_l: one('hand_l'), hand_r: one('hand_r'), thigh_l: one('thigh_l'), thigh_r: one('thigh_r'),
		shin_l: one('shin_l'), shin_r: one('shin_r'), foot_l: one('foot_l'), foot_r: one('foot_r')
	};
	return { canon, info, byKey, names: skeleton.bones.map((b) => b.name) };
}

export function describeSkeleton(ch) {
	const { skeleton, bones } = ch;
	const lines = [];
	const walk = (b, d) => {
		lines.push(`${'  '.repeat(d)}${b.name}`);
		for (const c of b.children) if (c.isBone) walk(c, d + 1);
	};
	const roots = skeleton.bones.filter((b) => !b.parent?.isBone);
	roots.forEach((r) => walk(r, 0));
	const canon = Object.fromEntries(Object.entries(bones.canon).map(([k, b]) => [k, b?.name ?? null]));
	return { count: skeleton.bones.length, roots: roots.map((r) => r.name), hierarchy: lines.join('\n'), canonical: canon,
		missing: Object.entries(canon).filter(([, v]) => !v).map(([k]) => k) };
}

// ---------------------------------------------------------------------------------------------
// Skinned vertex sampling and vertex regions
// ---------------------------------------------------------------------------------------------
function skinnedPositions(mesh, out) {
	const n = mesh.geometry.attributes.position.count;
	const p = V();
	for (let i = 0; i < n; i++) {
		mesh.getVertexPosition(i, p);
		p.applyMatrix4(mesh.matrixWorld);
		out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = p.z;
	}
	return out;
}

function dominantParts(mesh, bones) {
	const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
	const n = si.count;
	const res = new Array(n);
	for (let i = 0; i < n; i++) {
		const acc = {};
		for (let k = 0; k < 4; k++) {
			const w = sw.getComponent(i, k);
			if (w <= 0) continue;
			const b = mesh.skeleton.bones[si.getComponent(i, k)];
			const p = bones.info.get(b) ?? { part: 'other' };
			const key = p.side ? `${p.part}_${p.side}` : p.part;
			acc[key] = (acc[key] ?? 0) + w;
		}
		res[i] = acc;
	}
	return res;
}

const has = (acc, keys, min) => keys.some((k) => (acc[k] ?? 0) >= min);
const sideKeys = (part) => [`${part}_l`, `${part}_r`];

// Joint regions for the deformation metric, from skin-weight blend zones.
function deformationRegions(mesh, bones, restPos, height) {
	const parts = dominantParts(mesh, bones);
	const regions = { elbow: [], knee: [], shoulder: [], hip: [], neck: [], ears: [], loincloth: [], all: [] };
	const head = bones.canon.head, hips = bones.canon.hips;
	const headPos = head ? head.getWorldPosition(V()) : null;
	const hipsPos = hips.getWorldPosition(V());
	for (let i = 0; i < parts.length; i++) {
		const a = parts[i];
		regions.all.push(i);
		for (const s of ['l', 'r']) {
			if ((a[`upperarm_${s}`] ?? 0) >= 0.2 && (a[`forearm_${s}`] ?? 0) >= 0.2) regions.elbow.push(i);
			if ((a[`thigh_${s}`] ?? 0) >= 0.2 && (a[`shin_${s}`] ?? 0) >= 0.2) regions.knee.push(i);
			if ((a[`upperarm_${s}`] ?? 0) >= 0.2 && ((a[`clavicle_${s}`] ?? 0) + (a.spine ?? 0)) >= 0.2) regions.shoulder.push(i);
			if ((a[`thigh_${s}`] ?? 0) >= 0.2 && ((a.hips ?? 0) + (a.spine ?? 0)) >= 0.2) regions.hip.push(i);
		}
		if ((a.neck ?? 0) >= 0.2 && ((a.head ?? 0) + (a.spine ?? 0)) >= 0.2) regions.neck.push(i);
		const y = restPos[i * 3 + 1];
		if (headPos && (a.head ?? 0) > 0.6) {
			const dx = restPos[i * 3] - headPos.x, dz = restPos[i * 3 + 2] - headPos.z;
			if (Math.hypot(dx, dz) > 0.09 * height) regions.ears.push(i);
		}
		// Cloth hanging around the hips: hip/thigh-weighted vertices in the band just below the pelvis.
		if (((a.hips ?? 0) + (a.thigh_l ?? 0) + (a.thigh_r ?? 0)) > 0.6 && y < hipsPos.y && y > hipsPos.y - 0.22 * height) regions.loincloth.push(i);
	}
	return regions;
}

function edgesOf(geometry) {
	const idx = geometry.index;
	const seen = new Set();
	const edges = [];
	const n = idx ? idx.count : geometry.attributes.position.count;
	for (let t = 0; t < n; t += 3) {
		const tri = idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2];
		for (let e = 0; e < 3; e++) {
			const a = tri[e], b = tri[(e + 1) % 3];
			const key = a < b ? a * 1e7 + b : b * 1e7 + a;
			if (!seen.has(key)) { seen.add(key); edges.push(a, b); }
		}
	}
	return new Uint32Array(edges);
}

// Edge-stretch metric: for each sampled frame, the 99th percentile of |log(len/restLen)| per region.
export function deformation(ch, clipName, samples = 24) {
	const clip = ch.clips[clipName];
	if (!clip) return null;
	const mesh = ch.skinned[0];
	const n = mesh.geometry.attributes.position.count;
	ch.mixer.stopAllAction();
	ch.skeleton.pose();
	ch.root.updateMatrixWorld(true);
	const rest = skinnedPositions(mesh, new Float32Array(n * 3));
	const regions = deformationRegions(mesh, ch.bones, rest, ch.height);
	const edges = edgesOf(mesh.geometry);
	const restLen = new Float32Array(edges.length / 2);
	for (let e = 0; e < restLen.length; e++) restLen[e] = dist(rest, edges[2 * e], edges[2 * e + 1]);
	const regionOfVertex = {};
	for (const [r, list] of Object.entries(regions)) { const s = new Uint8Array(n); list.forEach((i) => (s[i] = 1)); regionOfVertex[r] = s; }
	const action = ch.mixer.clipAction(clip);
	action.reset().play();
	const pos = new Float32Array(n * 3);
	const frames = [];
	for (let f = 0; f < samples; f++) {
		const t = (clip.duration * f) / samples;
		ch.mixer.setTime(t);
		ch.root.updateMatrixWorld(true);
		skinnedPositions(mesh, pos);
		const per = {};
		for (const r of Object.keys(regions)) per[r] = [];
		for (let e = 0; e < restLen.length; e++) {
			if (restLen[e] < 1e-6) continue;
			const a = edges[2 * e], b = edges[2 * e + 1];
			const v = Math.abs(Math.log(dist(pos, a, b) / restLen[e]));
			for (const r of Object.keys(regions)) if (regionOfVertex[r][a] && regionOfVertex[r][b]) per[r].push(v);
		}
		const summary = {};
		for (const [r, vals] of Object.entries(per)) summary[r] = vals.length ? +(Math.exp(pct(vals, 0.99)) - 1).toFixed(3) : null;
		frames.push({ t: +t.toFixed(3), stretch: summary });
	}
	action.stop();
	const worst = frames.reduce((a, b) => ((b.stretch.all ?? 0) > (a.stretch.all ?? 0) ? b : a));
	const peak = {};
	for (const r of Object.keys(regions)) peak[r] = Math.max(...frames.map((f) => f.stretch[r] ?? 0));
	return { clip: clipName, duration: +clip.duration.toFixed(3), samples, regionVertexCounts: Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, v.length])), peak, worstFrame: worst };
}

const dist = (p, a, b) => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
function pct(arr, q) { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }

// ---------------------------------------------------------------------------------------------
// Bone segments in bind pose: every vertex is assigned to its geometrically nearest segment.
// Hit volumes, prop mounts and ragdoll capsules are all sized from these assignments, so they do not
// depend on how the auto-rigger spread its skin weights.
// ---------------------------------------------------------------------------------------------
const AXIAL = new Set(['spine', 'neck', 'head']);

function boneSegment(b, info, height) {
	const a = b.getWorldPosition(V());
	const kids = b.children.filter((k) => k.isBone);
	const p = info.get(b);
	if (!kids.length) {
		if (p.part !== 'head') return null;
		return { bone: b, a, tip: a.clone().add(new THREE.Vector3(0, 0.12 * height, 0)), part: p.part, side: p.side };
	}
	// Branching bones follow the body's axis: hips -> spine, chest -> neck. Otherwise average the children.
	const axial = kids.find((k) => AXIAL.has(info.get(k)?.part));
	const tip = axial ? axial.getWorldPosition(V()) : kids.length === 1 ? kids[0].getWorldPosition(V())
		: kids.map((k) => k.getWorldPosition(V())).reduce((s, v) => s.add(v), V()).multiplyScalar(1 / kids.length);
	return { bone: b, a, tip, part: p.part, side: p.side };
}

export function segments(ch) {
	if (ch._segments) return ch._segments;
	ch.mixer.stopAllAction();
	ch.skeleton.pose();
	ch.root.updateMatrixWorld(true);
	const mesh = ch.skinned[0];
	const n = mesh.geometry.attributes.position.count;
	const pos = skinnedPositions(mesh, new Float32Array(n * 3));
	const segs = [];
	for (const b of ch.skeleton.bones) {
		const p = ch.bones.info.get(b);
		if (['finger', 'end'].includes(p.part)) continue;
		const s = boneSegment(b, ch.bones.info, ch.height);
		if (!s || s.a.distanceTo(s.tip) < 1e-4) continue;
		s.line = new THREE.Line3(s.a, s.tip);
		s.len = s.a.distanceTo(s.tip);
		s.dir = s.tip.clone().sub(s.a).normalize();
		s.verts = [];
		s.dist = [];
		segs.push(s);
	}
	const p = V(), c = V();
	const owner = new Int32Array(n);
	for (let i = 0; i < n; i++) {
		p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
		let best = -1, bd = Infinity;
		for (let k = 0; k < segs.length; k++) {
			segs[k].line.closestPointToPoint(p, true, c);
			const d = c.distanceToSquared(p);
			if (d < bd) { bd = d; best = k; }
		}
		owner[i] = best;
		segs[best].verts.push(i);
		segs[best].dist.push(Math.sqrt(bd));
	}
	const byBone = new Map(segs.map((s) => [s.bone, s]));
	ch._segments = { segs, byBone, owner, pos, n };
	return ch._segments;
}

const quant = (arr, q) => { if (!arr.length) return 0; const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
// Percentile after dropping outliers (ears, horns, a weapon fused into the hand): distances > 2x median.
const robust = (arr, q) => { const m = quant(arr, 0.5); return quant(arr.filter((d) => d < 2 * m), q); };

// Radius of the limb around a joint: vertices of the two adjacent segments within a band of the joint.
function jointRadius(S, joint, segsNear, band) {
	const d = [];
	const p = V();
	for (const s of segsNear) {
		if (!s) continue;
		for (const i of s.verts) {
			p.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
			if (p.distanceTo(joint) < band * 2.5 && Math.abs(p.clone().sub(joint).dot(s.dir)) < band) {
				const c = V();
				s.line.closestPointToPoint(p, true, c);
				d.push(c.distanceTo(p));
			}
		}
	}
	return robust(d, 0.6);
}

// ---------------------------------------------------------------------------------------------
// Hit regions: primitive volumes attached to bones (what the game would register as Rapier sensors),
// plus the mesh vertices inside each one for the overlay.
// ---------------------------------------------------------------------------------------------
export const HIT_REGIONS = ['head', 'throat', 'torso', 'elbow', 'forearm', 'wrist', 'knee'];
const PRIORITY = ['wrist', 'elbow', 'knee', 'throat', 'head', 'forearm', 'torso'];
const REGION_COLOR = { head: 0xff3b30, throat: 0xff9500, torso: 0x34c759, elbow: 0x5ac8fa, forearm: 0x007aff, wrist: 0xaf52de, knee: 0xffcc00 };

export function hitRegions(ch) {
	const S = segments(ch);
	const c = ch.bones.canon;
	const seg = (b) => (b ? S.byBone.get(b) : null);
	const vols = [];
	const capsule = (region, s, r, from = 0, to = 1) => {
		if (!s || !r) return;
		const a = s.a.clone().lerp(s.tip, from), b = s.a.clone().lerp(s.tip, to);
		vols.push({ region, type: 'capsule', bone: s.bone, a, b, r });
	};
	const sphere = (region, bone, center, r) => { if (bone && r) vols.push({ region, type: 'sphere', bone, center, r }); };
	// Head: capsule along head -> head top; throat: capsule along the neck.
	const hs = seg(c.head);
	if (hs && hs.verts.length) {
		// Sphere on the head's own vertices (ears and horns dropped as outliers), so a head bone that pokes
		// out of the mesh still yields a head-shaped volume; the rig check below reports the bone itself.
		const med = quant(hs.dist, 0.5);
		const keep = hs.verts.filter((_, k) => hs.dist[k] < 2 * med);
		const ctr = keep.reduce((acc, i) => acc.add(V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2])), V()).multiplyScalar(1 / keep.length);
		const d = keep.map((i) => ctr.distanceTo(V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2])));
		sphere('head', c.head, ctr, quant(d, 0.8));
	}
	const ns = seg(c.neck);
	if (ns) capsule('throat', ns, robust(ns.dist, 0.7), 0, 1);
	// Torso: one oriented box per spine-chain segment (pelvis, spine..., chest), from its own vertices.
	for (const s of S.segs.filter((s) => ['hips', 'spine'].includes(s.part) && s.verts.length > 20)) {
		const up = s.dir.clone();
		const right = new THREE.Vector3(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
		const fwd = up.clone().cross(right).normalize().negate();
		const xs = [], zs = [], ys = [];
		const p = V();
		for (const i of s.verts) {
			p.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]).sub(s.a);
			xs.push(p.dot(right)); ys.push(p.dot(up)); zs.push(p.dot(fwd));
		}
		const [x0, x1, z0, z1] = [quant(xs, 0.04), quant(xs, 0.96), quant(zs, 0.04), quant(zs, 0.96)];
		const y0 = Math.max(quant(ys, 0.02), -0.1 * s.len), y1 = Math.min(quant(ys, 0.98), 1.1 * s.len);
		const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
		const center = s.a.clone().add(right.clone().multiplyScalar((x0 + x1) / 2)).add(up.clone().multiplyScalar((y0 + y1) / 2)).add(fwd.clone().multiplyScalar((z0 + z1) / 2));
		vols.push({ region: 'torso', type: 'box', bone: s.bone, center, basis, half: new THREE.Vector3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2) });
	}
	for (const side of ['l', 'r']) {
		const ua = seg(c[`upperarm_${side}`]), fa = seg(c[`forearm_${side}`]), hd = seg(c[`hand_${side}`]);
		const th = seg(c[`thigh_${side}`]), sh = seg(c[`shin_${side}`]), ft = seg(c[`foot_${side}`]);
		if (fa) {
			capsule('forearm', fa, robust(fa.dist, 0.75), 0.15, 0.85);
			sphere('elbow', fa.bone, fa.a.clone(), 1.25 * jointRadius(S, fa.a, [ua, fa], 0.15 * fa.len));
			sphere('wrist', c[`hand_${side}`], fa.tip.clone(), 1.3 * jointRadius(S, fa.tip, [fa, hd], 0.12 * fa.len));
		}
		if (sh) sphere('knee', sh.bone, sh.a.clone(), 1.2 * jointRadius(S, sh.a, [th, sh], 0.12 * sh.len));
	}
	// Attach every volume to its bone (bind pose -> bone-local) so it follows animation.
	for (const v of vols) {
		const world = new THREE.Matrix4();
		if (v.type === 'sphere') world.makeTranslation(v.center.x, v.center.y, v.center.z);
		if (v.type === 'capsule') {
			const mid = v.a.clone().add(v.b).multiplyScalar(0.5);
			world.compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.b.clone().sub(v.a).normalize()), new THREE.Vector3(1, 1, 1));
		}
		if (v.type === 'box') world.copy(v.basis).setPosition(v.center);
		v.world = world;
		v.local = v.bone.matrixWorld.clone().invert().multiply(world);
	}
	// Vertex masks by priority (a wrist vertex is never also forearm).
	const inside = (v, p) => {
		if (v.type === 'sphere') return p.distanceTo(v.center) < v.r;
		if (v.type === 'capsule') { const c2 = V(); new THREE.Line3(v.a, v.b).closestPointToPoint(p, true, c2); return c2.distanceTo(p) < v.r; }
		const l = p.clone().applyMatrix4(v.world.clone().invert());
		return Math.abs(l.x) < v.half.x && Math.abs(l.y) < v.half.y && Math.abs(l.z) < v.half.z;
	};
	const masks = Object.fromEntries(HIT_REGIONS.map((r) => [r, new Uint8Array(S.n)]));
	const p = V();
	for (let i = 0; i < S.n; i++) {
		p.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
		for (const r of PRIORITY) if (vols.some((v) => v.region === r && inside(v, p))) { masks[r][i] = 1; break; }
	}
	// Purity: share of a region's vertices whose dominant skin weight is on the expected bones. Low purity
	// means the rig's weights disagree with where the bones are (a rig problem, not a hit-volume problem).
	const expect = {
		head: [c.head], throat: [c.neck, c.head], torso: [c.hips, ...(ch.bones.byKey.spine ?? []), c.clavicle_l, c.clavicle_r],
		elbow: [c.upperarm_l, c.forearm_l, c.upperarm_r, c.forearm_r], forearm: [c.forearm_l, c.forearm_r],
		wrist: [c.forearm_l, c.hand_l, c.forearm_r, c.hand_r], knee: [c.thigh_l, c.shin_l, c.thigh_r, c.shin_r]
	};
	const mesh = ch.skinned[0];
	const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
	const dominant = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); } return mesh.skeleton.bones[best]; };
	const summary = {};
	for (const r of HIT_REGIONS) {
		const ok = new Set(expect[r].filter(Boolean));
		let count = 0, pure = 0;
		for (let i = 0; i < S.n; i++) if (masks[r][i]) { count++; if (ok.has(dominant(i))) pure++; }
		const rv = vols.filter((v) => v.region === r);
		summary[r] = { vertices: count, purity: count ? +(pure / count).toFixed(2) : null, volumes: rv.length,
			sizeOfHeight: rv.map((v) => +((v.type === 'box' ? 2 * Math.max(v.half.x, v.half.z) : 2 * v.r) / ch.height).toFixed(3)),
			bones: [...new Set(rv.map((v) => v.bone.name))] };
	}
	return { masks, summary, volumes: vols, rig: rigCheck(ch, S) };
}

// Rig sanity: share of each major bone's length that lies outside the mesh (approximate inside test with
// the nearest vertex's normal). A head bone poking out of the skull, or an arm bone outside the arm,
// shows up here even when skin weights look consistent.
function rigCheck(ch, S) {
	const mesh = ch.skinned[0];
	const nrm = mesh.geometry.attributes.normal;
	const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
	const out = {};
	const p = V(), q = V(), nv = V();
	for (const s of S.segs) {
		if (['toe', 'end'].includes(s.part)) continue;
		let outside = 0, total = 0;
		for (let t = 0.1; t <= 0.91; t += 0.2) {
			s.line.at(t, p);
			let best = -1, bd = Infinity;
			for (let i = 0; i < S.n; i += 2) {
				q.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
				const d = q.distanceToSquared(p);
				if (d < bd) { bd = d; best = i; }
			}
			q.set(S.pos[best * 3], S.pos[best * 3 + 1], S.pos[best * 3 + 2]);
			nv.fromBufferAttribute(nrm, best).applyMatrix3(nm).normalize();
			total++;
			if (nv.dot(p.clone().sub(q)) > 0) outside++;
		}
		out[s.bone.name] = +(outside / total).toFixed(2);
	}
	const bad = Object.entries(out).filter(([, v]) => v >= 0.4).map(([k]) => k);
	return { outsideFraction: out, bonesOutsideMesh: bad };
}

export function showRegion(ch, masks, region, volumes = ch.hitVolumes) {
	ch.overlay?.removeFromParent();
	ch.overlay = null;
	for (const m of ch.volumeMeshes ?? []) m.removeFromParent();
	ch.volumeMeshes = [];
	if (!region) return;
	const mesh = ch.skinned[0];
	const geo = mesh.geometry.clone();
	const n = geo.attributes.position.count;
	const col = new Float32Array(n * 4);
	const m = masks[region];
	const rgb = new THREE.Color(REGION_COLOR[region] ?? 0xff2010);
	for (let i = 0; i < n; i++) { col[i * 4] = rgb.r; col[i * 4 + 1] = rgb.g; col[i * 4 + 2] = rgb.b; col[i * 4 + 3] = m[i] ? 0.8 : 0; }
	geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
	const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
	const overlay = new THREE.SkinnedMesh(geo, mat);
	overlay.bind(mesh.skeleton, mesh.bindMatrix);
	mesh.parent.add(overlay);
	overlay.position.copy(mesh.position); overlay.quaternion.copy(mesh.quaternion); overlay.scale.copy(mesh.scale);
	overlay.frustumCulled = false;
	ch.overlay = overlay;
	// The volumes themselves, as wireframes riding on their bones.
	const wire = new THREE.MeshBasicMaterial({ color: REGION_COLOR[region] ?? 0xffffff, wireframe: true, transparent: true, opacity: 0.55, depthTest: false });
	for (const v of (volumes ?? []).filter((x) => x.region === region)) {
		const g = v.type === 'sphere' ? new THREE.SphereGeometry(v.r, 12, 8)
			: v.type === 'capsule' ? new THREE.CapsuleGeometry(v.r, v.a.distanceTo(v.b), 4, 10)
			: new THREE.BoxGeometry(2 * v.half.x, 2 * v.half.y, 2 * v.half.z);
		const w = new THREE.Mesh(g, wire);
		w.renderOrder = 10;
		v.local.decompose(w.position, w.quaternion, w.scale);
		v.bone.add(w);
		ch.volumeMeshes.push(w);
	}
}

// ---------------------------------------------------------------------------------------------
// Prop mounts: "grip" (weapon through the palm), "forearm" (strapped shield), "head" (helmet)
// ---------------------------------------------------------------------------------------------
export async function loadProp(file, base = '') {
	const g = await loader.loadAsync(base + file);
	const prop = g.scene;
	prop.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
	return prop;
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

// Wrap a prop so its local frame is centered on its bounding box; returns sizes per axis.
function centered(prop) {
	const box = new THREE.Box3().setFromObject(prop);
	const size = box.getSize(V());
	const g = new THREE.Group();
	g.add(prop);
	prop.position.sub(box.getCenter(V()));
	return { group: g, size };
}

function mountAt(ch, bone, group, world) {
	const holder = new THREE.Group();
	holder.add(group);
	bone.matrixWorld.clone().invert().multiply(world).decompose(holder.position, holder.quaternion, holder.scale);
	bone.add(holder);
	return holder;
}

// hold: where the hand grips, as a fraction of length from the butt end. tip: which local end of the
// prop's long axis points away from the hand ('+y' or '-y' after the long axis is mapped to Y).
export function attachProp(ch, prop, { side = 'r', mode = 'grip', length = 0.85, hold = 0.33, tip = '+y', inplaceRoot = null } = {}) {
	ch.mixer.stopAllAction();
	ch.skeleton.pose();
	ch.root.updateMatrixWorld(true);
	const S = segments(ch);
	const H = ch.height;
	if (mode === 'inplace') {
		const hand = ch.bones.canon[`hand_${side}`];
		const holder = new THREE.Group();
		holder.add(prop);
		hand.matrixWorld.clone().invert().multiply((inplaceRoot ?? ch.inner).matrixWorld).decompose(holder.position, holder.quaternion, holder.scale);
		hand.add(holder);
		return holder;
	}
	const { group, size } = centered(prop);
	if (mode === 'head') {
		const head = ch.bones.canon.head;
		const hs = S.byBone.get(head);
		if (!hs) throw new Error('no head segment');
		const box = new THREE.Box3();
		for (const i of hs.verts) box.expandByPoint(V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]));
		const hsz = box.getSize(V()), hc = box.getCenter(V());
		const s = (1.15 * Math.max(hsz.x, hsz.z)) / Math.max(size.x, size.z);
		// Sit the helmet so its top clears the head top slightly.
		const center = new THREE.Vector3(hc.x, box.max.y + 0.04 * hsz.y - (size.y * s) / 2, hc.z);
		return mountAt(ch, head, group, new THREE.Matrix4().compose(center, new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
	}
	if (mode === 'forearm') {
		const fb = ch.bones.canon[`forearm_${side}`];
		const fs = S.byBone.get(fb);
		if (!fs) throw new Error(`no forearm_${side} segment`);
		// Shield face: the back-of-forearm side (outward + up, perpendicular to the forearm).
		const lateral = new THREE.Vector3(side === 'l' ? 1 : -1, 0, 0);
		const dorsal = lateral.clone().add(AXES.y).sub(fs.dir.clone().multiplyScalar(lateral.clone().add(AXES.y).dot(fs.dir))).normalize();
		const upPrj = fs.dir.clone().negate().add(AXES.y);
		const up = upPrj.sub(dorsal.clone().multiplyScalar(upPrj.dot(dorsal))).normalize();
		// Prop frame: thinnest axis is the face normal (front = +Z when it is Z, as generated facing the camera).
		const order = ['x', 'y', 'z'].sort((a, b) => size[a] - size[b]);
		const nAx = AXES[order[0]].clone(), uAx = AXES[order[0] === 'y' ? order[2] : 'y'].clone();
		const src = new THREE.Matrix4().makeBasis(uAx.clone().cross(nAx), uAx, nAx);
		const dst = new THREE.Matrix4().makeBasis(up.clone().cross(dorsal), up, dorsal);
		const q = new THREE.Quaternion().setFromRotationMatrix(dst.multiply(src.transpose()));
		const s = (length * H) / Math.max(size.x, size.y, size.z);
		const radius = robust(fs.dist, 0.6);
		const center = fs.a.clone().lerp(fs.tip, 0.55).add(dorsal.clone().multiplyScalar(radius + 0.5 * size[order[0]] * s));
		return mountAt(ch, fb, group, new THREE.Matrix4().compose(center, q, new THREE.Vector3(s, s, s)));
	}
	// grip
	const hand = ch.bones.canon[`hand_${side}`];
	if (!hand) throw new Error(`no hand_${side} bone`);
	const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
	const fit = new THREE.Group();
	fit.add(group);
	if (axis === 'x') fit.rotation.z = Math.PI / 2;
	if (axis === 'z') fit.rotation.x = Math.PI / 2;
	const flip = new THREE.Group();
	flip.add(fit);
	if (tip === '-y') flip.rotation.z = Math.PI;
	const L = length * H;
	flip.scale.setScalar(L / Math.max(size.x, size.y, size.z));
	const hs = S.byBone.get(hand);
	const handPos = hand.getWorldPosition(V());
	const dir = hs ? hs.dir.clone() : new THREE.Vector3(0, -1, 0);
	const handLen = hs ? hs.len : 0.04 * H;
	const forward = new THREE.Vector3(0, 0, 1);
	const along = forward.clone().sub(dir.clone().multiplyScalar(forward.dot(dir))).normalize();
	const grip = handPos.clone().add(dir.clone().multiplyScalar(Math.max(handLen * 0.5, 0.025 * H)));
	const q = new THREE.Quaternion().setFromUnitVectors(AXES.y, along);
	const world = new THREE.Matrix4().compose(grip, q, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, (0.5 - hold) * L, 0));
	return mountAt(ch, hand, flip, world);
}

// ---------------------------------------------------------------------------------------------
// Ragdoll: capsule per major bone. Elbows and knees are limited hinges; every other joint is a chain of
// three limited hinges (flex, side, twist) through two massless-ish gimbal bodies, so nothing can fold
// past an anatomical range. Non-neighboring parts collide with each other.
// ---------------------------------------------------------------------------------------------
let rapierReady = null;
export const initPhysics = () => (rapierReady ??= RAPIER.init());

const HINGE_PARTS = new Set(['forearm', 'shin']);
// Swing cone (half-angle) and twist limits in radians, relative to the pose at death. Rapier's JS API has
// no limits on spherical joints, and chaining limited hinges through gimbal bodies gained energy, so the
// limits are soft: a damped torque pushes back only once a joint is past its range.
const CONE = {
	hips: [0.3, 0.3], spine: [0.45, 0.35], neck: [0.6, 0.5], head: [0.5, 0.5], clavicle: [0.3, 0.2],
	upperarm: [1.6, 0.7], thigh: [1.3, 0.4], hand: [0.9, 0.5], foot: [0.6, 0.3], toe: [0.5, 0.2], default: [0.6, 0.4]
};

export async function buildRagdoll(ch, { gravityScale = 3, minLengthFrac = 0.045, limits = true, selfCollision = true } = {}) {
	await initPhysics();
	const world = new RAPIER.World({ x: 0, y: -9.81 * gravityScale, z: 0 });
	world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0).setFriction(0.9));
	ch.root.updateMatrixWorld(true);
	const mesh = ch.skinned[0];
	const n = mesh.geometry.attributes.position.count;
	const pos = skinnedPositions(mesh, new Float32Array(n * 3));
	// Current (death-pose) segments; radii come from the bind-pose vertex assignment.
	const S = segments(ch);
	ch.root.updateMatrixWorld(true);
	const major = [];
	for (const s0 of S.segs) {
		if (['toe'].includes(s0.part)) continue;
		const cur = boneSegment(s0.bone, ch.bones.info, ch.height);
		if (!cur) continue;
		const len = cur.a.distanceTo(cur.tip);
		// The root (hips) always gets a body, or thighs and spine would be disconnected roots.
		if (len < minLengthFrac * ch.height && !['head', 'hips'].includes(s0.part)) continue;
		major.push({ bone: s0.bone, a: cur.a, tip: cur.tip, len, part: s0.part, r0: robust(s0.dist, 0.5) });
	}
	const bodies = new Map();
	const velocities = ch.lastVelocities ?? new Map();
	for (const m of major) {
		const radius = THREE.MathUtils.clamp(m.r0 || 0.03 * ch.height, 0.02 * ch.height, 0.16 * ch.height);
		const mid = m.a.clone().add(m.tip).multiplyScalar(0.5);
		const dir = m.tip.clone().sub(m.a).normalize();
		const q = new THREE.Quaternion().setFromUnitVectors(AXES.y, dir);
		const v = velocities.get(m.bone) ?? V();
		// Bodies start world-aligned: every joint's relative rotation is zero at death, so limits are
		// measured from the current pose and nothing snaps at t = 0.
		const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z)
			.setLinearDamping(0.1).setAngularDamping(1.5).setLinvel(v.x, v.y, v.z).setCcdEnabled(true));
		const half = Math.max(0.001, m.len / 2 - radius * 0.5);
		world.createCollider(RAPIER.ColliderDesc.capsule(half, radius).setRotation(q).setDensity(1000).setFriction(0.8)
			.setCollisionGroups(0x00020003).setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS), body);
		const offset = new THREE.Matrix4().makeTranslation(mid.x, mid.y, mid.z).invert().multiply(m.bone.matrixWorld);
		bodies.set(m.bone, { body, offset, radius, len: m.len, part: m.part, dir, a: m.a, tip: m.tip, parent: null });
	}
	// Joints to the nearest ancestor that has a body.
	const joints = [];
	const soft = [];
	const hinge = (b1, b2, a1, a2, axis, lim) => {
		const d = RAPIER.JointData.revolute(a1, a2, { x: axis.x, y: axis.y, z: axis.z });
		d.limitsEnabled = true;
		d.limits = lim;
		const j = world.createMultibodyJoint(d, b1, b2, true);
		j.setContactsEnabled?.(false);
		return j;
	};
	for (const [bone, rec] of bodies) {
		let p = bone.parent;
		while (p && !bodies.has(p)) p = p.parent;
		if (!p) continue;
		const parent = bodies.get(p);
		rec.parent = p;
		const anchorWorld = bone.getWorldPosition(V());
		const a1 = worldToBody(parent.body, anchorWorld), a2 = worldToBody(rec.body, anchorWorld);
		let flex = rec.dir.clone().cross(new THREE.Vector3(0, 0, 1));
		if (flex.length() < 0.3) flex = rec.dir.clone().cross(AXES.y); // bones pointing forward (quadruped spines)
		flex.normalize();
		if (HINGE_PARTS.has(rec.part)) {
			hinge(parent.body, rec.body, a1, a2, flex, rec.part === 'shin' ? [-2.0, 0.15] : [-0.15, 2.0]);
		} else {
			const j = world.createMultibodyJoint(RAPIER.JointData.spherical(a1, a2), parent.body, rec.body, true);
			j.setContactsEnabled?.(false);
			if (limits) {
				const [cone, twist] = CONE[rec.part] ?? CONE.default;
				// Both bodies receive the torque, so size it on the lighter one.
				const I = (r) => r.body.mass() * Math.max(r.len, r.radius) ** 2 / 3;
				soft.push({ p: parent.body, c: rec.body, d0: rec.dir.clone(), cone, twist, inertia: Math.min(I(rec), I(parent)) });
			}
		}
		joints.push({ b1: parent.body, b2: rec.body, a1, a2 });
	}
	// Self-collision: skip parent/child, grandparent and sibling pairs, and pairs already touching at death.
	const excluded = new Set();
	const key = (x, y) => (x < y ? `${x}:${y}` : `${y}:${x}`);
	const recs = [...bodies.entries()];
	const segDist = (r1, r2) => {
		let best = Infinity;
		const l1 = new THREE.Line3(r1.a, r1.tip), l2 = new THREE.Line3(r2.a, r2.tip), p = V(), c = V();
		for (let i = 0; i <= 8; i++) { l1.at(i / 8, p); l2.closestPointToPoint(p, true, c); best = Math.min(best, p.distanceTo(c)); }
		for (let i = 0; i <= 8; i++) { l2.at(i / 8, p); l1.closestPointToPoint(p, true, c); best = Math.min(best, p.distanceTo(c)); }
		return best;
	};
	for (const [b1, r1] of recs) for (const [b2, r2] of recs) {
		if (b1 === b2) continue;
		const gp1 = r1.parent && bodies.get(r1.parent)?.parent;
		const related = r1.parent === b2 || r2.parent === b1 || gp1 === b2 || (r2.parent && bodies.get(r2.parent)?.parent === b1)
			|| (r1.parent && r1.parent === r2.parent);
		if (related || segDist(r1, r2) < (r1.radius + r2.radius) * 1.05) excluded.add(key(r1.body.handle, r2.body.handle));
	}
	const bodyHandles = new Set(recs.map(([, r]) => r.body.handle));
	const hooks = {
		filterContactPair: (c1, c2, h1, h2) => (excluded.has(key(h1, h2)) || (!selfCollision && bodyHandles.has(h1) && bodyHandles.has(h2)) ? null : RAPIER.SolverFlags.COMPUTE_IMPULSE),
		filterIntersectionPair: () => true
	};
	const order = ch.skeleton.bones.filter((b) => bodies.has(b));
	return { world, bodies, joints, soft, order, hooks, excludedPairs: excluded.size, steps: 0 };
}

function rotOf(body) { const r = body.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
function worldToBody(body, p) {
	const t = body.translation();
	const local = p.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(rotOf(body).invert());
	return { x: local.x, y: local.y, z: local.z };
}

const _m = new THREE.Matrix4(), _pw = new THREE.Matrix4();
// Damped torque beyond the swing cone / twist range (stiffness ~ (2*pi*6 Hz)^2 * inertia, critically damped).
function softLimits(rag, h) {
	const wn = 2 * Math.PI * 6;
	for (const { body } of rag.bodies.values()) body.resetTorques(false);
	for (const L of rag.soft) {
		const qp = rotOf(L.p), qc = rotOf(L.c);
		const rel = qp.clone().invert().multiply(qc);
		const d = L.d0.clone().applyQuaternion(rel);
		const swing = Math.acos(THREE.MathUtils.clamp(d.dot(L.d0), -1, 1));
		const wp = L.p.angvel(), wc = L.c.angvel();
		const wRel = new THREE.Vector3(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z);
		const push = (axisWorld, excess) => {
			rag.limitHits = (rag.limitHits ?? 0) + 1;
			rag.maxExcess = Math.max(rag.maxExcess ?? 0, excess);
			const v = wRel.dot(axisWorld);
			// Multibody links take forces, not impulses: Rapier rebuilds link velocities from the joint
			// coordinates every step, so torque impulses would be discarded.
			const tq = -L.inertia * (wn * wn * Math.min(excess, 0.5) + (v > 0 ? 2 * wn * Math.min(v, 20) : 0));
			const t = axisWorld.clone().multiplyScalar(tq);
			L.c.addTorque({ x: t.x, y: t.y, z: t.z }, true);
			L.p.addTorque({ x: -t.x, y: -t.y, z: -t.z }, true);
		};
		if (swing > L.cone) {
			const ax = L.d0.clone().cross(d);
			if (ax.lengthSq() > 1e-10) push(ax.normalize().applyQuaternion(qp), swing - L.cone);
		}
		// Twist about the bone: the part of rel left after removing the swing.
		const swingQ = new THREE.Quaternion().setFromUnitVectors(L.d0, d);
		const tw = swingQ.clone().invert().multiply(rel);
		let ang = 2 * Math.atan2(new THREE.Vector3(tw.x, tw.y, tw.z).dot(L.d0), tw.w);
		if (ang > Math.PI) ang -= 2 * Math.PI;
		if (ang < -Math.PI) ang += 2 * Math.PI;
		if (Math.abs(ang) > L.twist) push(d.clone().applyQuaternion(qp).multiplyScalar(Math.sign(ang)), Math.abs(ang) - L.twist);
	}
}
export function stepRagdoll(ch, rag, dt = 1 / 60, substeps = 4) {
	rag.world.timestep = dt / substeps;
	for (let i = 0; i < substeps; i++) {
		softLimits(rag, dt / substeps);
		rag.world.step(undefined, rag.hooks);
	}
	rag.steps++;
	for (const bone of rag.order) {
		const { body, offset } = rag.bodies.get(bone);
		const t = body.translation();
		_m.compose(new THREE.Vector3(t.x, t.y, t.z), rotOf(body), new THREE.Vector3(1, 1, 1)).multiply(offset);
		_pw.copy(bone.parent.matrixWorld).invert().multiply(_m);
		_pw.decompose(bone.position, bone.quaternion, bone.scale);
		bone.updateMatrixWorld(true);
	}
}

// Velocities of each bone at time t of a clip, by finite difference, plus forward walking speed.
export function sampleVelocities(ch, clipName, t, walkSpeed = 1.2) {
	const clip = ch.clips[clipName];
	const action = ch.mixer.clipAction(clip);
	action.reset().play();
	const dt = 1 / 60;
	const before = new Map();
	ch.mixer.setTime(t);
	ch.root.updateMatrixWorld(true);
	for (const b of ch.skeleton.bones) before.set(b, b.getWorldPosition(V()));
	ch.mixer.setTime(t + dt);
	ch.root.updateMatrixWorld(true);
	const forward = new THREE.Vector3(0, 0, 1).multiplyScalar(walkSpeed * ch.height);
	const vel = new Map();
	for (const b of ch.skeleton.bones) vel.set(b, b.getWorldPosition(V()).sub(before.get(b)).divideScalar(dt).add(forward));
	ch.mixer.setTime(t);
	ch.root.updateMatrixWorld(true);
	return vel;
}

export function ragdollStats(rag, ch) {
	let maxV = 0, minY = Infinity, sep = 0;
	for (const { body } of rag.bodies.values()) {
		const v = body.linvel();
		maxV = Math.max(maxV, Math.hypot(v.x, v.y, v.z));
		minY = Math.min(minY, body.translation().y);
	}
	for (const { b1: a, b2: b, a1, a2 } of rag.joints) {
		const pa = V().copy(a1).applyQuaternion(rotOf(a)).add(V().copy(a.translation()));
		const pb = V().copy(a2).applyQuaternion(rotOf(b)).add(V().copy(b.translation()));
		sep = Math.max(sep, pa.distanceTo(pb));
	}
	return { bodies: rag.bodies.size, joints: rag.joints.length, excludedPairs: rag.excludedPairs, limitHits: rag.limitHits ?? 0, maxLimitExcess: +(rag.maxExcess ?? 0).toFixed(2), maxSpeed: +maxV.toFixed(2), lowestBodyY: +minY.toFixed(3),
		maxJointSeparation: +(sep / ch.height).toFixed(4), steps: rag.steps };
}
