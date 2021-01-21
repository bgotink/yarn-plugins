import commonJs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';

export default {
  input: 'index.js',
  output: {
    file: 'input.min.js',
    format: 'cjs',
  },
  plugins: [nodeResolve(), commonJs(), terser()],
};
