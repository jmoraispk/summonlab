import {
	CharacterMindSchema,
	EngineGameStateV5Schema,
	EngineGameStateV8Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	ReadinessCombatStateV1Schema,
	StoryPatchCandidateSchema,
	type ActionSource,
	type AuthoritativeEvent,
	type CombatActionIntent,
	type CombatChoiceBatchV1,
	type CombatLegalActionTemplate,
	type CombatResolvedEvent,
	type CombatResult,
	type EngineCommand,
	type EngineGameState,
	type MissionTurnChoice,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	COMBAT_CONTENT_BINDING,
	COMBAT_RULES_V1,
	TOWER_BAND_01_STORY_ENVELOPE
} from '@summonlab/content';

import {
	applyCommand,
	applyCombatChoiceBatch,
	advanceUntilDecision,
	authorizeReadinessTerminalDirective,
	combatChoiceBatchHash,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	legalActions,
	masterFallbackSafetySource,
	readinessTerminalDirective,
	sha256Hex,
	storyPatchCastForState,
	type EngineApplyResult
} from '../index.js';

export interface EngineReplayVector {
	readonly id: string;
	readonly schemaVersion: number;
	readonly events: readonly AuthoritativeEvent[];
	readonly expectedEventTypes: readonly string[];
	readonly expectedEventHashes?: readonly string[];
	readonly expectedBeforeHashes: readonly string[];
	readonly expectedAfterHashes: readonly string[];
	readonly expectedFinalStateHash: string;
	readonly expectedLegalActionIds: readonly string[];
	readonly expectedScheduledEventIds: readonly string[];
	readonly expectedResolvedScheduledEventIds: readonly string[];
	readonly expectedCanceledScheduledEventIds: readonly string[];
}

interface ReplayExpectation {
	readonly eventTypes: readonly string[];
	readonly eventHashes?: readonly string[];
	readonly beforeHashes: readonly string[];
	readonly afterHashes: readonly string[];
	readonly finalStateHash: string;
	readonly legalActionIds: readonly string[];
	readonly scheduledEventIds: readonly string[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly canceledScheduledEventIds: readonly string[];
}

export interface EngineReplayVectorCase {
	readonly vector: EngineReplayVector;
	readonly finalState: EngineGameState;
	readonly scheduledEventIds: readonly string[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly canceledScheduledEventIds: readonly string[];
}

export const REPLAY_VECTOR_EMPTY_STATE_HASH =
	'74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b';

function checkedExpectation(
	input: Omit<ReplayExpectation, 'beforeHashes' | 'canceledScheduledEventIds'> & {
		readonly canceledScheduledEventIds?: readonly string[];
	}
): ReplayExpectation {
	return {
		...input,
		beforeHashes: [REPLAY_VECTOR_EMPTY_STATE_HASH, ...input.afterHashes.slice(0, -1)],
		canceledScheduledEventIds: input.canceledScheduledEventIds ?? []
	};
}

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
	const omitted = new Set<PropertyKey>(keys);
	return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key))) as Omit<
		T,
		K
	>;
}

const EXPECTATIONS = {
	'v5-routine-activity-resolution': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'hero.destination.selected',
			'hero.travel.started',
			'simulation.advanced',
			'hero.daily.plan.created',
			'hero.routine.started',
			'simulation.advanced',
			'hero.activity.started',
			'simulation.advanced'
		],
		afterHashes: [
			'0d237bb8b7365173424bd92eec903c258b6ebc4af10bee27e2e1f1fde13b8e94',
			'55d86ab4ad26e8212096dcc9143108db7e55f8cc4cbbcc395ef5bf033229199a',
			'd5250ef81225f910d1c6e5108003471d662673d05e4aea9ad4b64fb4fec323f3',
			'2d0c08dee7bdf412e3d56a853448e422b11373d317ce8e34f132378f01049067',
			'acbe8e7512b814af437c0700555c4ac2e1181fc3472f2ca603e5d5162385d29f',
			'28994843926852d955c38414f0f73bbead9eed1cae8090e250cc67beec379bcc',
			'75fbf71ef0fe51687d7c29840f65018cbc6627060d52cfa8f89f0a0074505454',
			'c12f22a50b337ed16ec59f455978520471206d89f4cfa297e7aa43dcacd4075f',
			'2946edacb2f0279537e666d55f733cfc3d964a32fa02d25ea5820e06fb8d9d57'
		],
		finalStateHash: '2946edacb2f0279537e666d55f733cfc3d964a32fa02d25ea5820e06fb8d9d57',
		legalActionIds: [
			'master.inspect.gate',
			'settlement.assign.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b.summoning-gate',
			'settlement.assign.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b.kitchen',
			'settlement.assign.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b.dormitory',
			'settlement.assign.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b.training-ground',
			'settlement.assign.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b.workshop',
			'settlement.power.kitchen',
			'settlement.power.dormitory',
			'settlement.power.training-ground',
			'settlement.power.workshop',
			'simulation.damage.hero.422414aa-d5a3-4deb-8fbb-6211a9f6eb9b',
			'simulation.damage.master'
		],
		scheduledEventIds: [
			'5635010b-6c42-48e6-814e-024a2cf679ef',
			'33d5c998-bc5c-45ac-bb61-3c7581e7333d',
			'd80bf797-6f57-441d-846a-afb60a24c355'
		],
		resolvedScheduledEventIds: [
			'5635010b-6c42-48e6-814e-024a2cf679ef',
			'33d5c998-bc5c-45ac-bb61-3c7581e7333d',
			'd80bf797-6f57-441d-846a-afb60a24c355'
		]
	}),
	'v8-communication': checkedExpectation({
		eventTypes: ['run.initialized', 'social.communicative.act.recorded'],
		afterHashes: [
			'0ada0f9eeb95eb7d016b622d2d0693f7d163e0eaf80522e3495084782186f45c',
			'e38c7336d9f3b97ff7663766aaa40bfdf3d3286e5ac2baa88aa326b55437796f'
		],
		finalStateHash: 'e38c7336d9f3b97ff7663766aaa40bfdf3d3286e5ac2baa88aa326b55437796f',
		legalActionIds: [
			'master.inspect.gate',
			'settlement.assign.0d530702-959d-4e5d-9f10-114592e839ab.summoning-gate',
			'settlement.assign.0d530702-959d-4e5d-9f10-114592e839ab.kitchen',
			'settlement.assign.0d530702-959d-4e5d-9f10-114592e839ab.dormitory',
			'settlement.assign.0d530702-959d-4e5d-9f10-114592e839ab.training-ground',
			'settlement.assign.0d530702-959d-4e5d-9f10-114592e839ab.workshop',
			'social.communicate.0d530702-959d-4e5d-9f10-114592e839ab',
			'simulation.damage.hero.0d530702-959d-4e5d-9f10-114592e839ab',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v14-mission-evidence-arena-knowledge': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved'
		],
		afterHashes: [
			'21c459ecefe7b1b6ca3aa2de302efe7584923f6ba79bc7026e352f46a6e80b79',
			'3a31e17301b102a3b65f25c138e47a09b9237c11aaeccde2b714ecfa544451d7',
			'7b4033eccdbbb07e2b164b022f095e21cef76528ed39c3c74ae20db134df8ef0',
			'80be5aa57a5ecea41b70c57126789bc22d92f1da71a13324eee95a198a28a5e5',
			'710900eb06e9c6b73c6c97c3baa85242a99be15058295c3423ad66fbb4272a57',
			'edd2fb111c463dbe51a3798c119467b1fe5542325f5c7694ffb3e9e06fd39c13',
			'182ce7331c976c6f7f9607f9b0fa26d90973fffa0f0d102565df8732a8abd307',
			'784a1ab39a1b381697d6ed64c4246bead04f2f133da1e4c9adf6fe818b3afce0'
		],
		finalStateHash: '784a1ab39a1b381697d6ed64c4246bead04f2f133da1e4c9adf6fe818b3afce0',
		legalActionIds: ['mission.hold', 'mission.move.left-relay-to-archive-niche'],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v15-iron-moon-portal-cargo-extraction': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.extracted'
		],
		afterHashes: [
			'22803790ae53234ca8012a5aa78154d6a38847a4c4bdf98a51a2a13c44eb82a9',
			'4c9af91e3cf079db15d3a7018af5cb07034ba836ec1119baaa74cf647d9de3de',
			'5bee22244e0e72c4e10e2b9fd96eaf7d9e33bb4bc927fbe970d273fc021258a8',
			'1c86dbdb287a7beaec785e92b33e41440fcc8e56d53d153646baa2286d9c65cf',
			'35f71db032a5764087faddbc0a9689bbd337b8328957a7914618aa3da4345acc',
			'd3d57ce17c9895bf5eb0ffcde6cd57e6912304593475cc7d242d1d9296328f28',
			'9b5088830a6bd925796b6402a116f159608060cf694748443eec601f0d8307f6',
			'87ccd232cc1b49569b19e85dc3fb46b8c508f7eb5022c4a7ab3874a0e0106593',
			'1eb5a467681347fabe09500ea8a5bbb2586839c2f41f046436980c2e5c547d0d',
			'eecbd0ace9275a6cdd19125f9e6d6185bcf980c831770cfb0b78c13a1658a2d7'
		],
		finalStateHash: 'eecbd0ace9275a6cdd19125f9e6d6185bcf980c831770cfb0b78c13a1658a2d7',
		legalActionIds: [
			'master.inspect.gate',
			'simulation.damage.hero.ae9f749e-b23c-452a-b790-1428123a8853',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v16-persistent-mission-aftermath': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved'
		],
		afterHashes: [
			'7d49294ce27901d810c445cbf5244a5e649aa596e6b22b8ca81e417c8e6e037e',
			'864603c741655104592645da0a9c359c55f9f00464bc87cbf8ac12d25ebcc4cc',
			'c232edd04d1be057c47ecfeeeed4c7ebc9befc41f6d1ee4d32d1577e508c6eee',
			'7c0bb535fc68728a6ffbc31ac89f95e3459746a55c57319c53723defd87a4d99',
			'516373ec603c294b537552d14052680ff50af9128c3499b9cac23f21c2310816',
			'3c21e81e11531eab65e1620cb16aeb0f181f131342c864342983e764be1263d6',
			'f39ccd5ba268a8fd7ac82f8f4fbbb1cb4e4577612334204e6da1b49f616ff796',
			'f529ef400fb7c8f9336912e084efd1278375c373fee72d095fdd3f3ea91278a7'
		],
		finalStateHash: 'f529ef400fb7c8f9336912e084efd1278375c373fee72d095fdd3f3ea91278a7',
		legalActionIds: [
			'mission.hold',
			'mission.inspect.follow-bloodless-prints',
			'mission.inspect.listen-for-slag-rhythm',
			'mission.move.cut-stair-to-red-gallery',
			'mission.move.red-gallery-to-tithe-pit'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v17-master-permadeath': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'social.directive.issued',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved'
		],
		afterHashes: [
			'c7675ffc8c966280cd875393348f57796100734e45176046f0312f756bdc0df8',
			'3a8809498bd557c13045ac1b3251f11634e0571fc1f3f59a4aec80f892990aca',
			'b7c741c47309f7b6189282ca18444fd752340809bc2ce8aa6f26e093b501e51d',
			'5d06230987d487c1d63910b088a85d388fd4f49fa5c115b8d1b247cde200cec8',
			'59cb6c906e88f11bf95fc6dec91340cb54dea81f4ae9a646623e77a946fec773',
			'b306ee1b27a29c2be02b9b083d5c9c527b797e63034259a4cce712d62172f3ab',
			'afbca11c0a58646d38dfbff1e36a23f001d43ad7524eab26f86c4fff67b189c4',
			'5995e6f86125830c28a7f245a1029760971643366fb7d43c3bc7bb58ed4475f0'
		],
		finalStateHash: '5995e6f86125830c28a7f245a1029760971643366fb7d43c3bc7bb58ed4475f0',
		legalActionIds: [],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v18-attempt-aftermath-archive': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.round.resolved',
			'mission.retreated',
			'mission.preparation.started'
		],
		afterHashes: [
			'b50f5ca450c207b19f4b626cc6b72a909d3254bf3425f8da69216cc0a19d1e58',
			'3b74f5af9228c5f33a38f22a666c3cb81f1fcb78c77bdd48c9fb15d4bf52c959',
			'beee87eddc887e582d9b05c4ed802687a3f9c2fadbc653f0ef3184f5d8bb7583',
			'd2819cf2932f357e167f49f3faf1b16d653c1c9775987cfeae9093c17c9fabb6',
			'f9be98c83f4566560b5c04e6a72df2020a72b152fa4585d674ac4b219dba6028',
			'0613db1dd5877ca17afa9344087c52a53aa7e7efe16708059a862580fdf6f219',
			'f8e05400de91dd860df7c5dcd71d82956b40f48cc19c926dca60215c83ed77de',
			'861ac13e7ecbba54454d0676e527ec26ccca1a87b95d65cf17c3adc9ea374e73',
			'9e272b5fc2d81c7a85670dae32aacd551b87030bc68383af001303bde369fc09',
			'733ef32af6ee38522acdaff1e45152dd1482a022d6d3317ff22c37ce1d1f736b',
			'ed718dd3a50e033cdab427cae6b2736b8806319fe81a0a6325baf5e08cc0576b',
			'84df7ad642c3e6f72e5131101f79309f37563624758bf8fdeef3109c9d392a36',
			'4dd6e2ff27ec42a71760bdab71136d3777b40c4c91ef4ef713b7502dba860c70'
		],
		finalStateHash: '4dd6e2ff27ec42a71760bdab71136d3777b40c4c91ef4ef713b7502dba860c70',
		legalActionIds: ['mission.revise.party', 'mission.deploy', 'mission.cancel'],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v19-master-timing-turn': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'master.timing.changed',
			'master.decision.opened',
			'mission.round.resolved'
		],
		afterHashes: [
			'8dee3ce4ee8a7bb355b389c3b25278b7541ee09846dfe5220cc1703cee86d58b',
			'6f50a239e1c63bb2aedd5e0a666eab67b5fadaacdbd76732a7114ca6a7078d8f',
			'4ebe6073dbca024022a14c4b96dcdf0d3ce52d98c910b32fa321032e3fd248cc',
			'63a94a4df27f3ff1808bdc8a9d08680fb6ec8ee84a3cefa48fa1c0d0fb114e4d',
			'30323f86443da76158c1e458c6a638309ac495c8e200a479f579619d98130a3e',
			'030d2e72bc035dbfd3919f76911bc080471e25f8e6ae6fb8f6e49cdefffa6e85'
		],
		finalStateHash: '030d2e72bc035dbfd3919f76911bc080471e25f8e6ae6fb8f6e49cdefffa6e85',
		legalActionIds: [
			'master.control.configure',
			'mission.hold',
			'mission.move.threshold-to-oath-hall',
			'mission.retreat'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v20-master-fallback-safety-stop': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'master.fallback.changed',
			'master.timing.changed',
			'master.decision.opened',
			'master.safety.stopped'
		],
		afterHashes: [
			'49efe75f5f495018f28b330f9198846f917a9ce9c664e255297786a44fa37f1e',
			'23aa8ed236c3e47bfedc5ba93cab8624e9bc5bf8dd58ebc1c85d36bd0f3d82f6',
			'076fcde231e33ddceb11cdd90c8cb98ba458a277e56bf00b64d7ee26a4df41a4',
			'6b58bfc65c9084a44c8444b04e624ed21a0d19408dbeebbc1a8cf84af1c0d4b1',
			'4514bd0ce2d820c971af6034d3a75f9d2a7eac62da3b872f183e35b36540fa79',
			'a978f343d7a950224a66f42fe162607e129c78edbd2f87f3abac1493713387e5',
			'8d884e8d176e5634a7de521fd053319062eba7590608dd3e16f7f2429a4af06f'
		],
		finalStateHash: '8d884e8d176e5634a7de521fd053319062eba7590608dd3e16f7f2429a4af06f',
		legalActionIds: [
			'master.control.configure',
			'master.fallback.configure',
			'mission.hold',
			'mission.move.threshold-to-oath-hall',
			'mission.retreat'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v21-story-patch': checkedExpectation({
		eventTypes: ['run.initialized', 'story.patch.applied'],
		afterHashes: [
			'471249dfbcb42670fdfcca84abfe226325222bb7db5b709f8751b835478e606e',
			'1c3c4e490c9c05e5d34af613d8b968e1031edc8df471b02d72ed536b10710850'
		],
		finalStateHash: '1c3c4e490c9c05e5d34af613d8b968e1031edc8df471b02d72ed536b10710850',
		legalActionIds: [
			'master.inspect.gate',
			'simulation.damage.hero.15500000-0000-4000-8000-000000000002',
			'simulation.damage.hero.15500000-0000-4000-8000-000000000003',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v22-synthesis-and-rumor': checkedExpectation({
		eventTypes: ['run.initialized', 'hero.synthesized', 'social.synthesis.rumor.shared'],
		afterHashes: [
			'292cc5268b48f723ba1fa049056da1bb3af7ed66a80ab7034a674e57c5300cc2',
			'af377b4ba6497be7f1225ac7252dbe0efbd9969ace635dd147e4df71a0a248da',
			'32b3a788f1140c32d38792784ac31ce31bfcdfa91edee6641f4f76ea00d9786c'
		],
		finalStateHash: '32b3a788f1140c32d38792784ac31ce31bfcdfa91edee6641f4f76ea00d9786c',
		legalActionIds: [
			'master.inspect.gate',
			'settlement.synthesis.commit',
			'simulation.damage.hero.27000000-0000-4000-8000-000000000003',
			'simulation.damage.hero.27000000-0000-4000-8000-000000000004',
			'simulation.damage.hero.27000000-0000-4000-8000-000000000005',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v23-first-band-archive': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			...Array(23).fill('mission.round.resolved'),
			'mission.extracted',
			'story.first.archive.revealed'
		],
		afterHashes: [
			'c470a45c2b866ba1a794bdd0e8dc2fff10f089e9b738b62703cfd758463075d7',
			'e33144bd4fcdce62b312b1a1f81baa63f06ca084b920c0be75f2946af9abdeae',
			'1c8c401b6b68e704541bb528276975aa76b9231e8d6fe1823ead2491467c2a08',
			'b756b92a995881ab28675750800c38ca9ffee5bf6099dd472c247c04623b3552',
			'2b620fb222f143873af36dfacdaf4ede6198730f04c6927be814ff0ab279dd8f',
			'b6a645a115eb69155548f643cf3bb12c15b2bdce20475820a48b2e713edbb8fa',
			'630809665f45ea675ec737fac5fecfaccae1e5ab4c5bcf4d6fac913286427319',
			'ac24e196ee156da7bab286429ce0bb8ea43fb1594f6e0b4319c37128a342e534',
			'be25d734ff2f8a866e7ea614b797017165846db2c1cdce99392c38cc26f9106f',
			'f75c16ace673ed9ec43c25d20f9aad781ee15b098150590941637f11879eb009',
			'dddf233d9a3a52c1dfe04d97bddedf12a4fbbc85f8f0aa5205af2f2c954da6cf',
			'a3b0ec51a0cf0ea1c8309a3849845280c8b422f0a9eb163186dab210a0c1dbd8',
			'192f0ff15b2da84ccf061bece00c488d33af31d56591860f03f53bf53ec1ea1a',
			'e49e83579f7833ff5f367d8fbb951a4e5ef3e3b1679d15097a8d46d782c1acde',
			'74cbc952fef547b96a30e65df0d106e8965d5d766df9ce1bfa280e30c35f4f35',
			'29965fcb84e3a30417573948d4d19320b41497315a9436f2c51d9171140bbfb2',
			'5ee54c39410de1b0d68a436bdd218f120191c9633253ce74aeb3bceab37c4687',
			'6c1d3319e8fe559a8fffcb5cd8bb2840567397a42e9d8bed6c74952cc5cb1497',
			'cfafc3accec5bd75fabd2b8649294cea4ca33b21d8ad54969f8616ddcd6a77c9',
			'9fe7740942d9d37dc0e81a230612b17fbad7a4a8458a51cdca3925a8fe4621d6',
			'ec8dfb666408007024450531244921bf171bf58a01bdf2a9760d2aa3fc2ba154',
			'cc742ecf9869fc9c5b7d7093ca0e0dd264e48189237e46b18e55dee53cac202a',
			'facf4e9fefa91b9f2e7122998ce7be50e45316dccf80c875f4f523350f0e5e6b',
			'cca8777d3c436ffb19c2c3e0bc693f21dc09940ca37d49026fb7fcb532e57718',
			'e61cbb81d8e9b3e4b84ea210851cc259eee842cf5427d07538499deb1de18b7e',
			'980fc8a9ec55e9b633f1432c392c29a39b5f895c8dc7e2fb108830832420ecd9',
			'c0cba65fda11d117f19e9cb9c5d2aa154226a60e87641d031290c2ed18af3d04',
			'5a5a78f714cd49e5ec1c2456ab1e11f6404ba04d256cb4977b82dd899fd03ebd'
		],
		finalStateHash: '5a5a78f714cd49e5ec1c2456ab1e11f6404ba04d256cb4977b82dd899fd03ebd',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'simulation.damage.hero.3b68f42a-3995-447e-a246-fa42aace2e45',
			'simulation.damage.hero.bf31ada7-a8be-41ed-af1b-1061ce964568',
			'simulation.damage.hero.0c2a5107-13b5-490f-bd43-0789c312ddba',
			'simulation.damage.hero.9dae563a-da09-4543-930f-4b6d2a3ef87b',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v24-equipment-state': checkedExpectation({
		eventTypes: ['run.initialized', 'master.gate.inspected'],
		afterHashes: [
			'62906ca15c0ae01b6197320f2e931d286383efe0218bdd702dbdf0eb21b91d7e',
			'000ef899bceda61815053ed39434d1a6108c0430dd4647c16cbcaa238a51ad56'
		],
		finalStateHash: '000ef899bceda61815053ed39434d1a6108c0430dd4647c16cbcaa238a51ad56',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'simulation.damage.hero.91568a1b-76b3-4591-a7f3-60360ea322ce',
			'simulation.damage.master'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	}),
	'v24-equipment-mission-resolution': checkedExpectation({
		eventTypes: [
			'run.initialized',
			'mission.preparation.started',
			'mission.deployed',
			'mission.round.resolved',
			'mission.round.resolved'
		],
		eventHashes: [
			'3c2575e846030bf4858dd3cf5a90d199fb8fe1835c238e3e9bf38b8f8733d323',
			'c27329ce47d3356d5a5fee05abcf547460529204b52d7d6ab8c459676fe9fea6',
			'e6bc052c2659863ebf25e97d482f9a08f3f574e610037f4360800caf14c16fb3',
			'6d41833efdb8c07ab771b86152f832e58467080f58956a9592e41dba5ce88191',
			'd8ae519a899e33ff3c31a19c709b72b02f858959c4c96e2dbe76e895f26e1851'
		],
		afterHashes: [
			'2f6397320a421dc62bc658e356105ea62b0bee4c906e7c488aba98dd3ece1785',
			'9a7c0b4bd7b20ed13f5a9b45b671564d7d701a164d8f6a32e46b7d62b6ce0658',
			'23abcd0e6b6c7a7dd37876151f435216a009be976d97d821f051264c8ccf7108',
			'bc93a8266d588348438a5d59960c42c65899cf52b25c45fc70fc0fcd7326a3f6',
			'be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20'
		],
		finalStateHash: 'be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20',
		legalActionIds: [
			'mission.hold',
			'mission.inspect.inspect-soot-seam',
			'mission.inspect.read-muster-tablet',
			'mission.move.oath-hall-to-gallery',
			'mission.move.threshold-to-oath-hall'
		],
		scheduledEventIds: [],
		resolvedScheduledEventIds: []
	})
} as const;

function manualSource(): ActionSource {
	return {
		source: 'manual',
		timing: 'step',
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function scriptedSource(): ActionSource {
	return { ...manualSource(), source: 'scripted', timing: 'continuous' };
}

function systemSource(): ActionSource {
	return { ...manualSource(), source: 'system', timing: null };
}

function manualChoice(actorId: string, actionId: string): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source: 'manual',
		policyId: null,
		packetHash: null,
		legalActionHash: null,
		policyResultHash: null,
		publicIntent: `The Master chose ${actionId}.`
	};
}

function scriptedChoice(actorId: string, actionId: string): MissionTurnChoice {
	return {
		actorId,
		actionId,
		source: 'scripted',
		policyId: 'scripted-personality-v1',
		packetHash: sha256Hex(`${actorId}:${actionId}:packet`),
		legalActionHash: sha256Hex(`${actorId}:${actionId}:legal`),
		policyResultHash: sha256Hex(`${actorId}:${actionId}:result`),
		publicIntent: `The hero independently chose ${actionId}.`
	};
}

class VectorRun {
	readonly events: AuthoritativeEvent[];
	readonly applyResults: EngineApplyResult[] = [];
	state: EngineGameState;

	constructor(initialState: EngineGameState, bootstrapEvent: AuthoritativeEvent) {
		this.state = initialState;
		this.events = [bootstrapEvent];
	}

	commit(
		actorId: string,
		key: string,
		body: object,
		source: ActionSource = manualSource()
	): EngineApplyResult {
		const commandId = deterministicUuid(`${this.state.runId}:${key}:${this.state.version}`);
		const result = applyCommand(this.state, {
			commandId,
			runId: this.state.runId,
			actorId,
			expectedVersion: this.state.version,
			correlationId: commandId,
			source,
			...body
		} as EngineCommand);
		this.state = result.state;
		this.events.push(...result.events);
		this.applyResults.push(result);
		return result;
	}
}

function finishVector(
	id: string,
	schemaVersion: number,
	run: VectorRun,
	expected: ReplayExpectation
): EngineReplayVectorCase {
	const scheduledEventIds = run.applyResults.flatMap((result) =>
		result.scheduled.map((event) => event.scheduledEventId)
	);
	const resolvedScheduledEventIds = run.applyResults.flatMap(
		(result) => result.resolvedScheduledEventIds
	);
	const canceledScheduledEventIds = run.applyResults.flatMap(
		(result) => result.canceledScheduledEventIds
	);
	return {
		vector: {
			id,
			schemaVersion,
			events: run.events,
			expectedEventTypes: expected.eventTypes,
			...(expected.eventHashes ? { expectedEventHashes: expected.eventHashes } : {}),
			expectedBeforeHashes: expected.beforeHashes,
			expectedAfterHashes: expected.afterHashes,
			expectedFinalStateHash: expected.finalStateHash,
			expectedLegalActionIds: expected.legalActionIds,
			expectedScheduledEventIds: expected.scheduledEventIds,
			expectedResolvedScheduledEventIds: expected.resolvedScheduledEventIds,
			expectedCanceledScheduledEventIds: expected.canceledScheduledEventIds
		},
		finalState: run.state,
		scheduledEventIds,
		resolvedScheduledEventIds,
		canceledScheduledEventIds
	};
}

/**
 * Legacy v5/v8 bootstraps are synthetic compatibility fixtures. The public bootstrap API creates
 * v13+, so these two states are projected through the public v5/v8 schemas. Their field selection
 * follows the checked-in canonical compatibility states; the returned public run.initialized event
 * supplies every other field and its after hash is recomputed with public hashGameState.
 */
function legacyBootstrap(schemaVersion: 5 | 8) {
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid(`replay-vector-v${schemaVersion}-run`),
		seed: `replay-vector-v${schemaVersion}-seed`,
		heroId: deterministicUuid(`replay-vector-v${schemaVersion}-hero`),
		manifestHash: sha256Hex(`replay-vector-v${schemaVersion}-manifest`)
	});
	if (bootstrap.snapshot.state.schemaVersion !== 13)
		throw new Error('Expected public v13 bootstrap');
	const modern = bootstrap.snapshot.state;
	const state = (() => {
		if (schemaVersion === 5) {
			const base = omitKeys(modern, ['society', 'mission']);
			const settlement = omitKeys(modern.settlement, ['firstEmber']);
			return EngineGameStateV5Schema.parse({
				...base,
				schemaVersion: 5,
				contentVersion: 'engine-v5',
				settlement
			});
		}
		const base = omitKeys(modern, ['mission']);
		const society = omitKeys(modern.society, [
			'conversationTurns',
			'directives',
			'directiveInfluences'
		]);
		return EngineGameStateV8Schema.parse({
			...base,
			schemaVersion: 8,
			contentVersion: 'engine-v8',
			society: { ...society, contentVersion: 'society-v2' }
		});
	})();
	const event: AuthoritativeEvent = {
		...bootstrap.event,
		schemaVersion,
		contentVersion: `engine-v${schemaVersion}`,
		afterStateHash: hashGameState(state),
		payload: { ...bootstrap.event.payload, initialState: state }
	};
	return { state, event };
}

function v5RoutineAndActivityVector(): EngineReplayVectorCase {
	const bootstrap = legacyBootstrap(5);
	const run = new VectorRun(bootstrap.state, bootstrap.event);
	const heroId = Object.keys(run.state.heroes)[0]!;
	const masterId = run.state.master.masterId;
	run.commit(
		heroId,
		'v5-choose-training',
		{
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Let me test what this body remembers.',
			storyBranch: 'steel-before-trust'
		},
		scriptedSource()
	);
	const travel = run.commit(
		heroId,
		'v5-travel-training',
		{ commandType: 'hero.start.travel', targetNodeId: 'training-ring' },
		scriptedSource()
	);
	run.commit(
		masterId,
		'v5-arrive-training',
		{ commandType: 'simulation.advance', targetGameTime: travel.scheduled[0]!.dueGameTime },
		systemSource()
	);
	run.commit(heroId, 'v5-plan-day', { commandType: 'hero.plan.day' }, scriptedSource());
	const routine = run.commit(
		heroId,
		'v5-start-routine',
		{ commandType: 'hero.start.routine' },
		scriptedSource()
	);
	run.commit(
		masterId,
		'v5-complete-routine',
		{ commandType: 'simulation.advance', targetGameTime: routine.scheduled[0]!.dueGameTime },
		systemSource()
	);
	const activity = run.commit(
		heroId,
		'v5-start-activity',
		{ commandType: 'hero.start.activity', activity: 'train' },
		scriptedSource()
	);
	run.commit(
		masterId,
		'v5-complete-activity',
		{ commandType: 'simulation.advance', targetGameTime: activity.scheduled[0]!.dueGameTime },
		systemSource()
	);
	return finishVector(
		'v5-routine-activity-resolution',
		5,
		run,
		EXPECTATIONS['v5-routine-activity-resolution']
	);
}

function v8CommunicationVector(): EngineReplayVectorCase {
	const bootstrap = legacyBootstrap(8);
	const run = new VectorRun(bootstrap.state, bootstrap.event);
	const heroId = Object.keys(run.state.heroes)[0]!;
	run.commit(run.state.master.masterId, 'v8-private-explanation', {
		commandType: 'master.communicate',
		targetHeroId: heroId,
		kind: 'explain',
		topic: 'master-role',
		exactText: 'I own Floor 100 and can make the sun rise.',
		tone: 'firm',
		delivery: 'private'
	});
	return finishVector('v8-communication', 8, run, EXPECTATIONS['v8-communication']);
}

function missionTurn(
	run: VectorRun,
	key: string,
	masterActionId: string,
	heroId: string,
	heroActionId: string,
	source: ActionSource = manualSource(),
	extra: object = {}
) {
	return run.commit(
		run.state.master.masterId,
		key,
		{
			commandType: 'mission.resolve.turn',
			choices: [
				manualChoice(run.state.master.masterId, masterActionId),
				scriptedChoice(heroId, heroActionId)
			],
			...extra
		},
		source
	);
}

function v14MissionEvidenceVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('foundry-evidence-run');
	const heroId = deterministicUuid('foundry-evidence-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'foundry-evidence-seed',
		heroId,
		manifestHash: sha256Hex('foundry-evidence-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04', 'tower-floor-05']
		}
	});
	const run = new VectorRun(
		EngineGameStateV14Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'floor-04-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-04'
	});
	run.commit(masterId, 'floor-04-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'floor-04-balance',
		'mission.move.threshold-to-balance-hall',
		heroId,
		'mission.move.threshold-to-balance-hall'
	);
	missionTurn(
		run,
		'floor-04-left-relay',
		'mission.move.balance-hall-to-left-relay',
		heroId,
		'mission.move.balance-hall-to-left-relay'
	);
	missionTurn(
		run,
		'floor-04-open-archive',
		'mission.hold',
		heroId,
		'mission.inspect.open-archive-niche'
	);
	missionTurn(
		run,
		'floor-04-enter-archive',
		'mission.move.left-relay-to-archive-niche',
		heroId,
		'mission.move.left-relay-to-archive-niche'
	);
	missionTurn(
		run,
		'floor-04-read-schematic',
		'mission.hold',
		heroId,
		'mission.inspect.read-foundry-schematic'
	);
	return finishVector(
		'v14-mission-evidence-arena-knowledge',
		14,
		run,
		EXPECTATIONS['v14-mission-evidence-arena-knowledge']
	);
}

function v15IronMoonVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('iron-moon-runtime-run');
	const heroId = deterministicUuid('iron-moon-runtime-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'iron-moon-runtime-seed',
		heroId,
		manifestHash: sha256Hex('iron-moon-runtime-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'iron-moon',
			availableMissionIds: ['iron-moon']
		}
	});
	const run = new VectorRun(
		EngineGameStateV15Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'iron-moon-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'iron-moon'
	});
	run.commit(masterId, 'iron-moon-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'iron-moon-shelf',
		'mission.move.gate-to-shelf',
		heroId,
		'mission.move.gate-to-shelf'
	);
	missionTurn(
		run,
		'iron-moon-split',
		'mission.move.shelf-to-pale-vein',
		heroId,
		'mission.move.shelf-to-crater-heart'
	);
	missionTurn(
		run,
		'iron-moon-mine-one',
		'mission.mine.pale-vein-deposit',
		heroId,
		'mission.mine.crater-heart-deposit'
	);
	missionTurn(
		run,
		'iron-moon-mine-two',
		'mission.mine.pale-vein-deposit',
		heroId,
		'mission.mine.crater-heart-deposit'
	);
	missionTurn(
		run,
		'iron-moon-regroup',
		'mission.move.shelf-to-pale-vein',
		heroId,
		'mission.move.shelf-to-crater-heart'
	);
	missionTurn(
		run,
		'iron-moon-return',
		'mission.move.gate-to-shelf',
		heroId,
		'mission.move.gate-to-shelf'
	);
	run.commit(masterId, 'iron-moon-extract', { commandType: 'mission.extract' });
	return finishVector(
		'v15-iron-moon-portal-cargo-extraction',
		15,
		run,
		EXPECTATIONS['v15-iron-moon-portal-cargo-extraction']
	);
}

function v16PersistentAftermathVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('mission-aftermath-run');
	const heroId = deterministicUuid('mission-aftermath-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'foundry-evidence-seed',
		heroId,
		manifestHash: sha256Hex('mission-aftermath-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-03',
			availableMissionIds: ['tower-floor-03'],
			enableMissionAftermath: true
		}
	});
	const run = new VectorRun(
		EngineGameStateV16Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'aftermath-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-03'
	});
	run.commit(masterId, 'aftermath-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'aftermath-cut-stair',
		'mission.move.threshold-to-cut-stair',
		heroId,
		'mission.move.threshold-to-cut-stair'
	);
	missionTurn(
		run,
		'aftermath-red-gallery',
		'mission.move.cut-stair-to-red-gallery',
		heroId,
		'mission.move.cut-stair-to-red-gallery'
	);
	missionTurn(
		run,
		'aftermath-tithe-pit',
		'mission.move.red-gallery-to-tithe-pit',
		heroId,
		'mission.move.red-gallery-to-tithe-pit'
	);
	missionTurn(
		run,
		'aftermath-split-party',
		'mission.move.red-gallery-to-tithe-pit',
		heroId,
		'mission.hold'
	);
	for (let round = 5; round <= 12; round += 1) {
		const action = legalActions(run.state, heroId).find(
			(candidate) =>
				candidate.actionId.startsWith('mission.inspect.') ||
				candidate.actionId.startsWith('mission.attack.')
		);
		if (!action) throw new Error('Expected a pressure action');
		missionTurn(run, `aftermath-pressure-${round}`, 'mission.hold', heroId, action.actionId);
		if (
			(run.state as ReturnType<typeof EngineGameStateV16Schema.parse>).mission.aftermath
				.consequences.length > 0
		)
			break;
	}
	return finishVector(
		'v16-persistent-mission-aftermath',
		16,
		run,
		EXPECTATIONS['v16-persistent-mission-aftermath']
	);
}

function v17MasterPermadeathVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('mission-master-death-run');
	const heroId = deterministicUuid('mission-master-death-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'mission-master-death-seed',
		heroId,
		manifestHash: sha256Hex('mission-master-death-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-03',
			availableMissionIds: ['tower-floor-03'],
			enableMasterPermadeath: true
		}
	});
	const run = new VectorRun(
		EngineGameStateV17Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'master-death-direction', {
		commandType: 'master.issue.directive',
		text: 'Stay with me and guard the living.',
		scope: 'mission',
		recipientIds: [heroId],
		priorities: ['guard'],
		tone: 'urgent',
		delivery: 'private'
	});
	run.commit(masterId, 'master-death-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-03'
	});
	run.commit(masterId, 'master-death-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'master-death-cut-stair',
		'mission.move.threshold-to-cut-stair',
		heroId,
		'mission.move.threshold-to-cut-stair'
	);
	missionTurn(
		run,
		'master-death-red-gallery',
		'mission.move.cut-stair-to-red-gallery',
		heroId,
		'mission.move.cut-stair-to-red-gallery'
	);
	missionTurn(
		run,
		'master-death-tithe-pit',
		'mission.move.red-gallery-to-tithe-pit',
		heroId,
		'mission.move.red-gallery-to-tithe-pit'
	);
	missionTurn(
		run,
		'master-death-return-red-gallery',
		'mission.move.red-gallery-to-tithe-pit',
		heroId,
		'mission.move.red-gallery-to-tithe-pit'
	);
	for (let round = 5; round <= 10 && run.state.status === 'active'; round += 1) {
		missionTurn(run, `master-death-hold-${round}`, 'mission.hold', heroId, 'mission.hold');
	}
	return finishVector('v17-master-permadeath', 17, run, EXPECTATIONS['v17-master-permadeath']);
}

function v18AttemptAftermathVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('attempt-aftermath-run');
	const heroId = deterministicUuid('attempt-aftermath-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'mission-aftermath-seed',
		heroId,
		manifestHash: sha256Hex('attempt-aftermath-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04', 'tower-floor-05'],
			enableAttemptAftermath: true
		}
	});
	const run = new VectorRun(
		EngineGameStateV18Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'attempt-one-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-04'
	});
	run.commit(masterId, 'attempt-one-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'attempt-one-balance',
		'mission.move.threshold-to-balance-hall',
		heroId,
		'mission.move.threshold-to-balance-hall'
	);
	missionTurn(
		run,
		'attempt-one-left-relay',
		'mission.move.balance-hall-to-left-relay',
		heroId,
		'mission.move.balance-hall-to-left-relay'
	);
	missionTurn(
		run,
		'attempt-one-open-archive',
		'mission.hold',
		heroId,
		'mission.inspect.open-archive-niche'
	);
	missionTurn(
		run,
		'attempt-one-enter-archive',
		'mission.move.left-relay-to-archive-niche',
		heroId,
		'mission.move.left-relay-to-archive-niche'
	);
	missionTurn(
		run,
		'attempt-one-read-schematic',
		'mission.hold',
		heroId,
		'mission.inspect.read-foundry-schematic'
	);
	missionTurn(
		run,
		'attempt-one-leave-archive',
		'mission.move.left-relay-to-archive-niche',
		heroId,
		'mission.move.left-relay-to-archive-niche'
	);
	missionTurn(
		run,
		'attempt-one-return-balance',
		'mission.move.balance-hall-to-left-relay',
		heroId,
		'mission.move.balance-hall-to-left-relay'
	);
	missionTurn(
		run,
		'attempt-one-return-threshold',
		'mission.move.threshold-to-balance-hall',
		heroId,
		'mission.move.threshold-to-balance-hall'
	);
	run.commit(masterId, 'attempt-one-retreat', { commandType: 'mission.retreat' });
	run.commit(masterId, 'attempt-two-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-05'
	});
	return finishVector(
		'v18-attempt-aftermath-archive',
		18,
		run,
		EXPECTATIONS['v18-attempt-aftermath-archive']
	);
}

function v19MasterTimingVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('master-timing-run');
	const heroId = deterministicUuid('master-timing-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'master-timing-seed',
		heroId,
		manifestHash: sha256Hex('master-timing-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableMasterTiming: true
		}
	});
	const run = new VectorRun(
		EngineGameStateV19Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'timing-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	run.commit(masterId, 'timing-deploy', { commandType: 'mission.deploy' });
	run.commit(masterId, 'timing-step', {
		commandType: 'master.configure.timing',
		timing: 'step',
		countdownSeconds: 5,
		observedAt: '2030-01-01T00:00:11.000Z'
	});
	run.commit(masterId, 'timing-open-step', {
		commandType: 'master.open.decision',
		observedAt: '2030-01-01T00:00:11.000Z'
	});
	const state = EngineGameStateV19Schema.parse(run.state);
	const decision = state.masterControl.activeDecision!;
	const timedChoice: MissionTurnChoice = {
		actorId: masterId,
		actionId: 'mission.hold',
		source: 'scripted',
		policyId: 'master-timing-baseline-v1',
		packetHash: sha256Hex(`${state.version}:master:packet`),
		legalActionHash: sha256Hex(`${state.version}:master:legal`),
		policyResultHash: sha256Hex(`${state.version}:master:result`),
		publicIntent: 'The deterministic timing baseline chose to hold position.'
	};
	run.commit(
		masterId,
		'timing-step-once',
		{
			commandType: 'mission.resolve.turn',
			decisionId: decision.decisionId,
			resolvedAt: '2030-01-01T00:00:11.000Z',
			choices: [timedChoice, scriptedChoice(heroId, 'mission.hold')]
		},
		{
			source: 'step',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		}
	);
	return finishVector('v19-master-timing-turn', 19, run, EXPECTATIONS['v19-master-timing-turn']);
}

function v20MasterFallbackVector(): EngineReplayVectorCase {
	const runId = deterministicUuid('master-fallback-run');
	const heroId = deterministicUuid('master-fallback-hero');
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'master-fallback-seed',
		heroId,
		manifestHash: sha256Hex('master-fallback-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableMasterFallback: true
		}
	});
	const run = new VectorRun(
		EngineGameStateV20Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'fallback-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	run.commit(masterId, 'fallback-deploy', { commandType: 'mission.deploy' });
	run.commit(masterId, 'fallback-health-config', {
		commandType: 'master.configure.fallback',
		policy: 'directed',
		directionText: 'Advance the objective while protecting the company.',
		priorities: ['focus-objective', 'protect-self', 'protect-party'],
		protectedHeroId: null,
		safetyStops: {
			beforeIrreversibleAction: false,
			masterHealthThreshold: 100,
			whenUnclassified: false,
			maximumConsecutiveFallbacks: null
		},
		observedAt: '2030-01-01T00:00:00.000Z'
	});
	run.commit(masterId, 'fallback-health-timing', {
		commandType: 'master.configure.timing',
		timing: 'continuous',
		countdownSeconds: 5,
		observedAt: '2030-01-01T00:00:01.000Z'
	});
	run.commit(masterId, 'fallback-health-open', {
		commandType: 'master.open.decision',
		observedAt: '2030-01-01T00:00:02.000Z'
	});
	const state = EngineGameStateV20Schema.parse(run.state);
	run.commit(
		masterId,
		'fallback-health-stop',
		{
			commandType: 'master.apply.safety-stop',
			decisionId: state.masterControl.activeDecision!.decisionId,
			observedAt: '2030-01-01T00:00:03.000Z'
		},
		masterFallbackSafetySource(state)
	);
	return finishVector(
		'v20-master-fallback-safety-stop',
		20,
		run,
		EXPECTATIONS['v20-master-fallback-safety-stop']
	);
}

function v21StoryPatchVector(): EngineReplayVectorCase {
	const runId = '15500000-0000-4000-8000-000000000001';
	const heroId = '15500000-0000-4000-8000-000000000002';
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'runtime-story-patch-evidence',
		heroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04'],
			enableStoryPatch: true,
			foundryRouteMemoryHeroId: heroId,
			additionalHeroes: [
				{ heroId: '15500000-0000-4000-8000-000000000003', manifestHash: '2'.repeat(64) }
			]
		}
	});
	const run = new VectorRun(
		EngineGameStateV21Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const state = EngineGameStateV21Schema.parse(run.state);
	const slot = TOWER_BAND_01_STORY_ENVELOPE.patchSlots.find((entry) => entry.floor === 4)!;
	const proposalId = slot.allowedProposalIds.find(
		(id) =>
			TOWER_BAND_01_STORY_ENVELOPE.proposals.find((proposal) => proposal.proposalId === id)
				?.kind === 'role-expression'
	)!;
	const candidate = StoryPatchCandidateSchema.parse({
		patchVersion: 'story-patch-v1',
		patchId: '15500000-0000-4000-8000-000000000004',
		envelopeId: state.bandStory.envelopeId,
		envelopeContentHash: state.bandStory.envelopeContentHash,
		baseHistoryHash: hashCanonical(state.bandStory.history),
		slotId: slot.slotId,
		selectedProposalIds: [proposalId],
		roleBindings: [{ proposalId, heroId }],
		publicIntent: 'Let the route holder carry the optional discovery into the confrontation.'
	});
	if (storyPatchCastForState(state).length !== 2)
		throw new Error('Expected two story cast members');
	run.commit(
		state.master.masterId,
		'v21-story-patch',
		{ commandType: 'story.apply.patch', candidate },
		scriptedSource()
	);
	return finishVector('v21-story-patch', 21, run, EXPECTATIONS['v21-story-patch']);
}

function v22SynthesisVector(): EngineReplayVectorCase {
	const runId = '27000000-0000-4000-8000-000000000001';
	const sourceHeroId = '27000000-0000-4000-8000-000000000002';
	const recipientHeroId = '27000000-0000-4000-8000-000000000003';
	const witnessHeroId = '27000000-0000-4000-8000-000000000004';
	const listenerHeroId = '27000000-0000-4000-8000-000000000005';
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'phase-7-synthesis-evidence',
		heroId: sourceHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableSynthesis: true,
			additionalHeroes: [
				{ heroId: recipientHeroId, manifestHash: '2'.repeat(64) },
				{ heroId: witnessHeroId, manifestHash: '3'.repeat(64) },
				{ heroId: listenerHeroId, manifestHash: '4'.repeat(64) }
			]
		}
	});
	const run = new VectorRun(
		EngineGameStateV22Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	run.commit(
		run.state.master.masterId,
		'v22-synthesize',
		{
			commandType: 'settlement.synthesize.hero',
			sourceHeroId,
			recipientHeroId,
			visibility: 'private',
			warningVersion: 'synthesis-warning-v1',
			confirmedIrreversible: true,
			rationale: 'Prepare the company for the next tower threshold.'
		},
		{ ...manualSource(), timing: null }
	);
	const state = EngineGameStateV22Schema.parse(run.state);
	const receiptId = Object.values(state.synthesis.receipts)[0]!.receiptId;
	run.commit(
		recipientHeroId,
		'v22-share-rumor',
		{
			commandType: 'hero.share.synthesis.rumor',
			receiptId,
			targetHeroId: listenerHeroId
		},
		{ ...scriptedSource(), timing: null }
	);
	return finishVector('v22-synthesis-and-rumor', 22, run, EXPECTATIONS['v22-synthesis-and-rumor']);
}

function v23FirstBandArchiveVector(): EngineReplayVectorCase {
	const seed = 'archive-smoke';
	const runId = deterministicUuid(`mis-010:full-quench:${seed}:run`);
	const primaryHeroId = deterministicUuid(`mis-010:full-quench:${seed}:hero`);
	const heroIds = [
		primaryHeroId,
		...Array.from({ length: 3 }, (_, index) =>
			deterministicUuid(`mis-010:full-quench:${seed}:hero:${index + 2}`)
		)
	];
	const trialMind = CharacterMindSchema.parse({
		personality: {
			openness: 62,
			conscientiousness: 88,
			extraversion: 34,
			agreeableness: 57,
			emotionalVolatility: 29
		},
		primaryValue: 'mastery',
		primaryDrive: 'protect',
		socialStyle: 'reserved',
		stressResponse: 'prepare',
		dailyHabit: 'stretches-at-dawn',
		aptitudes: { might: 10, finesse: 10, insight: 7, resolve: 10 }
	});
	const bootstrap = createBootstrapEngine({
		runId,
		seed: `mis-010:full-quench:${seed}`,
		heroId: primaryHeroId,
		manifestHash: sha256Hex('mis-010:full-quench:manifest'),
		rarityStars: 7,
		mind: trialMind,
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-05',
			availableMissionIds: ['tower-floor-05'],
			enableFirstBandArchive: true,
			foundryRouteMemoryHeroId: primaryHeroId,
			additionalHeroes: heroIds.slice(1).map((heroId, index) => ({
				heroId,
				manifestHash: sha256Hex(`mis-010:full-quench:manifest:${index + 2}`),
				rarityStars: 7,
				mind: trialMind
			}))
		}
	});
	const run = new VectorRun(
		EngineGameStateV23Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	const roundParty = (
		key: string,
		masterActionId: string,
		heroActionIds: Readonly<Record<string, string>>
	) =>
		run.commit(masterId, key, {
			commandType: 'mission.resolve.turn',
			choices: [
				manualChoice(masterId, masterActionId),
				...heroIds.map((heroId) => scriptedChoice(heroId, heroActionIds[heroId]!))
			]
		});

	run.commit(masterId, 'prepare-tower-floor-05', {
		commandType: 'mission.prepare',
		heroIds,
		missionId: 'tower-floor-05'
	});
	run.commit(masterId, 'deploy-tower-floor-05', { commandType: 'mission.deploy' });
	roundParty(
		'Cross the threshold',
		'mission.move.threshold-to-ash-intake',
		Object.fromEntries(heroIds.map((heroId) => [heroId, 'mission.move.threshold-to-ash-intake']))
	);
	roundParty(
		'Trust the remembered seam',
		'mission.move.ash-intake-to-forge-nave',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === primaryHeroId
					? 'mission.inspect.recall-maintenance-seam'
					: 'mission.move.ash-intake-to-forge-nave'
			])
		)
	);
	let state = EngineGameStateV23Schema.parse(run.state);
	const watchers = Object.values(state.mission.attempt!.turnState.monsters)
		.filter((monster) => monster.dutySlotId === 'forge-nave-watch' && monster.status === 'active')
		.sort((left, right) => left.monsterId.localeCompare(right.monsterId));
	let watcherIndex = 0;
	roundParty(
		'Split at the furnace',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => {
				if (heroId === primaryHeroId)
					return [heroId, 'mission.move.ash-intake-to-maintenance-seam'];
				const watcher = watchers[watcherIndex++];
				return [heroId, watcher ? `mission.attack.${watcher.monsterId}` : 'mission.hold'];
			})
		)
	);
	roundParty(
		'Reach the cooling control',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === primaryHeroId
					? 'mission.move.maintenance-seam-to-cooling-control'
					: 'mission.hold'
			])
		)
	);
	roundParty(
		'Read the wheel stages',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === primaryHeroId ? 'mission.inspect.test-cooling-wheel' : 'mission.hold'
			])
		)
	);
	roundParty(
		'Open the cooling circuit',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === primaryHeroId ? 'mission.control.cooling-wheel' : 'mission.hold'
			])
		)
	);
	roundParty(
		'Release the exposed wheel operator',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === primaryHeroId
					? 'mission.move.cooling-control-to-furnace-heart'
					: 'mission.move.forge-nave-to-furnace-heart'
			])
		)
	);
	const reliefId = heroIds.find((heroId) => heroId !== primaryHeroId)!;
	roundParty(
		'Post a fresh operator',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === reliefId
					? 'mission.move.cooling-control-to-furnace-heart'
					: heroId === primaryHeroId
						? 'mission.move.forge-nave-to-furnace-heart'
						: 'mission.hold'
			])
		)
	);
	roundParty(
		'Quench the furnace',
		'mission.hold',
		Object.fromEntries(
			heroIds.map((heroId) => [
				heroId,
				heroId === reliefId ? 'mission.control.cooling-wheel' : 'mission.hold'
			])
		)
	);

	for (let safety = 1; safety <= 24; safety += 1) {
		state = EngineGameStateV23Schema.parse(run.state);
		const turn = state.mission.attempt!.turnState;
		const warden = Object.values(turn.monsters).find(
			(monster) => monster.dutySlotId === 'foundry-warden'
		)!;
		if (warden.status === 'defeated') break;
		const positions = state.mission.attempt!.positions;
		const targetId = turn.currentThreatIntents.find(
			(intent) => intent.monsterId === warden.monsterId
		)?.targetId;
		const controlHeroes = heroIds.filter((heroId) => positions[heroId] === 'cooling-control');
		const targetHeroId = targetId && controlHeroes.includes(targetId) ? targetId : null;
		const targetGuard = targetHeroId ? turn.partyGuard[targetHeroId]!.guard : null;
		const shouldRotateTarget =
			targetHeroId !== null && (state.heroes[targetHeroId]!.health <= 50 || targetGuard === 0);
		const availableSlots = 2 - controlHeroes.length + (shouldRotateTarget ? 1 : 0);
		const entrants = heroIds
			.filter((heroId) => positions[heroId] === 'furnace-heart')
			.filter((heroId) => heroId !== targetHeroId)
			.slice(0, Math.max(0, availableSlots));
		roundParty(
			`Hold and strike at the cooling control · ${safety}`,
			'mission.hold',
			Object.fromEntries(
				heroIds.map((heroId) => {
					if (heroId === targetHeroId)
						return [
							heroId,
							shouldRotateTarget ? 'mission.move.cooling-control-to-furnace-heart' : 'mission.hold'
						];
					if (controlHeroes.includes(heroId)) return [heroId, `mission.attack.${warden.monsterId}`];
					if (entrants.includes(heroId))
						return [heroId, 'mission.move.cooling-control-to-furnace-heart'];
					return [heroId, 'mission.hold'];
				})
			)
		);
		if (safety === 24) throw new Error('The archive vector could not defeat the Warden');
	}

	const returnAction = (nodeId: string): string =>
		({
			'cooling-control': 'mission.move.cooling-control-to-furnace-heart',
			'furnace-heart': 'mission.move.forge-nave-to-furnace-heart',
			'forge-nave': 'mission.move.ash-intake-to-forge-nave',
			'ash-intake': 'mission.move.threshold-to-ash-intake',
			'tower-threshold': 'mission.hold'
		})[nodeId] ?? 'mission.hold';
	for (let returnRound = 1; returnRound <= 6; returnRound += 1) {
		state = EngineGameStateV23Schema.parse(run.state);
		if (
			state.mission.attempt!.party.memberIds.every(
				(actorId) => state.mission.attempt!.positions[actorId] === 'tower-threshold'
			)
		)
			break;
		const positions = state.mission.attempt!.positions;
		roundParty(
			`Return formation · ${returnRound}`,
			returnAction(positions[masterId]!),
			Object.fromEntries(heroIds.map((heroId) => [heroId, returnAction(positions[heroId]!)]))
		);
	}
	run.commit(masterId, 'extract-living-foundry', { commandType: 'mission.extract' });
	run.commit(masterId, 'reveal-first-band-archive', {
		commandType: 'story.reveal.first.archive',
		readerHeroId: primaryHeroId
	});
	return finishVector('v23-first-band-archive', 23, run, EXPECTATIONS['v23-first-band-archive']);
}

function v24EquipmentStateVector(): EngineReplayVectorCase {
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('replay-vector-v24-run'),
		seed: 'replay-vector-v24-seed',
		heroId: deterministicUuid('replay-vector-v24-hero'),
		manifestHash: sha256Hex('replay-vector-v24-manifest'),
		developmentEquipmentScenario: { enabled: true, materialLots: { bronze: 2, ash: 1 } }
	});
	const run = new VectorRun(
		EngineGameStateV24Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	run.commit(run.state.master.masterId, 'v24-inspect', { commandType: 'master.inspect.gate' });
	return finishVector('v24-equipment-state', 24, run, EXPECTATIONS['v24-equipment-state']);
}

function v24EquipmentMissionResolutionVector(): EngineReplayVectorCase {
	const heroId = deterministicUuid('replay-vector-v24-combat-hero');
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('replay-vector-v24-combat-run'),
		seed: 'replay-vector-v24-combat-seed',
		heroId,
		manifestHash: sha256Hex('replay-vector-v24-combat-manifest'),
		developmentEquipmentScenario: { enabled: true, materialLots: { bronze: 2, ash: 1 } }
	});
	const run = new VectorRun(
		EngineGameStateV24Schema.parse(bootstrap.snapshot.state),
		bootstrap.event
	);
	const masterId = run.state.master.masterId;
	run.commit(masterId, 'v24-combat-prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	run.commit(masterId, 'v24-combat-deploy', { commandType: 'mission.deploy' });
	missionTurn(
		run,
		'v24-combat-round-one',
		'mission.move.threshold-to-oath-hall',
		heroId,
		'mission.move.threshold-to-oath-hall'
	);
	missionTurn(run, 'v24-combat-round-two', 'mission.hold', heroId, 'mission.hold');
	return finishVector(
		'v24-equipment-mission-resolution',
		24,
		run,
		EXPECTATIONS['v24-equipment-mission-resolution']
	);
}

export const ENGINE_REPLAY_VECTOR_CASES = [
	v5RoutineAndActivityVector(),
	v8CommunicationVector(),
	v14MissionEvidenceVector(),
	v15IronMoonVector(),
	v16PersistentAftermathVector(),
	v17MasterPermadeathVector(),
	v18AttemptAftermathVector(),
	v19MasterTimingVector(),
	v20MasterFallbackVector(),
	v21StoryPatchVector(),
	v22SynthesisVector(),
	v23FirstBandArchiveVector(),
	v24EquipmentStateVector(),
	v24EquipmentMissionResolutionVector()
] as const;

// Replay vectors intentionally use the Master-scoped public legal-actions boundary because the
// current public signature requires an actor id.
export function actualMasterLegalActionIds(replayCase: EngineReplayVectorCase): readonly string[] {
	return legalActions(replayCase.finalState, replayCase.finalState.master.masterId).map(
		(action) => action.actionId
	);
}

const READINESS_REPLAY_IDS = {
	attempt: '76000000-0000-4000-8000-000000000001',
	batchOne: '76000000-0000-4000-8000-000000000002',
	batchTwo: '76000000-0000-4000-8000-000000000003',
	heroA: '76000000-0000-4000-8000-000000000004',
	heroB: '76000000-0000-4000-8000-000000000005',
	heroC: '76000000-0000-4000-8000-000000000006',
	monster: '76000000-0000-4000-8000-000000000007',
	monsterReserve: '76000000-0000-4000-8000-000000000008'
} as const;

const READINESS_REPLAY_FULL_REFUND = {
	invalidTarget: 'selected-fallback',
	occupiedDestination: 'selected-fallback',
	cancellationRefund: { mana: 'full', readiness: 'full' }
} as const;

const READINESS_REPLAY_CANCEL = {
	invalidTarget: 'cancel',
	occupiedDestination: 'cancel',
	cancellationRefund: { mana: 'none', readiness: 'none' }
} as const;

function readinessReplayNonDamagingProfile() {
	return {
		profileKind: 'non-damaging' as const,
		rulesVersion: 'combat-rules-v1' as const,
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	};
}

function readinessReplayAttack(
	actionId: string,
	targetId: string,
	input: {
		readonly priority: number;
		readonly accuracy: number;
		readonly criticalChance: number;
		readonly baseMagnitude: number;
		readonly conflictPolicy?: typeof READINESS_REPLAY_CANCEL | typeof READINESS_REPLAY_FULL_REFUND;
	}
): CombatLegalActionTemplate {
	return {
		actionId,
		actionKind: 'attack',
		skillId: 'combat-skill-basic-sword-strike',
		publicLabel: actionId,
		targetContract: { kind: 'entity', allowedCombatantIds: [targetId] },
		reactionPriority: input.priority,
		recoveryTicks: 1,
		manaCost: 0,
		conflictPolicy: input.conflictPolicy ?? READINESS_REPLAY_CANCEL,
		fallbackOptions: [
			{ fallbackId: 'cancel-if-invalid', publicLabel: 'Cancel', target: { kind: 'self' } }
		],
		resolutionProfile: {
			profileKind: 'attack',
			rulesVersion: 'combat-rules-v1',
			contentHash: COMBAT_CONTENT_BINDING.contentHash,
			deliveryTag: 'one-handed-blade',
			masteryStepMinimum: input.accuracy === 9_250 ? 100 : input.accuracy === 8_000 ? 50 : 0,
			skillAccuracyBasisPoints: input.accuracy,
			damage: {
				channel: 'physical',
				tags: ['physical', 'cut'],
				baseMagnitude: input.baseMagnitude,
				coefficientBasisPoints: 10_000,
				affinityContributionBasisPoints: 0,
				criticalChanceBasisPoints: input.criticalChance,
				criticalMultiplierBasisPoints: 15_000,
				penetration: 1_000_000,
				status: null
			}
		}
	};
}

function readinessReplayMove(
	actionId: string,
	priority: number,
	fallback: { readonly x: number; readonly y: number }
): CombatLegalActionTemplate {
	return {
		actionId,
		actionKind: 'move',
		skillId: null,
		publicLabel: actionId,
		targetContract: { kind: 'tile', allowedPositions: [{ x: 2, y: 1 }] },
		reactionPriority: priority,
		recoveryTicks: 1,
		manaCost: 0,
		conflictPolicy: READINESS_REPLAY_FULL_REFUND,
		fallbackOptions: [
			{
				fallbackId: 'alternate-tile',
				publicLabel: 'Alternate tile',
				target: { kind: 'tile', position: fallback }
			}
		],
		resolutionProfile: readinessReplayNonDamagingProfile()
	};
}

function readinessReplayGuard(): CombatLegalActionTemplate {
	return {
		actionId: 'replay-guard',
		actionKind: 'guard',
		skillId: null,
		publicLabel: 'Guard',
		targetContract: { kind: 'self' },
		reactionPriority: 0,
		recoveryTicks: 1,
		manaCost: 0,
		conflictPolicy: READINESS_REPLAY_FULL_REFUND,
		fallbackOptions: [{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' } }],
		resolutionProfile: readinessReplayNonDamagingProfile()
	};
}

function readinessReplayCombatant(
	combatantId: string,
	teamId: 'party' | 'enemy',
	position: { readonly x: number; readonly y: number },
	attributes: {
		readonly strength: number;
		readonly agility: number;
		readonly vitality: number;
		readonly magic: number;
	}
) {
	return {
		combatantId,
		combatantKind: teamId === 'party' ? ('hero' as const) : ('monster' as const),
		teamId,
		position,
		facing: teamId === 'party' ? ('east' as const) : ('west' as const),
		resources: { health: { current: 100, maximum: 100 }, mana: { current: 20, maximum: 20 } },
		lastDamagedAtTick: null,
		attributes,
		armor: 0,
		resistances: {},
		readiness: { value: 10_000, exactNumerator: 10_000, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function readinessReplayInitialState(): ReadinessCombatStateV1 {
	const ids = READINESS_REPLAY_IDS;
	const combatants = {
		[ids.heroA]: readinessReplayCombatant(
			ids.heroA,
			'party',
			{ x: 0, y: 1 },
			{ strength: 1, agility: 100, vitality: 20, magic: 20 }
		),
		[ids.heroB]: readinessReplayCombatant(
			ids.heroB,
			'party',
			{ x: 4, y: 1 },
			{ strength: 100, agility: 100, vitality: 20, magic: 20 }
		),
		[ids.heroC]: readinessReplayCombatant(
			ids.heroC,
			'party',
			{ x: 0, y: 2 },
			{ strength: 20, agility: 100, vitality: 20, magic: 20 }
		),
		[ids.monster]: {
			...readinessReplayCombatant(
				ids.monster,
				'enemy',
				{ x: 4, y: 2 },
				{ strength: 100, agility: 100, vitality: 20, magic: 20 }
			),
			conditions: [
				{
					conditionId: 'unaware',
					stacks: 1,
					appliedAtTick: 0,
					expiresAtTick: null,
					sourceCombatantId: null
				}
			]
		},
		[ids.monsterReserve]: readinessReplayCombatant(
			ids.monsterReserve,
			'enemy',
			{ x: 4, y: 0 },
			{ strength: 20, agility: 100, vitality: 20, magic: 20 }
		)
	};
	const actionTemplates: Readonly<Record<string, readonly CombatLegalActionTemplate[]>> = {
		[ids.heroA]: [
			readinessReplayMove('replay-move-a', 3, { x: 2, y: 0 }),
			readinessReplayAttack('replay-critical', ids.monster, {
				priority: 3,
				accuracy: 9_250,
				criticalChance: 10_000,
				baseMagnitude: 10
			}),
			readinessReplayGuard()
		],
		[ids.heroB]: [
			readinessReplayMove('replay-move-b', 2, { x: 2, y: 2 }),
			readinessReplayAttack('replay-lethal', ids.monster, {
				priority: 1,
				accuracy: 9_250,
				criticalChance: 0,
				baseMagnitude: 1_000
			}),
			readinessReplayGuard()
		],
		[ids.heroC]: [
			readinessReplayGuard(),
			readinessReplayAttack('replay-cancel', ids.monster, {
				priority: 0,
				accuracy: 9_250,
				criticalChance: 0,
				baseMagnitude: 10
			})
		],
		[ids.monster]: [
			readinessReplayAttack('replay-miss', ids.heroA, {
				priority: 0,
				accuracy: 6_750,
				criticalChance: 0,
				baseMagnitude: 1
			}),
			readinessReplayAttack('replay-down-hero', ids.heroA, {
				priority: 2,
				accuracy: 9_250,
				criticalChance: 0,
				baseMagnitude: 1_000
			}),
			readinessReplayGuard()
		],
		[ids.monsterReserve]: [
			{
				...readinessReplayGuard(),
				actionId: 'replay-reserve-guard',
				publicLabel: 'Reserve guard'
			}
		]
	};
	const visibleIds = Object.keys(combatants).sort();
	const targetablePositions = Array.from({ length: 15 }, (_unused, index) => ({
		x: index % 5,
		y: Math.floor(index / 5)
	}));
	const partyHeroes = Object.fromEntries(
		[ids.heroA, ids.heroB, ids.heroC].map((heroId) => [
			heroId,
			{
				startingHealth: 100,
				startingMana: 20,
				currentHealth: 100,
				currentMana: 20,
				damageTaken: 0,
				downed: false
			}
		])
	);
	return ReadinessCombatStateV1Schema.parse({
		stateVersion: 'readiness-combat-state-v1',
		seed: sha256Hex('v26-agent-readiness-recorded-batches-seed-5'),
		attemptId: ids.attempt,
		tick: 0,
		combatants,
		actorContexts: Object.fromEntries(
			visibleIds.map((actorId) => [
				actorId,
				{
					actorId,
					visibleCombatantIds: visibleIds.filter((id) => id !== actorId),
					visibleTelegraphIds: [],
					observableReadinessActorIds: [],
					targetablePositions,
					visibleTerrainFeatureIds: [],
					rememberedContext: [],
					doctrine: [],
					relationships: [],
					masterDirections: [],
					legalActionTemplates: actionTemplates[actorId]
				}
			])
		),
		terrain: { width: 5, height: 3, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 0, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: {
			evidenceVersion: 'readiness-outcome-evidence-v1',
			attemptId: ids.attempt,
			partyHeroes,
			resolvedEvents: [],
			emittedEventIds: [],
			eventsEmitted: 0,
			engineRecoveredCombatantIds: [],
			securedLoot: [],
			objectiveStates: [],
			terminalDirective: null,
			authoredDeadline: null
		},
		status: 'active',
		result: null
	});
}

function readinessReplayBatch(
	state: ReadinessCombatStateV1,
	batchId: string,
	selections: Readonly<
		Record<
			string,
			Readonly<{
				actionId: string;
				target: CombatActionIntent['target'];
				fallbackId: string | null;
			}>
		>
	>
): CombatChoiceBatchV1 {
	const advanced = advanceUntilDecision(state, COMBAT_RULES_V1);
	if (advanced.kind !== 'decision-window') throw new Error('Readiness replay expected a window');
	const choices = advanced.views.map((view): CombatActionIntent => {
		const selection = selections[view.actorId];
		if (!selection) throw new Error(`Readiness replay lacks a selection for ${view.actorId}`);
		const action = view.legalActions.find((candidate) => candidate.actionId === selection.actionId);
		if (!action) throw new Error(`Readiness replay action ${selection.actionId} is not legal`);
		return {
			windowId: advanced.snapshot.windowId,
			attemptId: advanced.snapshot.attemptId,
			tick: advanced.snapshot.tick,
			actorId: view.actorId,
			snapshotHash: advanced.snapshot.snapshotHash,
			actorViewHash: view.actorViewHash,
			legalActionSetHash: view.legalActionSetHash,
			actionId: action.actionId,
			actionInstanceId: action.actionInstanceId,
			actionKind: action.actionKind,
			skillId: action.skillId,
			target: selection.target,
			fallbackId: selection.fallbackId
		};
	});
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId,
		windowId: advanced.snapshot.windowId,
		attemptId: advanced.snapshot.attemptId,
		tick: advanced.snapshot.tick,
		snapshotHash: advanced.snapshot.snapshotHash,
		choices
	};
	return { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) };
}

function buildAgentReadinessReplayVectorV26() {
	const ids = READINESS_REPLAY_IDS;
	const initialState = readinessReplayInitialState();
	const batchOne = readinessReplayBatch(initialState, ids.batchOne, {
		[ids.heroA]: {
			actionId: 'replay-move-a',
			target: { kind: 'tile', position: { x: 2, y: 1 } },
			fallbackId: 'alternate-tile'
		},
		[ids.heroB]: {
			actionId: 'replay-move-b',
			target: { kind: 'tile', position: { x: 2, y: 1 } },
			fallbackId: 'alternate-tile'
		},
		[ids.heroC]: { actionId: 'replay-guard', target: { kind: 'self' }, fallbackId: 'brace' },
		[ids.monster]: {
			actionId: 'replay-miss',
			target: { kind: 'entity', combatantId: ids.heroA },
			fallbackId: 'cancel-if-invalid'
		},
		[ids.monsterReserve]: {
			actionId: 'replay-reserve-guard',
			target: { kind: 'self' },
			fallbackId: 'brace'
		}
	});
	const afterOne = applyCombatChoiceBatch(initialState, batchOne, COMBAT_RULES_V1).state;
	const batchTwo = readinessReplayBatch(afterOne, ids.batchTwo, {
		[ids.heroA]: {
			actionId: 'replay-critical',
			target: { kind: 'entity', combatantId: ids.monster },
			fallbackId: 'cancel-if-invalid'
		},
		[ids.heroB]: {
			actionId: 'replay-lethal',
			target: { kind: 'entity', combatantId: ids.monster },
			fallbackId: 'cancel-if-invalid'
		},
		[ids.heroC]: {
			actionId: 'replay-cancel',
			target: { kind: 'entity', combatantId: ids.monster },
			fallbackId: 'cancel-if-invalid'
		},
		[ids.monster]: {
			actionId: 'replay-down-hero',
			target: { kind: 'entity', combatantId: ids.heroA },
			fallbackId: 'cancel-if-invalid'
		},
		[ids.monsterReserve]: {
			actionId: 'replay-reserve-guard',
			target: { kind: 'self' },
			fallbackId: 'brace'
		}
	});
	const afterTwo = applyCombatChoiceBatch(afterOne, batchTwo, COMBAT_RULES_V1).state;
	const terminalDirective = readinessTerminalDirective({
		state: afterTwo,
		kind: 'extraction',
		engineRecoveredCombatantIds: [ids.heroA]
	});
	return {
		id: 'v26-agent-readiness-recorded-batches' as const,
		schemaVersion: 26 as const,
		providerCalls: 0 as const,
		initialState,
		recordedBatches: [batchOne, batchTwo] as const,
		terminalDirective
	};
}

export const AGENT_READINESS_REPLAY_VECTOR_V26 = buildAgentReadinessReplayVectorV26();

export function replayAgentReadinessVectorV26(): Readonly<{
	cohortSizes: readonly number[];
	windowTicks: readonly number[];
	windowHashes: readonly string[];
	batchHashes: readonly string[];
	resolvedEventHashes: readonly string[];
	stateHashes: readonly string[];
	events: readonly CombatResolvedEvent[];
	result: CombatResult;
}> {
	let state = ReadinessCombatStateV1Schema.parse(
		structuredClone(AGENT_READINESS_REPLAY_VECTOR_V26.initialState)
	);
	const stateHashes = [hashCanonical(state)];
	const cohortSizes: number[] = [];
	const windowTicks: number[] = [];
	const windowHashes: string[] = [];
	const batchHashes: string[] = [];
	const resolvedEventHashes: string[] = [];
	const events: CombatResolvedEvent[] = [];
	for (const batch of AGENT_READINESS_REPLAY_VECTOR_V26.recordedBatches) {
		const window = advanceUntilDecision(state, COMBAT_RULES_V1);
		if (window.kind !== 'decision-window')
			throw new Error('Readiness replay ended before its batch');
		cohortSizes.push(window.views.length);
		windowTicks.push(window.snapshot.tick);
		windowHashes.push(window.snapshot.snapshotHash);
		if (window.snapshot.snapshotHash !== batch.snapshotHash) {
			throw new Error('Recorded readiness batch no longer binds its replay window');
		}
		const resolution = applyCombatChoiceBatch(state, batch, COMBAT_RULES_V1);
		state = resolution.state;
		batchHashes.push(batch.batchHash);
		resolvedEventHashes.push(hashCanonical(resolution.events));
		events.push(...resolution.events);
		stateHashes.push(hashCanonical(state));
	}
	state = authorizeReadinessTerminalDirective({
		state,
		directive: AGENT_READINESS_REPLAY_VECTOR_V26.terminalDirective
	});
	const terminal = advanceUntilDecision(state, COMBAT_RULES_V1);
	if (terminal.kind !== 'combat-result') {
		throw new Error('Readiness replay terminal directive did not produce a result');
	}
	state = ReadinessCombatStateV1Schema.parse({
		...state,
		status: 'complete',
		result: terminal.result
	});
	stateHashes.push(hashCanonical(state));
	if (state.status !== 'complete' || state.result === null) {
		throw new Error('Readiness replay did not produce its terminal common result');
	}
	return {
		cohortSizes,
		windowTicks,
		windowHashes,
		batchHashes,
		resolvedEventHashes,
		stateHashes,
		events,
		result: state.result
	};
}
