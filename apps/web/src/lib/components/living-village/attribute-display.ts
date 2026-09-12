const characterSheetAbbreviations: Readonly<Record<string, string>> = {
	Strength: 'STR',
	Agility: 'AGI',
	Vitality: 'VIT',
	Magic: 'MAG'
};

const characterSheetOrder: Readonly<Record<string, number>> = {
	Strength: 0,
	Agility: 1,
	Vitality: 2,
	Magic: 3
};

export function attributeDisplayName(name: string): string {
	return characterSheetAbbreviations[name] ?? name;
}

export function orderCharacterSheetAttributes<T>(
	attributes: readonly T[],
	nameOf: (attribute: T) => string
): readonly T[] {
	return attributes
		.map((attribute, sourceIndex) => ({ attribute, sourceIndex }))
		.sort((left, right) => {
			const rankDifference =
				(characterSheetOrder[nameOf(left.attribute)] ?? Number.POSITIVE_INFINITY) -
				(characterSheetOrder[nameOf(right.attribute)] ?? Number.POSITIVE_INFINITY);

			return rankDifference || left.sourceIndex - right.sourceIndex;
		})
		.map(({ attribute }) => attribute);
}
