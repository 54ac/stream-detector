import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import postcss from "rollup-plugin-postcss";
import env from "postcss-preset-env";
import babel from "@rollup/plugin-babel";
import copy from "rollup-plugin-copy-watch";
import cleaner from "rollup-plugin-cleaner";
import multiInput from "rollup-plugin-multi-input";

const production = !process.env.ROLLUP_WATCH;

export default [
	{
		input: ["src/js/*.js", "src/js/components/*.js"],
		output: {
			dir: "build",
			format: "esm",
			sourcemap: !production
		},
		plugins: [
			cleaner({
				targets: ["build"]
			}),
			multiInput.default(),
			resolve(),
			commonjs(),
			babel({ exclude: "node_modules/**", babelHelpers: "bundled" }),
			copy({
				watch: !production && "src",
				targets: [
					{
						src: "src/manifest.json",
						dest: "build",
						transform: (content) => {
							const manifest = JSON.parse(content.toString());
							manifest.version = process.env.npm_package_version;
							return JSON.stringify(manifest, null, 2);
						}
					},
					{
						src: ["src/img", "src/_locales", "src/*.html"],
						dest: "build"
					}
				],
				verbose: true
			})
		]
	},
	{
		input: "src/css/options.css",
		output: {
			file: "build/css/options.css"
		},
		plugins: [
			postcss({
				extract: true,
				plugins: [env()]
			})
		]
	},
	{
		input: "src/css/popup.css",
		output: {
			file: "build/css/popup.css"
		},
		plugins: [
			postcss({
				extract: true,
				plugins: [env()]
			})
		]
	},
	{
		input: "src/css/sidebar.css",
		output: {
			file: "build/css/sidebar.css"
		},
		plugins: [
			postcss({
				extract: true,
				plugins: [env()]
			})
		]
	}
];
