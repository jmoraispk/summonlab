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
	const borrowed = [];
	for (const file of entry.clipFiles ?? []) {
		const g = await loader.loadAsync(base + file);
		// Clips made on another character (same bone names, different proportions): Tripo keys a position for
		// every bone, which would impose the source's bone lengths. Keep rotations only, and scale the root's
		// motion by the ratio of root heights.
		const srcRoot = g.scene.getObjectByName(skeleton.bones[0].name);
		const tgtRest = nodeRest.get(skeleton.bones[0]);
		const foreign = srcRoot && tgtRest && srcRoot.position.distanceTo(tgtRest) > 0.01 * Math.max(1e-6, tgtRest.length());
		for (const a of g.animations) {
			const c = a.clone();
			c.name = clipName(a.name);
			if (foreign) {
				const k = tgtRest.length() / Math.max(1e-6, srcRoot.position.length());
				c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === `${skeleton.bones[0].name}.position`);
				for (const t of c.tracks) if (t.name.endsWith('.position')) for (let i = 0; i < t.values.length; i += 3) {
					t.values[i] = tgtRest.x + (t.values[i] - srcRoot.position.x) * k;
					t.values[i + 1] = tgtRest.y + (t.values[i + 1] - srcRoot.position.y) * k;
					t.values[i + 2] = tgtRest.z + (t.values[i + 2] - srcRoot.position.z) * k;
				}
				borrowed.push(c.name);
			}
			clips[c.name] = c;
		}
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
	return { entry, root, inner, skinned, skeleton, clips, mixer, bones, height: entry.height ?? 1.1, scale: s, autoYaw, restMismatch, borrowed };
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
		if (p.part === 'end') continue;
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
			// Axial band only: a distance cap here dropped every vertex of thick limbs (golem, wide trousers).
			if (Math.abs(p.clone().sub(joint).dot(s.dir)) < band) {
				const c = V();
				s.line.closestPointToPoint(p, true, c);
				d.push(c.distanceTo(p));
			}
		}
	}
	return robust(d, 0.6);
}

// ---------------------------------------------------------------------------------------------
// Skin cleanup at import (run once per asset; the game would bake the result into the GLB):
//  - floating islands: small mesh pieces with a gap to the body are reported, and removed only for assets
//    reviewed as broken (entry.removeIslands; Asha's braid tip);
//  - skirt weights (off by default): smoothing cloth weights, blending them toward the hips, or moving
//    shin weight to the thigh all made Asha's robe stretch worse (Experiment 2b), so robes need cloth
//    bones or simulation instead; the code stays for the record and for re-tests.
// ---------------------------------------------------------------------------------------------
export function skinCleanup(ch, { islands = 'report', skirt = false, skirtIterations = 40, hipsBlend = 0.35, shinToThigh = false, smooth = true } = {}) {
	const mesh = ch.skinned[0];
	const geo = mesh.geometry;
	const S = segments(ch);
	const n = S.n, pos = S.pos;
	// Welded vertex ids (UV seams duplicate vertices) and adjacency.
	const keyOf = new Map(), canon = new Int32Array(n);
	const q = 1e4 / ch.height;
	for (let i = 0; i < n; i++) {
		const k = `${Math.round(pos[i * 3] * q)},${Math.round(pos[i * 3 + 1] * q)},${Math.round(pos[i * 3 + 2] * q)}`;
		if (!keyOf.has(k)) keyOf.set(k, i);
		canon[i] = keyOf.get(k);
	}
	const index = geo.index;
	const tri = (t) => [canon[index.getX(t)], canon[index.getX(t + 1)], canon[index.getX(t + 2)]];
	const nbr = new Map();
	const link = (a, b) => { if (a === b) return; (nbr.get(a) ?? nbr.set(a, new Set()).get(a)).add(b); };
	for (let t = 0; t < index.count; t += 3) { const [a, b, c] = tri(t); link(a, b); link(b, a); link(b, c); link(c, b); link(a, c); link(c, a); }
	const report = { floatingIslands: [], keptIslands: 0, skirtVertices: 0 };
	if (islands) {
		const par = new Int32Array(n).map((_, i) => i);
		const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
		for (let t = 0; t < index.count; t += 3) { const [a, b, c] = tri(t); par[find(a)] = find(b); par[find(c)] = find(b); }
		const members = new Map();
		for (let i = 0; i < n; i++) if (canon[i] === i) { const r = find(i); (members.get(r) ?? members.set(r, []).get(r)).push(i); }
		const comps = [...members.values()].sort((a, b) => b.length - a.length);
		const main = comps[0];
		const mainSample = main.filter((_, k) => k % 3 === 0);
		const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
		const drop = new Set();
		for (const comp of comps.slice(1)) {
			if (comp.length > 0.05 * main.length) { report.keptIslands++; continue; }
			let gap = Infinity;
			for (const i of comp.filter((_, k) => k % 2 === 0)) { const p = P(i); for (const j of mainSample) gap = Math.min(gap, p.distanceTo(P(j))); }
			const gapFrac = gap / ch.height;
			// Size and gap cannot tell a broken braid tip (Asha: 249 verts, 4.3%) from a dangling ornament (the
			// Studio goblin has 47 at 1.6-7.3%), so islands are only removed for assets reviewed as broken.
			if (gapFrac > 0.015) {
				if (islands === 'remove') comp.forEach((i) => drop.add(i));
				const ctr = comp.reduce((acc, i) => acc.add(P(i)), V()).multiplyScalar(1 / comp.length);
				report.floatingIslands.push({ vertices: comp.length, gapOfHeight: +gapFrac.toFixed(3), centerOfHeight: ctr.toArray().map((x) => +(x / ch.height).toFixed(2)), removed: islands === 'remove' });
			}
			else report.keptIslands++;
		}
		if (drop.size) {
			const arr = index.array;
			for (let t = 0; t < index.count; t += 3) if (drop.has(canon[arr[t]])) { arr[t + 1] = arr[t]; arr[t + 2] = arr[t]; }
			index.needsUpdate = true;
		}
	}
	if (skirt) {
		const c = ch.bones.canon;
		const legSegs = ['thigh_l', 'thigh_r', 'shin_l', 'shin_r'].map((k) => S.byBone.get(c[k])).filter(Boolean);
		const hips = c.hips;
		if (legSegs.length === 4 && hips) {
			const legR = new Map(legSegs.map((s) => [s, robust(s.dist, 0.35)]));
			const hipsY = hips.getWorldPosition(V()).y;
			const ankleY = Math.max(...['foot_l', 'foot_r'].map((k) => (c[k] ? c[k].getWorldPosition(V()).y : 0)));
			const p = V(), cp = V();
			const legParts = new Set(['thigh', 'shin', 'hips']);
			const cloth = new Set();
			for (let i = 0; i < n; i++) {
				if (canon[i] !== i) continue;
				const own = S.segs[S.owner[i]];
				if (!own || !legParts.has(own.part)) continue;
				p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
				if (p.y > hipsY || p.y < ankleY) continue;
				let inLeg = false;
				for (const s of legSegs) { s.line.closestPointToPoint(p, true, cp); if (cp.distanceTo(p) < 1.6 * legR.get(s)) { inLeg = true; break; } }
				if (!inLeg) cloth.add(i);
			}
			report.skirtVertices = cloth.size;
			if (cloth.size) {
				const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
				const hipsIdx = mesh.skeleton.bones.indexOf(hips);
				const W = new Map();
				const read = (i) => { const m = new Map(); for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0) m.set(si.getComponent(i, k), (m.get(si.getComponent(i, k)) ?? 0) + w); } return m; };
				for (const i of cloth) W.set(i, read(i));
				// Cloth does not bend at the knee: shin weight moves to the thigh on the same side.
				if (shinToThigh) {
					const bi = (k) => mesh.skeleton.bones.indexOf(c[k]);
					const pairs = [[bi('shin_l'), bi('thigh_l')], [bi('shin_r'), bi('thigh_r')], [bi('foot_l'), bi('thigh_l')], [bi('foot_r'), bi('thigh_r')]];
					for (const m of W.values()) for (const [from, to] of pairs) if (m.has(from)) { m.set(to, (m.get(to) ?? 0) + m.get(from)); m.delete(from); }
				}
				const fixed = new Map();
				const weightsOf = (j) => W.get(j) ?? fixed.get(j) ?? fixed.set(j, read(j)).get(j);
				for (let it = 0; it < (smooth ? skirtIterations : 0); it++) {
					const next = new Map();
					for (const i of cloth) {
						const acc = new Map();
						const ns = [...(nbr.get(i) ?? [])];
						for (const j of ns) for (const [b, w] of weightsOf(j)) acc.set(b, (acc.get(b) ?? 0) + w / ns.length);
						const own = W.get(i);
						const m = new Map();
						for (const b of new Set([...own.keys(), ...acc.keys()])) m.set(b, 0.5 * (own.get(b) ?? 0) + 0.5 * (acc.get(b) ?? 0));
						next.set(i, m);
					}
					for (const [i, m] of next) W.set(i, m);
				}
				// Blend toward the hips, most at the waist, fading to none at the ankles.
				for (const i of cloth) {
					const t = THREE.MathUtils.clamp((pos[i * 3 + 1] - ankleY) / Math.max(1e-6, hipsY - ankleY), 0, 1);
					const a = hipsBlend * (0.4 + 0.6 * t);
					const m = W.get(i);
					for (const [b, w] of m) m.set(b, w * (1 - a));
					m.set(hipsIdx, (m.get(hipsIdx) ?? 0) + a);
				}
				// Top four influences, renormalized, written to every duplicate of the welded vertex.
				const top = new Map();
				for (const [i, m] of W) {
					const best = [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
					const sum = best.reduce((s, [, w]) => s + w, 0) || 1;
					while (best.length < 4) best.push([0, 0]);
					top.set(i, best.map(([b, w]) => [b, w / sum]));
				}
				for (let i = 0; i < n; i++) {
					const t = top.get(canon[i]);
					if (!t) continue;
					si.setXYZW(i, t[0][0], t[1][0], t[2][0], t[3][0]);
					sw.setXYZW(i, t[0][1], t[1][1], t[2][1], t[3][1]);
				}
				si.needsUpdate = true; sw.needsUpdate = true;
			}
		}
	}
	return report;
}

// ---------------------------------------------------------------------------------------------
// Hit regions: primitive volumes attached to bones (what the game would register as Rapier sensors),
// plus the mesh vertices inside each one for the overlay. Injury-grade: every finger phalanx, the palm,
// each long-bone shaft and each joint get their own volume; the side comes from the bone.
// ---------------------------------------------------------------------------------------------
export const HIT_REGIONS = ['head', 'throat', 'chest', 'abdomen', 'pelvis', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist',
	'hand', 'thumb', 'fingers', 'hip', 'thigh', 'knee', 'shin', 'ankle', 'foot'];
// Small joints win overlaps so a wrist hit is never reported as a forearm hit.
const PRIORITY = ['wrist', 'elbow', 'knee', 'ankle', 'thumb', 'fingers', 'hand', 'shoulder', 'hip', 'throat', 'head', 'forearm',
	'upper_arm', 'shin', 'thigh', 'foot', 'chest', 'abdomen', 'pelvis'];
export const REGION_COLOR = Object.fromEntries([...HIT_REGIONS, 'neck', 'torso', 'foreleg', 'hindleg', 'paw', 'tail'].map((r, i) => [r, new THREE.Color().setHSL((i * 0.618034) % 1, 0.8, 0.55).getHex()]));

export const QUAD_REGIONS = ['head', 'neck', 'torso', 'foreleg', 'hindleg', 'paw', 'tail'];

// Tripo's non-biped rigs name bones Head_*, Spine_*, <0|1>_<Left|Right>_Limb_<k> (0 = front, 1 = hind) and
// Tail_*; map those chains to quadruped regions.
function quadHitRegions(ch, S) {
	const named = (re) => ch.skeleton.bones.filter((b) => re.test(b.name)).sort((a, b) => depthOf(a) - depthOf(b));
	const vols = [];
	const robustCap = (s, q) => Math.max(robust(s.dist, q), 0.15 * s.len);
	const cap = (region, b, q = 0.75) => { const s = S.byBone.get(b); if (s && s.verts.length) vols.push({ region, type: 'capsule', bone: b, a: s.a.clone(), b: s.tip.clone(), r: robustCap(s, q) }); };
	const heads = named(/Head_\d+$/);
	if (heads.length > 1) cap('neck', heads[0], 0.7);
	// The skull includes every bone under the head chain (jaw and ears come back as generic bone_N names).
	const under = (b) => [b, ...b.children.filter((k) => k.isBone).flatMap(under)];
	const skullBones = [...new Set(heads.slice(heads.length > 1 ? 1 : 0).flatMap(under))];
	const skull = skullBones.flatMap((b) => { const s = S.byBone.get(b); return s ? s.verts : []; });
	if (skull.length) {
		const P = (i) => V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
		const ctr = skull.reduce((acc, i) => acc.add(P(i)), V()).multiplyScalar(1 / skull.length);
		const d = skull.map((i) => ctr.distanceTo(P(i)));
		vols.push({ region: 'head', type: 'sphere', bone: heads.at(-1), center: ctr, r: quant(d, 0.8), expect: [...heads, ...skullBones] });
	}
	for (const b of [...named(/Root$/), ...named(/Spine_\d+$/)]) cap('torso', b, 0.8);
	for (const [front, region] of [['0', 'foreleg'], ['1', 'hindleg']]) for (const side of ['Left', 'Right']) {
		const chain = named(new RegExp(`${front}_${side}_Limb_\\d+$`)).filter((b) => S.byBone.get(b));
		chain.forEach((b, i) => cap(i === chain.length - 1 ? 'paw' : region, b));
	}
	for (const b of named(/Tail_\d+$/)) cap('tail', b, 0.8);
	return vols;
}
const depthOf = (b) => { let d = 0; for (let x = b; x.parent; x = x.parent) d++; return d; };

export function hitRegions(ch) {
	const S = segments(ch);
	if (ch.skeleton.bones.some((b) => /_Limb_\d+$/.test(b.name))) return finishRegions(ch, S, quadHitRegions(ch, S), QUAD_REGIONS, QUAD_REGIONS, null);
	const c = ch.bones.canon;
	const info = ch.bones.info;
	const seg = (b) => (b ? S.byBone.get(b) : null);
	const vols = [];
	const capsule = (region, s, r, from = 0, to = 1) => {
		if (!s || !(r > 0)) return;
		vols.push({ region, type: 'capsule', bone: s.bone, a: s.a.clone().lerp(s.tip, from), b: s.a.clone().lerp(s.tip, to), r });
	};
	const sphere = (region, bone, center, r) => { if (bone && r > 0) vols.push({ region, type: 'sphere', bone, center, r }); };
	// Joints are short slices of the limb: as thick as the limb there, a band along the bone axis, so they
	// reach the skin on thick limbs without swallowing the neighboring shaft or palm.
	const slice = (region, bone, center, axis, r, halfH) => {
		if (!bone || !(r > 0) || !(halfH > 0)) return;
		const ax = axis.clone().normalize();
		vols.push({ region, type: 'cylinder', bone, center, r, halfH, a: center.clone().addScaledVector(ax, -halfH), b: center.clone().addScaledVector(ax, halfH) });
	};
	const mid = (...dirs) => dirs.filter(Boolean).reduce((acc, d) => acc.add(d), V()).normalize();
	// Oriented box around a segment's own vertices; rightHint fixes the box's width axis.
	const box = (region, s, rightHint) => {
		if (!s || s.verts.length < 12) return;
		const up = s.dir.clone();
		let right = rightHint.clone().sub(up.clone().multiplyScalar(rightHint.dot(up)));
		if (right.lengthSq() < 1e-8) right = new THREE.Vector3(0, 0, 1).cross(up);
		right.normalize();
		const fwd = up.clone().cross(right).normalize().negate();
		const xs = [], ys = [], zs = [], p = V();
		for (const i of s.verts) {
			p.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]).sub(s.a);
			xs.push(p.dot(right)); ys.push(p.dot(up)); zs.push(p.dot(fwd));
		}
		const [x0, x1, z0, z1] = [quant(xs, 0.04), quant(xs, 0.96), quant(zs, 0.04), quant(zs, 0.96)];
		const y0 = Math.max(quant(ys, 0.02), -0.1 * s.len), y1 = Math.min(quant(ys, 0.98), 1.1 * s.len);
		const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
		const center = s.a.clone().add(right.clone().multiplyScalar((x0 + x1) / 2)).add(up.clone().multiplyScalar((y0 + y1) / 2)).add(fwd.clone().multiplyScalar((z0 + z1) / 2));
		vols.push({ region, type: 'box', bone: s.bone, center, basis, half: new THREE.Vector3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2) });
	};
	const X = new THREE.Vector3(1, 0, 0);
	// Head sphere on the head's own vertices (ears and horns dropped as outliers), so a head bone that pokes
	// out of the mesh still yields a head-shaped volume; the rig check reports the bone itself.
	const hs = seg(c.head);
	if (hs && hs.verts.length) {
		const med = quant(hs.dist, 0.5);
		const keep = hs.verts.filter((_, k) => hs.dist[k] < 2 * med);
		const ctr = keep.reduce((acc, i) => acc.add(V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2])), V()).multiplyScalar(1 / keep.length);
		const d = keep.map((i) => ctr.distanceTo(V().set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2])));
		sphere('head', c.head, ctr, quant(d, 0.8));
	}
	const ns = seg(c.neck);
	if (ns) capsule('throat', ns, robust(ns.dist, 0.7), 0, 1);
	// Torso: pelvis box on the hips segment, chest box on the last spine bone, abdomen boxes in between.
	const spine = S.segs.filter((s) => s.part === 'spine' && s.verts.length > 20);
	box('pelvis', seg(c.hips), X);
	// Mixamo: Spine (lower belly) | Spine1 (rib cage) | Spine2 (upper chest). Upper half of the chain = chest.
	const chestFrom = Math.floor(spine.length / 2);
	spine.forEach((s, i) => box(i >= chestFrom ? 'chest' : 'abdomen', s, X));
	for (const side of ['l', 'r']) {
		const cl = seg(c[`clavicle_${side}`]), ua = seg(c[`upperarm_${side}`]), fa = seg(c[`forearm_${side}`]), hd = seg(c[`hand_${side}`]);
		const th = seg(c[`thigh_${side}`]), sh = seg(c[`shin_${side}`]), ft = seg(c[`foot_${side}`]);
		if (ua) {
			slice('shoulder', ua.bone, ua.a.clone(), ua.dir, 1.15 * jointRadius(S, ua.a, [cl, ua], 0.15 * ua.len), 0.12 * ua.len);
			capsule('upper_arm', ua, robust(ua.dist, 0.75), 0.15, 0.85);
		}
		if (fa) {
			slice('elbow', fa.bone, fa.a.clone(), mid(ua?.dir, fa.dir), 1.2 * jointRadius(S, fa.a, [ua, fa], 0.15 * fa.len), 0.12 * fa.len);
			capsule('forearm', fa, robust(fa.dist, 0.75), 0.15, 0.85);
			slice('wrist', c[`hand_${side}`], fa.tip.clone(), mid(fa.dir, hd?.dir), 1.25 * jointRadius(S, fa.tip, [fa, hd], 0.12 * fa.len), 0.07 * fa.len);
		}
		// Hand: palm box across the knuckle line, one capsule per finger phalanx (curls with the finger).
		const hand = c[`hand_${side}`];
		const roots = hand ? hand.children.filter((k) => k.isBone && info.get(k)?.part === 'finger') : [];
		const idx = roots.find((k) => /index/i.test(k.name)), pky = roots.find((k) => /pinky|little/i.test(k.name));
		if (hd) box('hand', hd, idx && pky ? idx.getWorldPosition(V()).sub(pky.getWorldPosition(V())) : X);
		for (const r of roots) {
			const region = /thumb/i.test(r.name) ? 'thumb' : 'fingers';
			for (let b = r; b; b = b.children.find((k) => k.isBone)) {
				const s = seg(b);
				if (!s) continue;
				capsule(region, s, Math.max(robust(s.dist, 0.75), 0.18 * s.len), 0, 1);
			}
		}
		if (th) {
			slice('hip', th.bone, th.a.clone(), th.dir, 1.1 * jointRadius(S, th.a, [th], 0.12 * th.len), 0.1 * th.len);
			capsule('thigh', th, robust(th.dist, 0.75), 0.15, 0.85);
		}
		if (sh) {
			slice('knee', sh.bone, sh.a.clone(), mid(th?.dir, sh.dir), 1.2 * jointRadius(S, sh.a, [th, sh], 0.12 * sh.len), 0.1 * sh.len);
			capsule('shin', sh, robust(sh.dist, 0.75), 0.15, 0.85);
			slice('ankle', c[`foot_${side}`], sh.tip.clone(), sh.dir, 1.2 * jointRadius(S, sh.tip, [sh], 0.1 * sh.len), 0.07 * sh.len);
		}
		for (let b = c[`foot_${side}`]; b; b = b.children.find((k) => k.isBone)) {
			const s = seg(b);
			if (s) capsule('foot', s, robust(s.dist, 0.8), b === c[`foot_${side}`] ? 0.2 : 0, 1);
		}
	}
	// Purity: share of a region's vertices whose dominant skin weight is on the expected bones. Low purity
	// means the rig's weights disagree with where the bones are (a rig problem, not a hit-volume problem).
	const fingers = (thumb) => ch.skeleton.bones.filter((b) => info.get(b)?.part === 'finger' && /thumb/i.test(b.name) === thumb);
	const both = (k) => [c[`${k}_l`], c[`${k}_r`]];
	const spineBones = ch.bones.byKey.spine ?? [];
	const expect = {
		head: [c.head], throat: [c.neck, c.head], chest: [...spineBones.slice(Math.max(0, Math.floor(spineBones.length / 2) - 1)), ...both('clavicle'), c.neck],
		abdomen: [c.hips, ...spineBones.slice(0, Math.floor(spineBones.length / 2) + 1)], pelvis: [c.hips, ...both('thigh'), spineBones[0]],
		shoulder: [...both('clavicle'), ...both('upperarm'), spineBones.at(-1)], upper_arm: both('upperarm'), elbow: [...both('upperarm'), ...both('forearm')],
		forearm: both('forearm'), wrist: [...both('forearm'), ...both('hand')], hand: [...both('hand'), ...fingers(false), ...fingers(true)],
		thumb: fingers(true), fingers: fingers(false), hip: [c.hips, ...both('thigh')], thigh: both('thigh'), knee: [...both('thigh'), ...both('shin')],
		shin: both('shin'), ankle: [...both('shin'), ...both('foot')], foot: [...both('foot'), ...(ch.bones.byKey.toe_l ?? []), ...(ch.bones.byKey.toe_r ?? [])]
	};
	return finishRegions(ch, S, vols, HIT_REGIONS, PRIORITY, expect);
}

function finishRegions(ch, S, vols, REGIONS, ORDER, expect) {
	const info = ch.bones.info;
	// Attach every volume to its bone (bind pose -> bone-local) so it follows animation.
	for (const v of vols) {
		const world = new THREE.Matrix4();
		if (v.type === 'sphere') world.makeTranslation(v.center.x, v.center.y, v.center.z);
		if (v.type === 'capsule' || v.type === 'cylinder') {
			const mid = v.a.clone().add(v.b).multiplyScalar(0.5);
			world.compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.b.clone().sub(v.a).normalize()), new THREE.Vector3(1, 1, 1));
		}
		if (v.type === 'box') world.copy(v.basis).setPosition(v.center);
		v.world = world;
		v.inv = world.clone().invert();
		v.local = v.bone.matrixWorld.clone().invert().multiply(world);
		v.side = info.get(v.bone)?.side ?? null;
	}
	const inside = (v, p) => {
		if (v.type === 'sphere') return p.distanceTo(v.center) < v.r;
		if (v.type === 'capsule') { const c2 = V(); new THREE.Line3(v.a, v.b).closestPointToPoint(p, true, c2); return c2.distanceTo(p) < v.r; }
		if (v.type === 'cylinder') { const l = p.clone().applyMatrix4(v.inv); return Math.abs(l.y) < v.halfH && Math.hypot(l.x, l.z) < v.r; }
		const l = p.clone().applyMatrix4(v.inv);
		return Math.abs(l.x) < v.half.x && Math.abs(l.y) < v.half.y && Math.abs(l.z) < v.half.z;
	};
	const byRegion = Object.fromEntries(REGIONS.map((r) => [r, vols.filter((v) => v.region === r)]));
	const masks = Object.fromEntries(REGIONS.map((r) => [r, new Uint8Array(S.n)]));
	const p = V();
	for (let i = 0; i < S.n; i++) {
		p.set(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
		for (const r of ORDER) if (byRegion[r].some((v) => inside(v, p))) { masks[r][i] = 1; break; }
	}
	const mesh = ch.skinned[0];
	const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
	const dominant = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); } return mesh.skeleton.bones[best]; };
	expect ??= Object.fromEntries(REGIONS.map((r) => [r, byRegion[r].flatMap((v) => v.expect ?? [v.bone, v.bone.parent, ...v.bone.children])]));
	const summary = {};
	for (const r of REGIONS) {
		const ok = new Set(expect[r].filter(Boolean));
		let count = 0, pure = 0;
		for (let i = 0; i < S.n; i++) if (masks[r][i]) { count++; if (ok.has(dominant(i))) pure++; }
		const rv = byRegion[r];
		summary[r] = { vertices: count, purity: count ? +(pure / count).toFixed(2) : null, volumes: rv.length,
			sizeOfHeight: rv.slice(0, 6).map((v) => +((v.type === 'box' ? 2 * Math.max(v.half.x, v.half.z) : 2 * v.r) / ch.height).toFixed(3)), types: [...new Set(rv.map((v) => v.type))],
			bones: [...new Set(rv.map((v) => v.bone.name))].slice(0, 12) };
	}
	return { masks, summary, volumes: vols, regions: REGIONS, rig: rigCheck(ch, S) };
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
		if (['toe', 'end', 'finger'].includes(s.part)) continue;
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

// Overlay one region, or every region at once ('*'), colored per region, with the volumes as wireframes.
export function showRegion(ch, masks, region, volumes = ch.hitVolumes, { wire = true } = {}) {
	ch.overlay?.removeFromParent();
	ch.overlay = null;
	for (const m of ch.volumeMeshes ?? []) m.removeFromParent();
	ch.volumeMeshes = [];
	if (!region) return;
	const regions = region === '*' ? ch.hitRegionNames ?? HIT_REGIONS : Array.isArray(region) ? region : [region];
	const mesh = ch.skinned[0];
	const geo = mesh.geometry.clone();
	const n = geo.attributes.position.count;
	const col = new Float32Array(n * 4);
	for (const r of regions) {
		const rgb = new THREE.Color(REGION_COLOR[r] ?? 0xff2010);
		const m = masks[r];
		for (let i = 0; i < n; i++) if (m[i]) { col[i * 4] = rgb.r; col[i * 4 + 1] = rgb.g; col[i * 4 + 2] = rgb.b; col[i * 4 + 3] = 0.8; }
	}
	geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
	const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
	const overlay = new THREE.SkinnedMesh(geo, mat);
	overlay.bind(mesh.skeleton, mesh.bindMatrix);
	mesh.parent.add(overlay);
	overlay.position.copy(mesh.position); overlay.quaternion.copy(mesh.quaternion); overlay.scale.copy(mesh.scale);
	overlay.frustumCulled = false;
	ch.overlay = overlay;
	for (const v of (wire ? volumes ?? [] : []).filter((x) => regions.includes(x.region))) {
		const wire = new THREE.MeshBasicMaterial({ color: REGION_COLOR[v.region] ?? 0xffffff, wireframe: true, transparent: true, opacity: 0.55, depthTest: false });
		const g = v.type === 'sphere' ? new THREE.SphereGeometry(v.r, 12, 8)
			: v.type === 'capsule' ? new THREE.CapsuleGeometry(v.r, v.a.distanceTo(v.b), 4, 10)
			: v.type === 'cylinder' ? new THREE.CylinderGeometry(v.r, v.r, 2 * v.halfH, 14, 1)
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
	// With finger bones, the handle runs across the palm along the knuckle line (pinky -> index) and the
	// blade leaves on the thumb side, so the grip follows whatever the hand does in each clip. Without
	// finger bones, fall back to a blade pointing forward through the palm.
	const roots = hand.children.filter((k) => k.isBone && ch.bones.info.get(k)?.part === 'finger');
	const idx = roots.find((k) => /index/i.test(k.name)), pky = roots.find((k) => /pinky|little/i.test(k.name));
	let grip, along;
	if (idx && pky) {
		const pi = idx.getWorldPosition(V()), pp = pky.getWorldPosition(V());
		along = pi.clone().sub(pp).normalize();
		const knuckles = roots.filter((k) => !/thumb/i.test(k.name)).map((k) => k.getWorldPosition(V())).reduce((acc, v) => acc.add(v), V()).multiplyScalar(1 / Math.max(1, roots.filter((k) => !/thumb/i.test(k.name)).length));
		// Fist center: a little past the knuckles toward the fingertips.
		const hs = S.byBone.get(hand);
		grip = knuckles.add(hs ? hs.dir.clone().multiplyScalar(0.25 * hs.len) : V());
	} else {
		const hs = S.byBone.get(hand);
		const handPos = hand.getWorldPosition(V());
		const dir = hs ? hs.dir.clone() : new THREE.Vector3(0, -1, 0);
		const forward = new THREE.Vector3(0, 0, 1);
		along = forward.clone().sub(dir.clone().multiplyScalar(forward.dot(dir))).normalize();
		grip = handPos.clone().add(dir.clone().multiplyScalar(Math.max((hs ? hs.len : 0.04 * H) * 0.5, 0.025 * H)));
	}
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

export async function buildRagdoll(ch, { gravityScale = 3, minLengthFrac = 0.045, limits = true, selfCollision = true, limitHz = 10, substeps = 8 } = {}) {
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
		if (['toe', 'finger'].includes(s0.part)) continue;
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
	return { world, bodies, joints, soft, order, hooks, excludedPairs: excluded.size, steps: 0, limitHz, substeps };
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
	const wn = 2 * Math.PI * (rag.limitHz ?? 6);
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
export function stepRagdoll(ch, rag, dt = 1 / 60, substeps = rag.substeps ?? 4) {
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
