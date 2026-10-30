import { string } from 'rollup-plugin-string';
import terser from '@rollup/plugin-terser';
import getBabelOutputPlugin from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';

const plugins = () => [
        json(),
        string({
            include: "**/*.css",
        }),
        nodeResolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs({
            include: [/node_modules/, /mods/],
            transformMixedEsModules: true,
        }),
        getBabelOutputPlugin({
            babelHelpers: 'bundled',
            presets: [
                ['@babel/preset-env', {
                    targets: 'Chrome 47',
                }],
            ],
        }),
        terser({
            ecma: '5',
            mangle: true,
        }),
        replace({
            '\uFFFF': '\u0000',
        })
];

export default [
    { input: "userScript.js", output: { file: "../dist/userScript.js", format: "iife" }, plugins: plugins() },
    // Debug APKs only: TizenTube plus the development console (dev/devConsole.js).
    { input: "debugEntry.js", output: { file: "../dbgs/userScript.js", format: "iife" }, plugins: plugins() },
];