module.exports = {
	root: true,
	env: {
		node: true,
		browser: true,
	},
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: './tsconfig.eslint.json',
	},
	extends: [
		'eslint:recommended',
		'preact',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'jsx-quotes': ['warn', 'prefer-single'],
		'react/jsx-indent': ['warn', 'tab'],
		'react-hooks/exhaustive-deps': 'off',
		'@typescript-eslint/indent': ['warn', 'tab'],
		'@typescript-eslint/semi': ['warn', 'never'],
		'@typescript-eslint/quotes': ['warn', 'single'],
		'@typescript-eslint/comma-dangle': ['warn', 'always-multiline'],
		'@typescript-eslint/comma-spacing': 'warn',
		'@typescript-eslint/brace-style': 'warn',
		'@typescript-eslint/keyword-spacing': 'warn',
		'@typescript-eslint/object-curly-spacing': ['warn', 'always'],
		'@typescript-eslint/space-before-blocks': 'warn',
		'@typescript-eslint/type-annotation-spacing': 'warn',
		'@typescript-eslint/member-delimiter-style': ['warn', {
			multiline: { delimiter: 'none' },
			singleline: { delimiter: 'comma' },
		}],
		'@typescript-eslint/no-empty-function': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
	},
	settings: {
		jest: { version: 27 },
	},
}
