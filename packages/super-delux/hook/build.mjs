import {pnpPlugin} from '@yarnpkg/esbuild-plugin-pnp';
import {build} from 'esbuild';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

build({
  entryPoints: [join(dir, 'index.js')],
  outfile: join(dir, 'input.min.js'),

  plugins: [pnpPlugin()],
  bundle: true,
  minify: true,
  target: 'node14',
  format: 'cjs',

  write: true,
});
