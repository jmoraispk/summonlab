import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const EQUIPMENT_V3_PRODUCTION_ID = 'material-equipment-v3' as const;
export const EQUIPMENT_V3_ROOT =
	`assets/equipment/experiments/${EQUIPMENT_V3_PRODUCTION_ID}` as const;
export const EQUIPMENT_V3_MANIFEST_PATH = `${EQUIPMENT_V3_ROOT}/manifest.json` as const;
export const EQUIPMENT_V3_ALLOCATION_PATH = `${EQUIPMENT_V3_ROOT}/allocation-plan.json` as const;
export const EQUIPMENT_V3_DIRECTION_MANIFEST_PATH =
	`${EQUIPMENT_V3_ROOT}/direction/class-progressions/manifest.json` as const;

export const EQUIPMENT_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export const EQUIPMENT_ARMOR_SLOTS = ['head', 'torso', 'legs', 'boots'] as const;
export const EQUIPMENT_CLASSES = [
	'sword',
	'dagger',
	'spear',
	'axe',
	'mace',
	'shield',
	'bow',
	'staff',
	'heavy-armor',
	'light-armor',
	'robes'
] as const;

export type EquipmentRank = (typeof EQUIPMENT_RANKS)[number];
export type EquipmentArmorSlot = (typeof EQUIPMENT_ARMOR_SLOTS)[number];
export type EquipmentClass = (typeof EQUIPMENT_CLASSES)[number];
export type EquipmentMaterialFamily = 'metal' | 'wood' | 'hide-scale' | 'cloth-fiber';

export interface EquipmentMaterialBriefV3 {
	readonly materialId: string;
	readonly displayName: string;
	readonly family: EquipmentMaterialFamily;
	readonly rank: EquipmentRank;
	readonly briefPath: string;
	readonly palette: string;
	readonly valueRange: string;
	readonly surfaceAndWear: string;
	readonly constructionVocabulary: string;
	readonly supernaturalBehavior: string;
	readonly neutralSecondaryMaterials: string;
	readonly neighborDifference: string;
}

interface MaterialBriefInput extends Omit<EquipmentMaterialBriefV3, 'briefPath'> {}

function material(input: MaterialBriefInput): EquipmentMaterialBriefV3 {
	return {
		...input,
		briefPath: `${EQUIPMENT_V3_ROOT}/direction/material-briefs/${input.rank.toLowerCase()}-${input.materialId}.json`
	};
}

export const EQUIPMENT_MATERIAL_BRIEFS_V3 = [
	material({
		materialId: 'bronze',
		displayName: 'Bronze',
		family: 'metal',
		rank: 'F',
		palette: 'Warm ocher-brown metal with muted gold edges and dark umber recesses.',
		valueRange: 'Middle-dark overall; restrained highlights, no mirror polish.',
		surfaceAndWear:
			'Cast grain, rubbed edges, shallow dents, and small green-brown oxidation traces.',
		constructionVocabulary:
			'Simple cast or hammered plates, broad rivets, plain sockets, thick practical sections.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials:
			'Dark brown wood, plain leather, charcoal cloth, and dull iron only.',
		neighborDifference:
			'Warmer, rougher, and more plainly cast than Iron; never reads as polished gold.'
	}),
	material({
		materialId: 'ash',
		displayName: 'Ash',
		family: 'wood',
		rank: 'F',
		palette: 'Pale tan sapwood with quiet cream grain and gray-brown end grain.',
		valueRange: 'Light middle values with modest contrast.',
		surfaceAndWear: 'Open straight grain, hand-smoothed facets, small nicks, and dry rubbed edges.',
		constructionVocabulary:
			'Plain carved limbs and shafts, wrapped grips, simple pegs, minimal fittings.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Hemp cord, dark leather, dull bronze, and undyed cloth.',
		neighborDifference:
			'Paler, simpler, and less elastic-looking than Yew; unmistakably real common wood.'
	}),
	material({
		materialId: 'coarse-hide',
		displayName: 'Coarse Hide',
		family: 'hide-scale',
		rank: 'F',
		palette: 'Earth brown, dusty tan, and soot-dark seams.',
		valueRange: 'Middle-dark with broad matte shapes.',
		surfaceAndWear:
			'Uneven thickness, visible pores, raw edges, creases, scuffs, and patched abrasions.',
		constructionVocabulary:
			'Large overlapping hide panels, simple ties, crude stitching, and few hard fittings.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Hemp thread, plain wood toggles, dull bronze, and undyed lining.',
		neighborDifference:
			'Softer, rougher, and less formed than Hard Leather; no polished rigid cuirass shapes.'
	}),
	material({
		materialId: 'hemp-weave',
		displayName: 'Hemp Weave',
		family: 'cloth-fiber',
		rank: 'F',
		palette: 'Natural flax beige, oatmeal, and weathered gray-brown.',
		valueRange: 'Light-middle matte values with low contrast.',
		surfaceAndWear:
			'Coarse visible weave, softened creases, frayed edges, repairs, and uneven dye.',
		constructionVocabulary:
			'Simple rectangular panels, practical hems, cord belts, broad sleeves, minimal layers.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Hemp cord, plain leather, wood toggles, and dull bronze.',
		neighborDifference:
			'Coarser, lighter, and less insulating than Wool; deliberately humble rather than ragged.'
	}),
	material({
		materialId: 'iron',
		displayName: 'Iron',
		family: 'metal',
		rank: 'E',
		palette: 'Cool charcoal-gray metal with pale gray edges and near-black recesses.',
		valueRange: 'Dark middle values with stronger edge highlights than Bronze.',
		surfaceAndWear:
			'Forged texture, hammer marks, fine scratches, and sparse red-brown oxidation at joints.',
		constructionVocabulary:
			'Straightforward forged profiles, visible peening, reinforced rims, straps, and practical rivets.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials:
			'Dark wood, brown leather, charcoal cloth, and tiny bronze fasteners.',
		neighborDifference:
			'Cooler, harder-edged, and more deliberately forged than Bronze; less refined than Steel.'
	}),
	material({
		materialId: 'yew',
		displayName: 'Yew',
		family: 'wood',
		rank: 'E',
		palette: 'Honey-gold sapwood with warm reddish heartwood bands.',
		valueRange: 'Warm middle values with readable two-tone grain.',
		surfaceAndWear:
			'Dense smooth grain, flex-polished surfaces, shallow handling wear, and clean carved edges.',
		constructionVocabulary:
			'Graceful tensioned curves, laminated-looking natural color bands, neat bindings, slim fittings.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Dark leather, linen cord, dull iron, and small bronze caps.',
		neighborDifference:
			'Richer, springier, and more carefully shaped than Ash; less massive and dark than Ironwood.'
	}),
	material({
		materialId: 'hard-leather',
		displayName: 'Hard Leather',
		family: 'hide-scale',
		rank: 'E',
		palette: 'Deep chestnut, russet edges, and dark brown seams.',
		valueRange: 'Middle-dark with controlled warm highlights on formed edges.',
		surfaceAndWear:
			'Waxed matte surface, compression creases, burnished edges, scratches, and repaired stitching.',
		constructionVocabulary:
			'Molded leather plates, reinforced seams, articulated lames, buckles, and fitted closures.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials:
			'Linen lining, dull iron buckles, dark cord, and small wood stiffeners.',
		neighborDifference:
			'Cleaner, firmer, and purpose-shaped than Coarse Hide; no scales or monstrous anatomy.'
	}),
	material({
		materialId: 'wool',
		displayName: 'Wool',
		family: 'cloth-fiber',
		rank: 'E',
		palette: 'Deep moss, warm gray, muted burgundy, and natural cream accents.',
		valueRange: 'Soft middle values with deep fold shadows.',
		surfaceAndWear: 'Dense fuzzy weave, pill-soft edges, compressed folds, and careful darning.',
		constructionVocabulary:
			'Layered warm panels, fitted mantle or hood, broad hems, braided ties, practical drape.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Plain leather, linen lining, wood toggles, and dull iron clasps.',
		neighborDifference:
			'Denser, warmer, and more tailored than Hemp Weave; less sleek and layered than Silk.'
	}),
	material({
		materialId: 'steel',
		displayName: 'Steel',
		family: 'metal',
		rank: 'D',
		palette: 'Neutral silver-gray steel with cool blue-gray shadows and darkened fittings.',
		valueRange: 'Broad mid-to-bright metal range with disciplined highlights.',
		surfaceAndWear:
			'Even forged finish, fine grind lines, polished contact edges, and restrained battle wear.',
		constructionVocabulary:
			'Refined tapers, fitted sockets, crisp fullers, articulated plates, clean rivet rhythm.',
		supernaturalBehavior: 'None.',
		neutralSecondaryMaterials: 'Blackened iron, dark leather, hardwood, and charcoal cloth.',
		neighborDifference:
			'Cleaner and structurally more refined than Iron; brighter and less ominous than Blacksteel.'
	}),
	material({
		materialId: 'ironwood',
		displayName: 'Ironwood',
		family: 'wood',
		rank: 'D',
		palette: 'Deep brown-black heartwood with narrow copper-brown grain lines.',
		valueRange: 'Dark, weighty values with small satin highlights.',
		surfaceAndWear:
			'Exceptionally dense closed grain, hard polished ridges, minor impact whitening, few dents.',
		constructionVocabulary:
			'Thick load-bearing limbs and shafts, precise carved facets, robust collars, inset grips.',
		supernaturalBehavior: 'Only an uncanny sense of weight and hardness; no glow.',
		neutralSecondaryMaterials: 'Steel, dark leather, black cord, and muted bronze.',
		neighborDifference:
			'Darker, denser, and more architectural than Yew; less alive and expressive than Heartwood.'
	}),
	material({
		materialId: 'beast-scale',
		displayName: 'Beast Scale',
		family: 'hide-scale',
		rank: 'D',
		palette: 'Smoky umber, gray-green, and bone-tan scale edges.',
		valueRange: 'Middle-dark with directional scale highlights.',
		surfaceAndWear:
			'Natural overlapping scales, keratin ridges, chipped tips, worn high points, supple hide joins.',
		constructionVocabulary:
			'Sorted scale rows on flexible backing, reinforced zones, tied edges, practical closures.',
		supernaturalBehavior: 'None; biological durability is visible but grounded.',
		neutralSecondaryMaterials: 'Hard Leather, linen, dull steel, and dark cord.',
		neighborDifference:
			'More articulated and protective than Hard Leather; less plated and alien than Chitin.'
	}),
	material({
		materialId: 'layered-silk',
		displayName: 'Layered Silk',
		family: 'cloth-fiber',
		rank: 'D',
		palette: 'Ink blue, muted teal, smoke gray, and restrained pearl highlights.',
		valueRange: 'Deep folds with clean silky edge sheen.',
		surfaceAndWear:
			'Fine tight weave, layered translucency only at edges, smooth folds, minimal fraying.',
		constructionVocabulary:
			'Multiple offset layers, wrapped closures, precise pleats, slim hems, flowing panels.',
		supernaturalBehavior: 'None; apparent lightness comes from textile behavior only.',
		neutralSecondaryMaterials:
			'Dark leather, black cord, small steel clasps, and matte linen lining.',
		neighborDifference:
			'Finer, lighter, and more layered than Wool; less arcane and self-structured than Spellweave.'
	}),
	material({
		materialId: 'blacksteel',
		displayName: 'Blacksteel',
		family: 'metal',
		rank: 'C',
		palette: 'Blue-black metal, charcoal planes, and narrow cold-silver cutting edges.',
		valueRange: 'Predominantly dark with sharp, deliberate highlight control.',
		surfaceAndWear:
			'Dense satin-black finish, crisp polish at edges, subtle grind pattern, almost no oxidation.',
		constructionVocabulary:
			'Bold cutouts, angular guards, blackened plate overlaps, hooked accents, exact fittings.',
		supernaturalBehavior:
			'Absorbs ambient light slightly in recesses; no aura or full-object glow.',
		neutralSecondaryMaterials:
			'Black leather, dark hardwood, charcoal textile, and tiny silver pins.',
		neighborDifference:
			'Darker, bolder, and more ominously shaped than Steel; less airy and luminous than Skyiron.'
	}),
	material({
		materialId: 'heartwood',
		displayName: 'Heartwood',
		family: 'wood',
		rank: 'C',
		palette: 'Rich crimson-brown core, dark bark-brown ridges, and warm amber grain.',
		valueRange: 'Deep warm values with a brighter living center.',
		surfaceAndWear:
			'Old dense grain, naturally interlocked fibers, polished growth ridges, healed knots.',
		constructionVocabulary:
			'Organic curves grown around the load path, branch-like braces, carved rings, integrated knots.',
		supernaturalBehavior: 'A faint warm pulse visible only in a few grain channels.',
		neutralSecondaryMaterials: 'Dark leather, black cord, steel caps, and muted bronze.',
		neighborDifference:
			'More organic and visibly vital than Ironwood; less spectral and weightless than Spiritwood.'
	}),
	material({
		materialId: 'chitin',
		displayName: 'Chitin',
		family: 'hide-scale',
		rank: 'C',
		palette: 'Obsidian brown, muted violet-black, bone edges, and dark red joint traces.',
		valueRange: 'Dark glossy ridges over matte recessed membranes.',
		surfaceAndWear:
			'Hard segmented shell, ribbed growth lines, chipped tips, polished raised plates.',
		constructionVocabulary:
			'Interlocking carapace plates, asymmetric biological curves, hooked overlaps, flexible dark joints.',
		supernaturalBehavior: 'None beyond an uncanny grown precision.',
		neutralSecondaryMaterials: 'Black leather, dark textile, steel pins, and bone toggles.',
		neighborDifference:
			'Harder, stranger, and more sculptural than Beast Scale; less draconic and luminous than Drakescale.'
	}),
	material({
		materialId: 'spellweave',
		displayName: 'Spellweave',
		family: 'cloth-fiber',
		rank: 'C',
		palette: 'Deep indigo, muted violet, charcoal, and narrow cyan-violet thread accents.',
		valueRange: 'Dark rich folds with selective luminous stitching.',
		surfaceAndWear: 'Fine resilient weave, precise hems, layered runic stitching, almost no fray.',
		constructionVocabulary:
			'Structured drape, geometric panels, inscribed borders, suspended-looking collars and cuffs.',
		supernaturalBehavior: 'A few stitched glyph paths emit a faint controlled light.',
		neutralSecondaryMaterials: 'Black leather, silver clasps, matte lining, and dark cord.',
		neighborDifference:
			'More self-structured and arcane than Layered Silk; less ethereal and nocturnal than Moonweave.'
	}),
	material({
		materialId: 'skyiron',
		displayName: 'Skyiron',
		family: 'metal',
		rank: 'B',
		palette: 'Pale blue-silver metal with cloud-gray shadows and restrained azure seams.',
		valueRange: 'Light, high-clarity metal values without becoming white.',
		surfaceAndWear:
			'Unusually smooth light metal, wind-swept polish lines, crisp edges, sparse abrasion.',
		constructionVocabulary:
			'Long sweeping profiles, lightened apertures, winglike ribs, elegant thin reinforcement.',
		supernaturalBehavior:
			'A faint cool sheen gathers on upward edges as if catching open-sky light.',
		neutralSecondaryMaterials: 'Slate leather, pale hardwood, silver fittings, and gray cloth.',
		neighborDifference:
			'Lighter, more open, and more graceful than Blacksteel; less cosmic and faceted than Starmetal.'
	}),
	material({
		materialId: 'spiritwood',
		displayName: 'Spiritwood',
		family: 'wood',
		rank: 'B',
		palette: 'Silver-gray wood, desaturated blue grain, and soft teal-white inner traces.',
		valueRange: 'Cool middle-light values with translucent-looking edges.',
		surfaceAndWear:
			'Smooth ancient grain, soft ghostlike striations, few physical scars, clean grown joints.',
		constructionVocabulary:
			'Elegant sweeping limbs, forked growth, hollow negative spaces, floating-looking but connected rings.',
		supernaturalBehavior:
			'A restrained inner glow follows selected grain lines; the object remains solid wood.',
		neutralSecondaryMaterials: 'Silver, gray leather, pale cord, and charcoal cloth.',
		neighborDifference:
			'Cooler, lighter, and more spectral than Heartwood; less lush and actively growing than Living Branch.'
	}),
	material({
		materialId: 'drakescale',
		displayName: 'Drakescale',
		family: 'hide-scale',
		rank: 'B',
		palette: 'Deep ember red, soot-black, and warm bronze-gold scale ridges.',
		valueRange: 'Dark body with bright directional ridge accents.',
		surfaceAndWear:
			'Hard overlapping reptilian scales, heat-darkened recesses, chipped ridges, glossy high points.',
		constructionVocabulary:
			'Tight aerodynamic scale rows, reinforced crests, clawlike trim, heat-resistant layered joints.',
		supernaturalBehavior: 'A few ember-warm seams suggest retained heat; no flames.',
		neutralSecondaryMaterials: 'Black leather, dark steel, charcoal lining, and bronze fasteners.',
		neighborDifference:
			'More refined, draconic, and heat-bearing than Chitin; smaller-scaled and less regal than Wyrmscale.'
	}),
	material({
		materialId: 'moonweave',
		displayName: 'Moonweave',
		family: 'cloth-fiber',
		rank: 'B',
		palette: 'Midnight blue, cool silver, smoky lavender, and moon-pale trim.',
		valueRange: 'Deep nocturnal folds with soft silver highlights.',
		surfaceAndWear:
			'Silky matte weave that catches cool light, clean floating hems, fine crescent stitching.',
		constructionVocabulary:
			'Long layered drape, crescent arcs, asymmetric mantle, narrow silver-bound edges.',
		supernaturalBehavior: 'Subtle moonlit shimmer moves only across folds facing the key light.',
		neutralSecondaryMaterials: 'Silver clasps, black leather, charcoal lining, and dark cord.',
		neighborDifference:
			'Softer, more ethereal, and more nocturnal than Spellweave; less radiant and cosmic than Starcloth.'
	}),
	material({
		materialId: 'starmetal',
		displayName: 'Starmetal',
		family: 'metal',
		rank: 'A',
		palette: 'Deep blue-silver, near-black cosmic facets, and sparse white-gold star points.',
		valueRange: 'Strong dark-to-bright contrast controlled along facets and edges.',
		surfaceAndWear:
			'Flawless faceted alloy, meteor-like grain, razor-clean edges, almost no mundane corrosion.',
		constructionVocabulary:
			'Extraordinary tapered geometry, orbit-like negative spaces, fine celestial inlay, precise floating impression while connected.',
		supernaturalBehavior:
			'Sparse star-point glints and a faint depth within dark facets; never a full aura.',
		neutralSecondaryMaterials: 'Black leather, dark hardwood, silver, and charcoal textile.',
		neighborDifference:
			'More cosmic, faceted, and extraordinary than Skyiron; colder and less solar than Sunsteel.'
	}),
	material({
		materialId: 'living-branch',
		displayName: 'Living Branch',
		family: 'wood',
		rank: 'A',
		palette: 'Rich bark brown, fresh green-gold cambium, and small emerald leaf accents.',
		valueRange: 'Deep natural body with bright living seams.',
		surfaceAndWear:
			'Supple bark, polished exposed grain, healed cuts, tiny fresh buds, no dead splintering.',
		constructionVocabulary:
			'Actively grown curves, entwined branches, leaflike tips, root-grip structures, seamless living joints.',
		supernaturalBehavior:
			'Selected buds and cambium lines emit a faint green-gold vitality; growth remains bounded.',
		neutralSecondaryMaterials:
			'Gold-bronze caps, dark leather, natural cord, and muted green cloth.',
		neighborDifference:
			'Lusher, more alive, and more dynamically grown than Spiritwood; smaller and less primordial than Worldtree Limb.'
	}),
	material({
		materialId: 'wyrmscale',
		displayName: 'Wyrmscale',
		family: 'hide-scale',
		rank: 'A',
		palette: 'Royal cobalt or deep crimson scales, black recesses, and luminous gold edge accents.',
		valueRange: 'Rich saturated darks with brilliant armored ridges.',
		surfaceAndWear:
			'Large ancient scales, layered enamel-like sheen, scarred high ridges, nearly impenetrable overlaps.',
		constructionVocabulary:
			'Regal scale fields, pronounced crests, sweeping draconic panels, gold-bound joints, powerful silhouette.',
		supernaturalBehavior:
			'A restrained elemental gleam travels through a few scale edges; no breath effect.',
		neutralSecondaryMaterials: 'Black leather, dark steel, gold fittings, and charcoal lining.',
		neighborDifference:
			'Larger, more regal, and more magically potent than Drakescale; less colossal and primeval than Ancient Dragon Scale.'
	}),
	material({
		materialId: 'starcloth',
		displayName: 'Starcloth',
		family: 'cloth-fiber',
		rank: 'A',
		palette:
			'Deep indigo-black, radiant blue-violet, silver-white constellations, and sparse gold points.',
		valueRange: 'Very dark cloth carrying crisp luminous accents.',
		surfaceAndWear:
			'Impossibly fine weave, deep clean folds, constellation embroidery, pristine resilient edges.',
		constructionVocabulary:
			'Celestial arcs, layered mantle, long star-trail hems, elegant open sleeves, precise luminous borders.',
		supernaturalBehavior:
			'Tiny constellation points and faint thread paths glow within the cloth, never around it.',
		neutralSecondaryMaterials:
			'Silver clasps, black leather, dark lining, and minimal gold thread.',
		neighborDifference:
			'More radiant, cosmic, and sharply detailed than Moonweave; less reality-bending than Fateweave.'
	}),
	material({
		materialId: 'sunsteel',
		displayName: 'Sunsteel',
		family: 'metal',
		rank: 'S',
		palette:
			'White-gold metal, warm solar gold, small ember-orange cores, and deep charcoal contrast.',
		valueRange: 'Legendary bright focal edges balanced by solid dark recesses.',
		surfaceAndWear:
			'Flawless radiant alloy, sunburst grain, immaculate edges, ceremonial micro-engraving, no rust.',
		constructionVocabulary:
			'Iconic heroic silhouette, solar arcs, crownlike guards, controlled asymmetric spectacle, masterful joined geometry.',
		supernaturalBehavior:
			'Contained sunlight glows through narrow channels and the strongest edges; no uncontrolled bloom.',
		neutralSecondaryMaterials:
			'Black leather, dark hardwood, charcoal cloth, and tiny white-silver fittings.',
		neighborDifference:
			'Warmer, more iconic, and unmistakably solar beyond Starmetal while remaining usable equipment.'
	}),
	material({
		materialId: 'worldtree-limb',
		displayName: 'Worldtree Limb',
		family: 'wood',
		rank: 'S',
		palette:
			'Ancient dark bark, luminous gold-green heartwood, emerald leaves, and pale root-white accents.',
		valueRange: 'Deep primordial mass with brilliant but contained living channels.',
		surfaceAndWear:
			'Age-ring complexity, monumental grain, self-healed scars, living moss traces, flawless load-bearing fibers.',
		constructionVocabulary:
			'Mythic branching silhouette, root and crown motifs, vast growth compressed into a usable form, nested natural arches.',
		supernaturalBehavior:
			'Contained seasons appear in selected leaves and sap-light channels; no detached particles or aura.',
		neutralSecondaryMaterials:
			'Sunsteel or gold-bronze accents, dark leather, natural cord, and deep green cloth.',
		neighborDifference:
			'More ancient, monumental, and cosmically alive than Living Branch; the apex of wood without becoming a tree scene.'
	}),
	material({
		materialId: 'ancient-dragon-scale',
		displayName: 'Ancient Dragon Scale',
		family: 'hide-scale',
		rank: 'S',
		palette:
			'Obsidian dragon scales, molten gold fissures, ancient crimson undertones, and ivory horn accents.',
		valueRange: 'Apex dark mass with brilliant controlled scale rims and fissures.',
		surfaceAndWear:
			'Colossal time-worn scales, glass-hard ridges, legendary battle scars, perfectly fitted ancient overlaps.',
		constructionVocabulary:
			'Monumental draconic plating, crownlike crests, horn-bound contours, grand interlocking scale architecture.',
		supernaturalBehavior:
			'Ancient inner fire glows through a few deep fissures; no flames, smoke, or creature body.',
		neutralSecondaryMaterials:
			'Black leather, sunsteel fittings, charcoal lining, and ivory horn only.',
		neighborDifference:
			'Older, larger, more monumental, and more mythic than Wyrmscale; unmistakably true dragon material.'
	}),
	material({
		materialId: 'fateweave',
		displayName: 'Fateweave',
		family: 'cloth-fiber',
		rank: 'S',
		palette: 'Void black, luminous pearl, royal violet, and thin gold destiny-lines.',
		valueRange: 'Near-black depth crossed by brilliant precise threads and pale folds.',
		surfaceAndWear:
			'Perfect impossible weave, folds with subtly contradictory depth, unfrayed edges, immaculate threadwork.',
		constructionVocabulary:
			'Legendary layered silhouette, sweeping destiny arcs, impossible but connected hems, crownlike collar, masterful asymmetry.',
		supernaturalBehavior:
			'A few threads appear to pass ahead of or behind their fold and glow softly; no portal, aura, or detached magic.',
		neutralSecondaryMaterials:
			'White-silver clasps, black leather, dark lining, and minimal gold fittings.',
		neighborDifference:
			'More mythic, reality-bending, and iconic than Starcloth while remaining clearly wearable cloth equipment.'
	})
] as const satisfies readonly EquipmentMaterialBriefV3[];

export interface EquipmentClassDirectionV3 {
	readonly classId: EquipmentClass;
	readonly displayName: string;
	readonly family: EquipmentMaterialFamily;
	readonly stableIdentity: string;
	readonly variationLevers: string;
	readonly pose: string;
	readonly source: 'accepted-experiment' | 'v3-generated';
	readonly status: 'owner-accepted' | 'generation-required';
	readonly imagePath: string;
	readonly sha256: string | null;
	readonly acceptanceScope: string;
}

const ACCEPTED_DIRECTION_ROOT = 'assets/equipment/experiments/rank-first-calibration-2026-09-02';
const DAGGER_DIRECTION_ROOT =
	'assets/equipment/experiments/material-vs-class-calibration-2026-09-02';

export const EQUIPMENT_CLASS_DIRECTIONS_V3 = [
	{
		classId: 'sword',
		displayName: 'Sword',
		family: 'metal',
		stableIdentity: 'Long cutting blade and usable one- or two-hand grip.',
		variationLevers:
			'Blade profile, fuller, guard, pommel, negative space, and increasing silhouette ambition.',
		pose: 'Single weapon upright on its pommel with a slight rightward diagonal; blade fully readable.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/sword-metal-ranks-v1.png`,
		sha256: '63835048580050dfae01d4195d26a1a0dc9b8d66546ca2af8540aa5565338f43',
		acceptanceScope: 'Rank escalation, silhouette variety, finish, and class recognition.'
	},
	{
		classId: 'dagger',
		displayName: 'Dagger',
		family: 'metal',
		stableIdentity: 'Compact one-hand fighting weapon with a clear point and grip.',
		variationLevers:
			'Point, blade mass, guard, hooks, cutouts, negative space, and increasing silhouette ambition.',
		pose: 'Single dagger upright on its pommel with a slight rightward diagonal; whole silhouette readable.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${DAGGER_DIRECTION_ROOT}/approach-b-dagger-class-progression-v1.png`,
		sha256: '6ecc2035df1272044ca96a0f033977e6de3bad02cd1e855c4f04cad9a45394b2',
		acceptanceScope: 'Primary rank-escalation rhythm and the target level of coolness.'
	},
	{
		classId: 'spear',
		displayName: 'Spear',
		family: 'metal',
		stableIdentity: 'Metal-led head on a long practical shaft.',
		variationLevers: 'Head profile, socket, wings or lugs, shaft fittings, and bounded cutouts.',
		pose: 'Single full spear on a long slight rightward diagonal; metal head and shaft proportion readable.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/spear-metal-ranks-v1.png`,
		sha256: 'bdfa20d86ca6b2a4c6b9540e6b0924e018cfe749b1dc8981fdead06ded7101bd',
		acceptanceScope: 'Rank escalation, proportions, silhouette variety, and finish.'
	},
	{
		classId: 'axe',
		displayName: 'Axe',
		family: 'metal',
		stableIdentity: 'One dominant cutting bit on a practical haft.',
		variationLevers: 'Beard, bit sweep, poll, socket, haft fittings, and bounded cutouts.',
		pose: 'Single axe upright on the haft end with a slight rightward diagonal; standard single-bit variant.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/axe-metal-ranks-v1.png`,
		sha256: 'b99400da66d60a542d80683dc8083993dbcca30a2f4a268a77037b3d6fbbb8dd',
		acceptanceScope:
			'Rank escalation, single-bit silhouette variety, finish, and class recognition.'
	},
	{
		classId: 'mace',
		displayName: 'Mace',
		family: 'metal',
		stableIdentity:
			'Weighted striking head on a practical haft, shorter than a sword but not stubby.',
		variationLevers: 'Flange count, crown, head mass, haft length, fittings, and negative space.',
		pose: 'Single mace upright on the haft end with a slight rightward diagonal; full practical length visible.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/mace-metal-ranks-v1.png`,
		sha256: 'b8e12d3b64ec7ac4515ef067b87dad09c5b51b02a1f5d6a1fb13f1c425389359',
		acceptanceScope: 'Rank escalation, proportions, silhouette variety, and finish.'
	},
	{
		classId: 'shield',
		displayName: 'Shield',
		family: 'metal',
		stableIdentity: 'One-hand defensive face with readable rim, boss or grip structure.',
		variationLevers:
			'Outline, boss, ribs, rim, apertures, and structural ornament; shape may vary by rank.',
		pose: 'Single shield in consistent mild three-quarter view, standing vertically with face and thickness readable.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/shield-metal-ranks-v1.png`,
		sha256: 'fa4f02530a8838cd9ac0738dae28ffdddcbf5f87527f9fc2d2989f4568d936e2',
		acceptanceScope: 'Rank escalation, varied standard-shield silhouettes, finish, and camera.'
	},
	{
		classId: 'bow',
		displayName: 'Bow',
		family: 'wood',
		stableIdentity: 'Two wood-led limbs, central grip, and one clearly readable string.',
		variationLevers:
			'Recurve, limb profile, tips, inlay, negative space, and increasing construction ambition.',
		pose: 'Single strung bow upright with a slight rightward diagonal; entire string and both tips visible.',
		source: 'v3-generated',
		status: 'generation-required',
		imagePath: `${EQUIPMENT_V3_ROOT}/direction/class-progressions/bow-wood-ranks-v3.png`,
		sha256: null,
		acceptanceScope:
			'Requires owner checkpoint 1 acceptance for rank escalation, silhouettes, finish, and camera.'
	},
	{
		classId: 'staff',
		displayName: 'Staff',
		family: 'wood',
		stableIdentity: 'Full-length wood-led magical focus with a readable crown and grounded shaft.',
		variationLevers:
			'Crown gesture, growth, rings, fittings, inlay, negative space, and increasing supernatural character.',
		pose: 'Single staff standing on its base with a gentle rightward lean; crown gestures away from vertical.',
		source: 'v3-generated',
		status: 'generation-required',
		imagePath: `${EQUIPMENT_V3_ROOT}/direction/class-progressions/staff-wood-ranks-v3.png`,
		sha256: null,
		acceptanceScope:
			'Requires owner checkpoint 1 acceptance for rank escalation, silhouettes, finish, and camera.'
	},
	{
		classId: 'heavy-armor',
		displayName: 'Heavy Armor',
		family: 'metal',
		stableIdentity:
			'Broad articulated metal protection comprising exactly Head, Torso, Legs, and Boots.',
		variationLevers:
			'Plate cut, overlap, helmet, shoulders, fauld, greaves, and increasing silhouette authority.',
		pose: 'Empty self-supporting full set in a consistent mild three-quarter front view; no mannequin or wearer.',
		source: 'accepted-experiment',
		status: 'owner-accepted',
		imagePath: `${ACCEPTED_DIRECTION_ROOT}/heavy-armor-metal-ranks-v1.png`,
		sha256: 'e43eebe931c75330abe54d39b35a97b69bc1e18c2e349c31eff1bb0b096683da',
		acceptanceScope:
			'Rank escalation, silhouette, and finish only; production must remove mannequin/body impression.'
	},
	{
		classId: 'light-armor',
		displayName: 'Light Armor',
		family: 'hide-scale',
		stableIdentity:
			'Mobile hide- or scale-led protection comprising exactly Head, Torso, Legs, and Boots.',
		variationLevers:
			'Panels, scale direction, closures, layering, shoulder shape, and increasing material authority.',
		pose: 'Empty self-supporting full set in a consistent mild three-quarter front view; no mannequin or wearer.',
		source: 'v3-generated',
		status: 'generation-required',
		imagePath: `${EQUIPMENT_V3_ROOT}/direction/class-progressions/light-armor-hide-scale-ranks-v3.png`,
		sha256: null,
		acceptanceScope:
			'Requires owner checkpoint 1 acceptance for rank escalation, silhouettes, finish, camera, and empty-set treatment.'
	},
	{
		classId: 'robes',
		displayName: 'Robes',
		family: 'cloth-fiber',
		stableIdentity: 'Cloth-led draped equipment comprising exactly Head, Torso, Legs, and Boots.',
		variationLevers:
			'Hem, sleeves, collar or hood, layers, weave behavior, closures, and increasing supernatural structure.',
		pose: 'Empty self-supporting full set in a consistent mild three-quarter front view; no mannequin, wearer, or black void figure.',
		source: 'v3-generated',
		status: 'generation-required',
		imagePath: `${EQUIPMENT_V3_ROOT}/direction/class-progressions/robes-cloth-fiber-ranks-v3.png`,
		sha256: null,
		acceptanceScope:
			'Requires owner checkpoint 1 acceptance for rank escalation, silhouettes, finish, camera, and empty-set treatment.'
	}
] as const satisfies readonly EquipmentClassDirectionV3[];

const STANDALONE_BY_FAMILY = {
	metal: ['sword', 'dagger', 'spear', 'axe', 'mace', 'shield'],
	wood: ['bow', 'staff'],
	'hide-scale': [],
	'cloth-fiber': []
} as const satisfies Record<EquipmentMaterialFamily, readonly EquipmentClass[]>;

const ARMOR_BY_FAMILY = {
	metal: 'heavy-armor',
	wood: null,
	'hide-scale': 'light-armor',
	'cloth-fiber': 'robes'
} as const satisfies Record<EquipmentMaterialFamily, EquipmentClass | null>;

export interface EquipmentCandidateTargetV3 {
	readonly targetId: string;
	readonly productionOrder: number;
	readonly rank: EquipmentRank;
	readonly materialId: string;
	readonly materialName: string;
	readonly materialFamily: EquipmentMaterialFamily;
	readonly materialBriefPath: string;
	readonly classId: EquipmentClass;
	readonly classDirectionId: string;
	readonly artifactId: string;
	readonly artifactRole: 'item' | 'set-source' | 'armor-piece';
	readonly slot: EquipmentArmorSlot | null;
	readonly setId: string | null;
	readonly dependsOnTargetId: string | null;
	readonly width: 1024;
	readonly height: 1024 | 1536;
	readonly output: {
		readonly targetPath: string;
		readonly assignmentPath: string;
		readonly promptPath: string;
		readonly candidatePath: string;
		readonly provenanceResultPath: string;
		readonly reviewReceiptPath: string;
	};
}

function classDirectionId(classId: EquipmentClass): string {
	return `equipment-v3-${classId}-rank-progression`;
}

function targetId(materialId: string, artifactId: string): string {
	return `${EQUIPMENT_V3_PRODUCTION_ID}-${materialId}-${artifactId}-v3`;
}

function targetPaths(target: { rank: EquipmentRank; materialId: string; artifactId: string }) {
	const directory = `${target.rank.toLowerCase()}/${target.materialId}`;
	const basename = `${target.artifactId}-v3`;
	return {
		targetPath: `${EQUIPMENT_V3_ROOT}/targets/${directory}/${basename}.json`,
		assignmentPath: `${EQUIPMENT_V3_ROOT}/assignments/${directory}/${basename}.json`,
		promptPath: `${EQUIPMENT_V3_ROOT}/assignments/${directory}/${basename}.prompt.txt`,
		candidatePath: `${EQUIPMENT_V3_ROOT}/candidates/${directory}/${basename}.png`,
		provenanceResultPath: `${EQUIPMENT_V3_ROOT}/results/${directory}/${basename}.json`,
		reviewReceiptPath: `${EQUIPMENT_V3_ROOT}/reviews/decisions/${directory}/${basename}.json`
	};
}

export function buildEquipmentCandidateTargetsV3(): EquipmentCandidateTargetV3[] {
	const targets: EquipmentCandidateTargetV3[] = [];
	for (const brief of EQUIPMENT_MATERIAL_BRIEFS_V3) {
		for (const classId of STANDALONE_BY_FAMILY[brief.family]) {
			const artifactId = classId;
			targets.push({
				targetId: targetId(brief.materialId, artifactId),
				productionOrder: targets.length + 1,
				rank: brief.rank,
				materialId: brief.materialId,
				materialName: brief.displayName,
				materialFamily: brief.family,
				materialBriefPath: brief.briefPath,
				classId,
				classDirectionId: classDirectionId(classId),
				artifactId,
				artifactRole: 'item',
				slot: null,
				setId: null,
				dependsOnTargetId: null,
				width: 1024,
				height: 1024,
				output: targetPaths({ rank: brief.rank, materialId: brief.materialId, artifactId })
			});
		}
		const armorClass = ARMOR_BY_FAMILY[brief.family];
		if (armorClass === null) continue;
		const setId = `${brief.materialId}-${armorClass}`;
		const sourceArtifactId = `${armorClass}-full-set`;
		const sourceTargetId = targetId(brief.materialId, sourceArtifactId);
		targets.push({
			targetId: sourceTargetId,
			productionOrder: targets.length + 1,
			rank: brief.rank,
			materialId: brief.materialId,
			materialName: brief.displayName,
			materialFamily: brief.family,
			materialBriefPath: brief.briefPath,
			classId: armorClass,
			classDirectionId: classDirectionId(armorClass),
			artifactId: sourceArtifactId,
			artifactRole: 'set-source',
			slot: null,
			setId,
			dependsOnTargetId: null,
			width: 1024,
			height: 1536,
			output: targetPaths({
				rank: brief.rank,
				materialId: brief.materialId,
				artifactId: sourceArtifactId
			})
		});
		for (const slot of EQUIPMENT_ARMOR_SLOTS) {
			const artifactId = `${armorClass}-${slot}`;
			targets.push({
				targetId: targetId(brief.materialId, artifactId),
				productionOrder: targets.length + 1,
				rank: brief.rank,
				materialId: brief.materialId,
				materialName: brief.displayName,
				materialFamily: brief.family,
				materialBriefPath: brief.briefPath,
				classId: armorClass,
				classDirectionId: classDirectionId(armorClass),
				artifactId,
				artifactRole: 'armor-piece',
				slot,
				setId,
				dependsOnTargetId: sourceTargetId,
				width: 1024,
				height: 1024,
				output: targetPaths({ rank: brief.rank, materialId: brief.materialId, artifactId })
			});
		}
	}
	return targets;
}

export function canonicalJson(value: unknown): string {
	function canonicalize(child: unknown): unknown {
		if (Array.isArray(child)) return child.map(canonicalize);
		if (child !== null && typeof child === 'object') {
			return Object.fromEntries(
				Object.entries(child as Record<string, unknown>)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([key, item]) => [key, canonicalize(item)])
			);
		}
		return child;
	}
	return JSON.stringify(canonicalize(value));
}

export function canonicalSha256(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function fileSha256(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

export function assertEquipmentV3Invariants(workspaceRoot = process.cwd()): void {
	const targets = buildEquipmentCandidateTargetsV3();
	if (EQUIPMENT_MATERIAL_BRIEFS_V3.length !== 28)
		throw new Error('Expected exactly 28 material briefs');
	if (EQUIPMENT_CLASS_DIRECTIONS_V3.length !== 11)
		throw new Error('Expected exactly 11 class directions');
	if (targets.length !== 161)
		throw new Error(`Expected exactly 161 targets, got ${targets.length}`);
	const roots = targets.filter(({ dependsOnTargetId }) => dependsOnTargetId === null);
	const pieces = targets.filter(({ artifactRole }) => artifactRole === 'armor-piece');
	if (roots.length !== 77 || pieces.length !== 84)
		throw new Error(`Expected 77 roots/84 pieces, got ${roots.length}/${pieces.length}`);
	assertUnique(
		EQUIPMENT_MATERIAL_BRIEFS_V3.map(({ materialId }) => materialId),
		'material ID'
	);
	assertUnique(
		EQUIPMENT_CLASS_DIRECTIONS_V3.map(({ classId }) => classId),
		'class direction'
	);
	assertUnique(
		targets.map(({ targetId }) => targetId),
		'target ID'
	);
	assertUnique(
		targets.flatMap(({ output }) => Object.values(output)),
		'reserved output path'
	);
	for (const classId of EQUIPMENT_CLASSES) {
		if (roots.filter((target) => target.classId === classId).length !== 7)
			throw new Error(`${classId} must have seven root ranks`);
	}
	for (const source of targets.filter(({ artifactRole }) => artifactRole === 'set-source')) {
		const children = targets.filter(
			({ dependsOnTargetId }) => dependsOnTargetId === source.targetId
		);
		if (
			children.length !== 4 ||
			children.some((child, index) => child.slot !== EQUIPMENT_ARMOR_SLOTS[index])
		) {
			throw new Error(`Invalid four-piece dependency for ${source.targetId}`);
		}
	}
	for (const target of targets) {
		for (const outputPath of Object.values(target.output)) {
			if (!outputPath.startsWith(`${EQUIPMENT_V3_ROOT}/`))
				throw new Error(`Output escapes v3: ${outputPath}`);
			if (/material-equipment-v[12]|\/approved\/|\/runtime\//u.test(outputPath))
				throw new Error(`Forbidden output namespace: ${outputPath}`);
		}
		if (
			!EQUIPMENT_MATERIAL_BRIEFS_V3.some(({ briefPath }) => briefPath === target.materialBriefPath)
		)
			throw new Error(`Missing material brief for ${target.targetId}`);
		if (
			!EQUIPMENT_CLASS_DIRECTIONS_V3.some(
				({ classId }) => classDirectionId(classId) === target.classDirectionId
			)
		)
			throw new Error(`Missing direction for ${target.targetId}`);
	}
	for (const direction of EQUIPMENT_CLASS_DIRECTIONS_V3.filter(
		({ status }) => status === 'owner-accepted'
	)) {
		if (direction.sha256 === null)
			throw new Error(`Accepted direction lacks hash: ${direction.classId}`);
		const actual = fileSha256(`${workspaceRoot}/${direction.imagePath}`);
		if (actual !== direction.sha256)
			throw new Error(`Direction hash mismatch for ${direction.classId}: ${actual}`);
	}
}

export function buildEquipmentV3Manifest() {
	assertEquipmentV3Invariants();
	const targets = buildEquipmentCandidateTargetsV3();
	return {
		schemaVersion: 'equipment-rank-first-production-manifest-v3' as const,
		productionId: EQUIPMENT_V3_PRODUCTION_ID,
		authoredDate: '2026-09-02' as const,
		status: 'checkpoint-1-pending' as const,
		strategy: 'rank-first-class-lanes-material-second' as const,
		previousProductions: [
			{ productionId: 'material-equipment-v1', policy: 'immutable-read-only-evidence' },
			{ productionId: 'material-equipment-v2', policy: 'immutable-read-only-evidence' }
		],
		sourcePlan: 'docs/superpowers/plans/2026-09-02-equipment-rank-first-full-production.md',
		lifecycle: {
			directionIsNotCandidate: true,
			candidateIsNotApproved: true,
			approvalIsNotRuntime: true,
			selfPromotionForbidden: true,
			armorPieceRequiresAcceptedHashBoundFullSet: true
		},
		imageSpecification: {
			isolated: {
				width: 1024,
				height: 1024,
				mediaType: 'image/png',
				minimumMarginPercent: 5,
				targetMarginPercent: 8
			},
			fullArmorSet: {
				width: 1024,
				height: 1536,
				mediaType: 'image/png',
				minimumMarginPercent: 5,
				targetMarginPercent: 8
			},
			phoneReviewWidths: [128, 256],
			progressionSheet: { width: 1536, height: 1024, mediaType: 'image/png' }
		},
		summary: {
			materialBriefCount: 28,
			classDirectionCount: 11,
			acceptedDirectionCount: 7,
			pendingDirectionCount: 4,
			targetCount: 161,
			rootCount: 77,
			armorPieceCount: 84,
			armorSetCount: 21
		},
		materialBriefs: EQUIPMENT_MATERIAL_BRIEFS_V3.map(({ materialId, briefPath }) => ({
			materialId,
			briefPath
		})),
		classDirections: EQUIPMENT_CLASS_DIRECTIONS_V3.map(
			({ classId, status, imagePath, sha256 }) => ({
				classId,
				directionId: classDirectionId(classId),
				status,
				imagePath,
				sha256
			})
		),
		targets
	};
}

export function buildEquipmentV3AllocationPlan() {
	const manifest = buildEquipmentV3Manifest();
	const rootJobs = manifest.targets
		.filter(({ dependsOnTargetId }) => dependsOnTargetId === null)
		.map((target) => ({
			jobId: `job-${target.targetId}`,
			targetId: target.targetId,
			laneId: `class-${target.classId}`,
			laneOrder: EQUIPMENT_RANKS.indexOf(target.rank) + 1,
			phase: 'root' as const,
			activation: 'after-owner-checkpoint-1' as const,
			assignmentMaterialization: 'after-accepted-class-direction-hash' as const,
			permittedOutputs: {
				candidatePath: target.output.candidatePath,
				resultPath: target.output.provenanceResultPath
			}
		}));
	const pieceJobs = manifest.targets
		.filter(({ artifactRole }) => artifactRole === 'armor-piece')
		.map((target) => ({
			jobId: `job-${target.targetId}`,
			targetId: target.targetId,
			laneId: `set-${target.setId}`,
			laneOrder: EQUIPMENT_ARMOR_SLOTS.indexOf(target.slot!) + 1,
			phase: 'armor-piece' as const,
			activation: 'after-owner-checkpoint-2-and-full-set-acceptance' as const,
			assignmentMaterialization: 'after-hash-bound-full-set-review-receipt' as const,
			dependsOnTargetId: target.dependsOnTargetId,
			permittedOutputs: {
				candidatePath: target.output.candidatePath,
				resultPath: target.output.provenanceResultPath
			}
		}));
	const sourceTargets = manifest.targets.filter(
		({ artifactRole }) => artifactRole === 'set-source'
	);
	const armorPieceWaves = Array.from(
		{ length: Math.ceil(sourceTargets.length / 4) },
		(_, waveIndex) => {
			const sources = sourceTargets.slice(waveIndex * 4, waveIndex * 4 + 4);
			const targetIds = sources.flatMap((source) =>
				manifest.targets
					.filter(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId)
					.sort(
						(a, b) =>
							EQUIPMENT_ARMOR_SLOTS.indexOf(a.slot!) - EQUIPMENT_ARMOR_SLOTS.indexOf(b.slot!)
					)
					.map(({ targetId }) => targetId)
			);
			return {
				waveId: `armor-piece-wave-${waveIndex + 1}`,
				maximumConcurrency: 16,
				setIds: sources.map(({ setId }) => setId!),
				targetIds,
				referenceOrder: [
					'accepted-full-set-source',
					'accepted-class-progression',
					'accepted-finish-reference'
				] as const
			};
		}
	);
	if (
		armorPieceWaves.length !== 6 ||
		armorPieceWaves.some(({ targetIds }) => targetIds.length > 16) ||
		armorPieceWaves.flatMap(({ targetIds }) => targetIds).length !== 84
	) {
		throw new Error('Armor piece wave plan must be six waves, at most 16 jobs each, totaling 84');
	}
	return {
		schemaVersion: 'equipment-rank-first-allocation-plan-v3' as const,
		planId: 'material-equipment-v3-rank-first-full-production' as const,
		productionId: EQUIPMENT_V3_PRODUCTION_ID,
		status: 'checkpoint-gated' as const,
		manifest: { path: EQUIPMENT_V3_MANIFEST_PATH, canonicalSha256: canonicalSha256(manifest) },
		scheduler: {
			maximumConcurrency: 16,
			rootLaneCount: 11,
			rootLaneConcurrency: 11,
			rootLaneOrder: 'F-E-D-C-B-A-S',
			armorPieceConcurrency: 16,
			retryPolicy: 'new-versioned-attempt-never-overwrite'
		},
		ownership: {
			root: EQUIPMENT_V3_ROOT,
			exclusiveCreateRequired: true,
			workerOutputs: ['candidate', 'provenance-result'],
			orchestratorOutputs: ['audits', 'review-receipts', 'checkpoint-receipts'],
			forbiddenRoots: [
				'assets/equipment/experiments/material-equipment-v1',
				'assets/equipment/experiments/material-equipment-v2',
				'assets/equipment/approved',
				'assets/equipment/runtime',
				'assets/enemies'
			]
		},
		checkpoints: [
			{
				checkpointId: 'equipment-v3-checkpoint-1-directions',
				unlocks: '77-root-jobs',
				requiredDecisionCount: 4
			},
			{
				checkpointId: 'equipment-v3-checkpoint-2-roots',
				unlocks: '84-armor-piece-jobs-for-accepted-sets',
				requiredDecisionCount: 77
			},
			{
				checkpointId: 'equipment-v3-checkpoint-3-armor-pieces',
				unlocks: 'candidate-closeout',
				requiredDecisionCount: 84
			}
		],
		summary: {
			jobCount: 161,
			rootJobCount: rootJobs.length,
			armorPieceJobCount: pieceJobs.length,
			armorPieceWaveCount: armorPieceWaves.length
		},
		armorPieceWaves,
		jobs: [...rootJobs, ...pieceJobs]
	};
}

export interface EquipmentDirectionPromptPacketV3 {
	readonly directionId: string;
	readonly classId: EquipmentClass;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly promptPath: string;
	readonly candidatePath: string;
	readonly resultPath: string;
	readonly prompt: string;
	readonly promptSha256: string;
	readonly references: readonly { path: string; sha256: string; purpose: string }[];
}

const STEEL_STYLE_REFERENCE = {
	path: `${DAGGER_DIRECTION_ROOT}/approach-a-steel-material-cohort-v1.png`,
	sha256: '6749ad1a65b995f48b89b0c1c8c8ee051da145315f5fd60775803f691ad7b887',
	purpose:
		'Accepted painterly finish and cross-class material-coherence reference; do not copy geometry.'
} as const;

const DAGGER_RHYTHM_REFERENCE = {
	path: `${DAGGER_DIRECTION_ROOT}/approach-b-dagger-class-progression-v1.png`,
	sha256: '6ecc2035df1272044ca96a0f033977e6de3bad02cd1e855c4f04cad9a45394b2',
	purpose: 'Accepted F-to-S escalation rhythm and target coolness; do not copy dagger geometry.'
} as const;

function renderDirectionPrompt(direction: EquipmentClassDirectionV3): string {
	const briefs = EQUIPMENT_MATERIAL_BRIEFS_V3.filter(({ family }) => family === direction.family);
	const columns = briefs
		.map(
			(brief) =>
				`${brief.rank} — ${brief.displayName}: ${brief.palette} ${brief.constructionVocabulary} ${brief.supernaturalBehavior}`
		)
		.join('\n');
	const armorRules = ['heavy-armor', 'light-armor', 'robes'].includes(direction.classId)
		? '\nARMOR RULES: Each column is one complete empty self-supporting equipment set with exactly four readable components: Head, Torso, Legs, Boots. Mild three-quarter front view, matching camera and stance across all seven. Natural cavity shadows only. Absolutely no person, mannequin, body, face, hands, pose dummy, black void figure, or extra fifth component.'
		: '';
	return `Create one polished seven-column EQUIPMENT DESIGN PROGRESSION SHEET for Summonlab. This is a direction reference, not seven final item assets.\n\nCLASS: ${direction.displayName}. Stable identity: ${direction.stableIdentity}\nPOSE/CAMERA: ${direction.pose}\n\nLAYOUT: one clean landscape 3:2 sheet, exactly seven evenly spaced full-object columns ordered left-to-right F, E, D, C, B, A, S. Put a small plain rank letter and material name below each column. No title, no legend, no lore text, no UI frame. Every object fully inside canvas with generous margins and no overlap. Midnight-charcoal studio background and restrained floor plane.\n\nPROGRESSION: F practical and appealing with minimal ornament; E sturdier and more deliberate; D refined professional; C bold silhouette with first supernatural construction cues; B visibly exceptional; A extraordinary geometry and ornament; S legendary controlled spectacle. Adjacent ranks must differ structurally at phone-thumbnail size. Palette alone is never the difference. Variation levers: ${direction.variationLevers}\n\nMATERIAL COLUMNS:\n${columns}${armorRules}\n\nSTYLE: premium realistic-painterly dark fantasy equipment concept art, grounded medieval construction, crisp readable silhouettes, honest material response and wear, cold key light with restrained warm rim, high-end game inventory art. Use the attached Dagger progression only for escalation rhythm and the attached Steel cohort only for finish/material discipline. Do not reproduce their shapes, emblems, characters, text, or recognizable copyrighted designs.\n\nEXCLUDE: repeated identical geometry with color swaps, generic near-duplicates, extra objects, hands, wielders, mannequins, scenery, dramatic VFX, detached particles, full-object glow, illegible labels, watermarks, signatures, logos, crops, and recognizable copying.`;
}

export function buildEquipmentDirectionPacketsV3(): EquipmentDirectionPromptPacketV3[] {
	return EQUIPMENT_CLASS_DIRECTIONS_V3.filter(({ status }) => status === 'generation-required').map(
		(direction) => {
			const base = `${EQUIPMENT_V3_ROOT}/direction/class-progressions/${direction.classId}`;
			const prompt = renderDirectionPrompt(direction);
			return {
				directionId: classDirectionId(direction.classId),
				classId: direction.classId,
				targetPath: `${base}.target.json`,
				assignmentPath: `${base}.assignment.json`,
				promptPath: `${base}.prompt.txt`,
				candidatePath: direction.imagePath,
				resultPath: `${base}.result.json`,
				prompt,
				promptSha256: createHash('sha256').update(prompt).digest('hex'),
				references: [DAGGER_RHYTHM_REFERENCE, STEEL_STYLE_REFERENCE]
			};
		}
	);
}

export interface AcceptedReferenceV3 {
	readonly path: string;
	readonly sha256: string;
	readonly purpose: string;
}

export interface EquipmentCandidateAssignmentV3 {
	readonly schemaVersion: 'equipment-rank-first-assignment-v3';
	readonly assignmentId: string;
	readonly targetId: string;
	readonly immutable: true;
	readonly classDirection: AcceptedReferenceV3;
	readonly materialBrief: { readonly path: string; readonly canonicalSha256: string };
	readonly finishReference: AcceptedReferenceV3;
	readonly consistencySource: AcceptedReferenceV3 | null;
	readonly prompt: string;
	readonly promptSha256: string;
	readonly permittedOutputs: { readonly candidatePath: string; readonly resultPath: string };
	readonly forbiddenActions: readonly string[];
}

function renderCandidatePrompt(
	target: EquipmentCandidateTargetV3,
	direction: EquipmentClassDirectionV3,
	brief: EquipmentMaterialBriefV3,
	consistencySource: AcceptedReferenceV3 | null
): string {
	const piece = target.artifactRole === 'armor-piece';
	const set = target.artifactRole === 'set-source';
	const identity = piece
		? `Render only the ${target.slot} item from the accepted full set. Preserve its exact material, palette, silhouette language, trim, fastenings, wear, ornament, and slot boundary. Do not redesign it.`
		: `Render one dedicated ${target.materialName} ${direction.displayName}${set ? ' complete set' : ''}, rank ${target.rank}, as a new individual image—not a crop from a progression sheet.`;
	const armor = set
		? 'Exactly four readable components: Head, Torso, Legs, Boots. Empty and self-supporting with natural cavity shadows only; absolutely no wearer, mannequin, body impression, face, hands, pose dummy, or black void figure.'
		: piece
			? `One isolated ${target.slot} only; no other set pieces, body part, wearer, mannequin, or display stand.`
			: '';
	return `${identity}\n\nCLASS DIRECTION: ${direction.stableIdentity} ${direction.pose} Use the accepted progression reference as the authoritative design for the ${target.rank} column while reconstructing it as a dedicated render. Preserve rank silhouette and distinctive structural cues; do not crop.\n\nMATERIAL BRIEF — ${brief.displayName}:\nPalette: ${brief.palette}\nValue: ${brief.valueRange}\nSurface/wear: ${brief.surfaceAndWear}\nConstruction: ${brief.constructionVocabulary}\nSupernatural behavior: ${brief.supernaturalBehavior}\nNeutral secondary materials: ${brief.neutralSecondaryMaterials}\nNeighbor distinction: ${brief.neighborDifference}\n\n${armor}\n\nSTYLE/OUTPUT: premium realistic-painterly dark fantasy equipment inventory art; grounded construction; honest material response; cold key light, restrained warm rim, midnight-charcoal studio ground with restrained floor plane. One fully visible object centered on a ${target.width}×${target.height} portrait-or-square canvas, about 8% margin and never below 5%; readable at 128px. No text, labels, UI, border, watermark, signature, scenery, extra objects, hands, wielder, detached particles, uncontrolled glow, or recognizable reference copying.${consistencySource ? '\n\nThe accepted full-set source is the first and authoritative visual reference. Match it exactly.' : ''}`;
}

export function buildEquipmentCandidateAssignmentV3(input: {
	target: EquipmentCandidateTargetV3;
	classDirection: AcceptedReferenceV3;
	consistencySource?: AcceptedReferenceV3;
}): EquipmentCandidateAssignmentV3 {
	const direction = EQUIPMENT_CLASS_DIRECTIONS_V3.find(
		({ classId }) => classId === input.target.classId
	);
	const brief = EQUIPMENT_MATERIAL_BRIEFS_V3.find(
		({ materialId }) => materialId === input.target.materialId
	);
	if (!direction || !brief)
		throw new Error(`Missing direction or brief for ${input.target.targetId}`);
	if (input.target.artifactRole === 'armor-piece' && !input.consistencySource)
		throw new Error(`Armor piece requires accepted full-set source: ${input.target.targetId}`);
	if (input.target.artifactRole !== 'armor-piece' && input.consistencySource)
		throw new Error(`Only Armor pieces may bind a consistency source: ${input.target.targetId}`);
	const prompt = renderCandidatePrompt(
		input.target,
		direction,
		brief,
		input.consistencySource ?? null
	);
	return {
		schemaVersion: 'equipment-rank-first-assignment-v3',
		assignmentId: `assignment-${input.target.targetId}`,
		targetId: input.target.targetId,
		immutable: true,
		classDirection: input.classDirection,
		materialBrief: { path: brief.briefPath, canonicalSha256: canonicalSha256(brief) },
		finishReference: STEEL_STYLE_REFERENCE,
		consistencySource: input.consistencySource ?? null,
		prompt,
		promptSha256: createHash('sha256').update(prompt).digest('hex'),
		permittedOutputs: {
			candidatePath: input.target.output.candidatePath,
			resultPath: input.target.output.provenanceResultPath
		},
		forbiddenActions: [
			'crop-progression-sheet',
			'overwrite-existing-output',
			'write-outside-permitted-outputs',
			'self-promote-to-approved',
			'write-runtime-catalog',
			'modify-v1-or-v2'
		]
	};
}

export function serializeJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}
