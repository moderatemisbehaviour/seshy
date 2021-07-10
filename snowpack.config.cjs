// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
	mount: {
		'src': '/',
	},
	plugins: [
		/* ... */
	],
	packageOptions: {
		/* ... */
	},
	devOptions: {
		/* ... */
	},
	buildOptions: {
		metaUrlPath: 'snowpack',
	},
	optimize: {
		bundle: true,
		entrypoints: [ // TODO: See if 'auto' starts working later so this can be removed.
			'worker.js',
			'ui/index.js', // TODO: See if CSS bundling starts working with only specific parts of the app bundled.
		],
	},
}
