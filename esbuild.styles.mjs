import esbuild from 'esbuild';
import process from 'process';

const prod = process.argv[2] === 'production';

// Bundle CSS imports into a single styles.css file Obsidian can load.
await esbuild.build({
	entryPoints: ['src/styles.css'],
	bundle: true,
	outfile: 'styles.css',
	minify: prod,
	logLevel: 'info',
	loader: {
		'.css': 'css',
	},
});
