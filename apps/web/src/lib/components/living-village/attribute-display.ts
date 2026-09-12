const characterSheetAbbreviations: Readonly<Record<string, string>> = {
	Strength: 'STR',
	Vitality: 'VIT',
	Agility: 'AGI',
	Magic: 'MAG'
};

export function attributeDisplayName(name: string): string {
	return characterSheetAbbreviations[name] ?? name;
}
