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
	// Normalize in bind pose: requested height, feet on the ground, centered.
	skeleton.pose();
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
	for (const [name, file] of Object.entries(entry.clips ?? {})) {
		const g = await loader.loadAsync(base + file);
		if (!g.animations.length) continue;
		// A per-clip file may carry several takes; keep the longest.
		const take = g.animations.reduce((a, b) => (b.duration > a.duration ? b : a));
		clips[name] = take.clone();
		clips[name].name = name;
	}
	const mixer = new THREE.AnimationMixer(inner);
	const bones = mapBones(skeleton);
	return { entry, root, inner, skinned, skeleton, clips, mixer, bones, height: entry.height ?? 1.1, scale: s };
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
// Hit regions: named bones -> gameplay regions, shown as a translucent overlay on the skinned mesh
// ---------------------------------------------------------------------------------------------
export const HIT_REGIONS = ['head', 'throat', 'torso', 'elbow', 'forearm', 'wrist', 'knee'];

export function hitRegions(ch) {
	const mesh = ch.skinned[0];
	ch.skeleton.pose();
	ch.root.updateMatrixWorld(true);
	const n = mesh.geometry.attributes.position.count;
	const rest = skinnedPositions(mesh, new Float32Array(n * 3));
	const parts = dominantParts(mesh, ch.bones);
	const c = ch.bones.canon;
	// Joint regions are axial bands across the joint, limited to vertices weighted to that limb, so thick
	// and thin limbs both get a sensible band. band = fraction of the distal bone's length.
	const P = (b) => b?.getWorldPosition(V());
	const bands = { elbow: [], wrist: [], knee: [] };
	for (const s of ['l', 'r']) {
		const ua = c[`upperarm_${s}`], fa = c[`forearm_${s}`], ha = c[`hand_${s}`], th = c[`thigh_${s}`], sh = c[`shin_${s}`], ft = c[`foot_${s}`];
		if (ua && fa && ha) bands.elbow.push({ j: P(fa), u: P(ha).sub(P(ua)).normalize(), w: 0.22 * P(ha).distanceTo(P(fa)), keys: [`upperarm_${s}`, `forearm_${s}`] });
		if (fa && ha) bands.wrist.push({ j: P(ha), u: P(ha).sub(P(fa)).normalize(), w: 0.16 * P(ha).distanceTo(P(fa)), keys: [`forearm_${s}`, `hand_${s}`] });
		if (th && sh && ft) bands.knee.push({ j: P(sh), u: P(ft).sub(P(th)).normalize(), w: 0.2 * P(ft).distanceTo(P(sh)), keys: [`thigh_${s}`, `shin_${s}`] });
	}
	const tmpV = V();
	const inBand = (i, acc, list) => list.some(({ j, u, w, keys }) => {
		if (!keys.some((k) => (acc[k] ?? 0) >= 0.5)) return false;
		tmpV.set(rest[i * 3] - j.x, rest[i * 3 + 1] - j.y, rest[i * 3 + 2] - j.z);
		return Math.abs(tmpV.dot(u)) < w;
	});
	const out = Object.fromEntries(HIT_REGIONS.map((r) => [r, new Uint8Array(n)]));
	for (let i = 0; i < n; i++) {
		const a = parts[i];
		const top = Object.entries(a).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'other';
		const part = top.replace(/_[lr]$/, '');
		if (inBand(i, a, bands.wrist)) out.wrist[i] = 1;
		else if (inBand(i, a, bands.elbow)) out.elbow[i] = 1;
		else if (inBand(i, a, bands.knee)) out.knee[i] = 1;
		else if (part === 'head') out.head[i] = 1;
		else if (part === 'neck') out.throat[i] = 1;
		else if (part === 'forearm') out.forearm[i] = 1;
		else if (['spine', 'hips', 'clavicle'].includes(part)) out.torso[i] = 1;
	}
	const bonesFor = {
		head: [c.head], throat: [c.neck], torso: [c.hips, ...(ch.bones.byKey.spine ?? []), c.clavicle_l, c.clavicle_r],
		elbow: [c.upperarm_l, c.forearm_l, c.upperarm_r, c.forearm_r], forearm: [c.forearm_l, c.forearm_r],
		wrist: [c.forearm_l, c.hand_l, c.forearm_r, c.hand_r], knee: [c.thigh_l, c.shin_l, c.thigh_r, c.shin_r]
	};
	const summary = Object.fromEntries(HIT_REGIONS.map((r) => [r, {
		vertices: out[r].reduce((s, v) => s + v, 0),
		bones: [...new Set(bonesFor[r].filter(Boolean).map((b) => b.name))]
	}]));
	return { masks: out, summary };
}

export function showRegion(ch, masks, region) {
	ch.overlay?.removeFromParent();
	ch.overlay = null;
	if (!region) return;
	const mesh = ch.skinned[0];
	const geo = mesh.geometry.clone();
	const n = geo.attributes.position.count;
	const col = new Float32Array(n * 4);
	const m = masks[region];
	for (let i = 0; i < n; i++) { col[i * 4] = 1; col[i * 4 + 1] = 0.12; col[i * 4 + 2] = 0.08; col[i * 4 + 3] = m[i] ? 0.85 : 0; }
	geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
	const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
	const overlay = new THREE.SkinnedMesh(geo, mat);
	overlay.bind(mesh.skeleton, mesh.bindMatrix);
	mesh.parent.add(overlay);
	overlay.position.copy(mesh.position); overlay.quaternion.copy(mesh.quaternion); overlay.scale.copy(mesh.scale);
	overlay.frustumCulled = false;
	ch.overlay = overlay;
}

// ---------------------------------------------------------------------------------------------
// Weapon socket: parent a prop to the hand bone
// ---------------------------------------------------------------------------------------------
export async function loadProp(file, base = '') {
	const g = await loader.loadAsync(base + file);
	const prop = g.scene;
	prop.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
	return prop;
}

// mode "grip": derive a socket from the bind pose (prop's long axis along the character's forward,
// through the palm). mode "inplace": the prop already sits in the hand in model space (a segmented part
// exported with the body), so keep its bind-pose transform relative to the hand.
export function attachProp(ch, prop, { side = 'r', mode = 'grip', length = 0.85, inplaceRoot = null } = {}) {
	const hand = ch.bones.canon[`hand_${side}`];
	if (!hand) throw new Error(`no hand_${side} bone`);
	ch.mixer.stopAllAction();
	ch.skeleton.pose();
	ch.root.updateMatrixWorld(true);
	const holder = new THREE.Group();
	if (mode === 'inplace') {
		// The prop came out of the same model space as the character's inner scene.
		const worldOfProp = (inplaceRoot ?? ch.inner).matrixWorld.clone();
		holder.add(prop);
		const local = hand.matrixWorld.clone().invert().multiply(worldOfProp);
		local.decompose(holder.position, holder.quaternion, holder.scale);
		hand.add(holder);
		return holder;
	}
	// Normalize the prop: long axis -> +Y, length in world units relative to character height.
	const box = new THREE.Box3().setFromObject(prop);
	const size = box.getSize(V());
	const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
	const fit = new THREE.Group();
	fit.add(prop);
	prop.position.sub(box.getCenter(V()));
	if (axis === 'x') fit.rotation.z = Math.PI / 2;
	if (axis === 'z') fit.rotation.x = Math.PI / 2;
	const s = (length * ch.height) / Math.max(size.x, size.y, size.z);
	fit.scale.setScalar(s);
	// Socket in world space at bind pose.
	const handPos = hand.getWorldPosition(V());
	const child = hand.children.find((b) => b.isBone);
	const dir = child ? child.getWorldPosition(V()).sub(handPos).normalize() : new THREE.Vector3(0, -1, 0);
	const handLen = child ? child.getWorldPosition(V()).distanceTo(handPos) : 0.04 * ch.height;
	const forward = new THREE.Vector3(0, 0, 1); // characters face +Z after the facing yaw
	const along = forward.clone().sub(dir.clone().multiplyScalar(forward.dot(dir))).normalize();
	const grip = handPos.clone().add(dir.clone().multiplyScalar(Math.max(handLen * 0.5, 0.025 * ch.height)));
	const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
	const world = new THREE.Matrix4().compose(grip, q, new THREE.Vector3(1, 1, 1));
	// Hold the shaft a third of the way from its butt end.
	const shift = new THREE.Matrix4().makeTranslation(0, length * ch.height * 0.17, 0);
	world.multiply(shift);
	holder.add(fit);
	const local = hand.matrixWorld.clone().invert().multiply(world);
	local.decompose(holder.position, holder.quaternion, holder.scale);
	hand.add(holder);
	return holder;
}

// ---------------------------------------------------------------------------------------------
// Ragdoll: capsule per major bone, ball joints (hinges at elbows and knees), 3x gravity
// ---------------------------------------------------------------------------------------------
let rapierReady = null;
export const initPhysics = () => (rapierReady ??= RAPIER.init());

const HINGE_PARTS = new Set(['forearm', 'shin']);

export async function buildRagdoll(ch, { gravityScale = 3, minLengthFrac = 0.045 } = {}) {
	await initPhysics();
	const world = new RAPIER.World({ x: 0, y: -9.81 * gravityScale, z: 0 });
	world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20).setTranslation(0, -0.1, 0).setFriction(0.9));
	ch.root.updateMatrixWorld(true);
	const mesh = ch.skinned[0];
	const n = mesh.geometry.attributes.position.count;
	const pos = skinnedPositions(mesh, new Float32Array(n * 3));
	const parts = dominantParts(mesh, ch.bones);
	// Pick major bones: segment to first bone child (or the farthest child for branching bones like hips).
	const major = [];
	for (const b of ch.skeleton.bones) {
		const p = ch.bones.info.get(b);
		if (['finger', 'toe', 'end'].includes(p.part)) continue;
		const kids = b.children.filter((k) => k.isBone);
		if (!kids.length) continue;
		const a = b.getWorldPosition(V());
		const tip = kids.length === 1 ? kids[0].getWorldPosition(V())
			: kids.map((k) => k.getWorldPosition(V())).reduce((s, v) => s.add(v), V()).multiplyScalar(1 / kids.length);
		const len = a.distanceTo(tip);
		if (len < minLengthFrac * ch.height && p.part !== 'head') continue;
		major.push({ bone: b, a, tip, len, part: p.part });
	}
	// Head has no meaningful child: give it a sphere-ish capsule from the head bone upward.
	const head = ch.bones.canon.head;
	if (head && !major.some((m) => m.bone === head)) {
		const a = head.getWorldPosition(V());
		major.push({ bone: head, a, tip: a.clone().add(new THREE.Vector3(0, 0.12 * ch.height, 0)), len: 0.12 * ch.height, part: 'head' });
	}
	// Capsule radius from the vertices each bone dominates: median distance to the segment.
	const boneIndex = new Map(mesh.skeleton.bones.map((b, i) => [b, i]));
	const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
	const near = new Map(major.map((m) => [boneIndex.get(m.bone), []]));
	for (let i = 0; i < n; i++) {
		let best = -1, bw = 0;
		for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
		if (near.has(best)) near.get(best).push(i);
	}
	const seg = new THREE.Line3();
	const tmp = V(), closest = V();
	const bodies = new Map();
	const velocities = ch.lastVelocities ?? new Map();
	for (const m of major) {
		const ids = near.get(boneIndex.get(m.bone));
		seg.set(m.a, m.tip);
		const ds = ids.map((i) => { tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); seg.closestPointToPoint(tmp, true, closest); return tmp.distanceTo(closest); });
		ds.sort((x, y) => x - y);
		const radius = THREE.MathUtils.clamp(ds.length ? ds[Math.floor(ds.length * 0.5)] : 0.03 * ch.height, 0.02 * ch.height, 0.16 * ch.height);
		const mid = m.a.clone().add(m.tip).multiplyScalar(0.5);
		const dir = m.tip.clone().sub(m.a).normalize();
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
		const v = velocities.get(m.bone) ?? V();
		// Bodies start world-aligned (identity rotation); only the capsule shape is rotated along the bone.
		// That makes every joint's relative rotation zero at the moment of death, so hinge limits are
		// measured from the current pose and nothing snaps at t=0.
		const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z)
			.setLinearDamping(0.1).setAngularDamping(1.5).setLinvel(v.x, v.y, v.z).setCcdEnabled(true);
		const body = world.createRigidBody(desc);
		const half = Math.max(0.001, m.len / 2 - radius * 0.5);
		world.createCollider(RAPIER.ColliderDesc.capsule(half, radius).setRotation(q).setDensity(1000).setFriction(0.8)
			// Ragdoll parts collide with the ground only (membership 0x0002, filter 0x0001): no self-collision.
			.setCollisionGroups(0x00020001), body);
		const bodyMatrix = new THREE.Matrix4().makeTranslation(mid.x, mid.y, mid.z);
		const offset = bodyMatrix.clone().invert().multiply(m.bone.matrixWorld);
		bodies.set(m.bone, { body, offset, radius, len: m.len, part: m.part, dir });
	}
	// Joints to the nearest ancestor that has a body.
	const joints = [];
	for (const [bone, rec] of bodies) {
		let p = bone.parent;
		while (p && !bodies.has(p)) p = p.parent;
		if (!p) continue;
		const parent = bodies.get(p);
		const anchorWorld = bone.getWorldPosition(V());
		const a1 = worldToBody(parent.body, anchorWorld), a2 = worldToBody(rec.body, anchorWorld);
		let data;
		if (HINGE_PARTS.has(rec.part)) {
			// Hinge axis: perpendicular to the limb and to the character's forward direction.
			// Both frames are world-aligned at creation, so one world-space axis serves both bodies.
			// axis = limb x forward: positive rotation swings the distal end forward (elbow flex), negative
			// swings it backward (knee flex). Limits are relative to the pose at the moment of death.
			const axis = rec.dir.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
			data = RAPIER.JointData.revolute(a1, a2, { x: axis.x, y: axis.y, z: axis.z });
			data.limitsEnabled = true;
			data.limits = rec.part === 'shin' ? [-2.0, 0.15] : [-0.15, 2.0];
		} else {
			data = RAPIER.JointData.spherical(a1, a2);
		}
		// Multibody (reduced-coordinate) joints cannot drift apart, unlike impulse joints under 3x gravity.
		const j = world.createMultibodyJoint(data, parent.body, rec.body, true);
		j.setContactsEnabled?.(false);
		joints.push({ joint: j, b1: parent.body, b2: rec.body, a1, a2 });
	}
	// Bones driven in hierarchy order so parents update before children.
	const order = ch.skeleton.bones.filter((b) => bodies.has(b));
	return { world, bodies, joints, order, steps: 0 };
}

function rotOf(body) { const r = body.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
function worldToBody(body, p) {
	const t = body.translation();
	const local = p.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(rotOf(body).invert());
	return { x: local.x, y: local.y, z: local.z };
}

const _m = new THREE.Matrix4(), _pw = new THREE.Matrix4();
export function stepRagdoll(ch, rag, dt = 1 / 60, substeps = 4) {
	rag.world.timestep = dt / substeps;
	for (let i = 0; i < substeps; i++) rag.world.step();
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
	return { bodies: rag.bodies.size, joints: rag.joints.length, maxSpeed: +maxV.toFixed(2), lowestBodyY: +minY.toFixed(3),
		maxJointSeparation: +(sep / ch.height).toFixed(4), steps: rag.steps };
}
