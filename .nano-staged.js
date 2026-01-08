export default {
	'**/*.{js,jsx,ts,tsx,mjs,cjs}': ['prettier --write', 'eslint --fix'],
	'**/*.{json,md,css,scss,yml,yaml}': ['prettier --write'],
};
