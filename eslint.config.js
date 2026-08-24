import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/.svelte-kit/**',
			'**/coverage/**',
			'prototype/**',
			'tools/hero-readme/**'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	{
		files: ['**/*.{js,mjs,ts}'],
		languageOptions: {
			ecmaVersion: 2024,
			globals: globals.node
		},
		rules: {
			'no-console': ['error', { allow: ['error'] }]
		}
	}
);
