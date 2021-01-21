/* eslint-env node */

import {npath, xfs, ZipFS} from '@yarnpkg/fslib';
import {getLibzipPromise} from '@yarnpkg/libzip';

const cwd = process.cwd();

Promise.all([
  getLibzipPromise(),
  xfs.readFilePromise(npath.toPortablePath(process.argv[2])),
  xfs.mktempPromise(),
]).then(async ([libzip, buff, tmpDir]) => {
  const token = '\n### DATA ###\n';
  const dataStart = buff.indexOf(token) + token.length;
  const zip = new ZipFS(
    Buffer.from(buff.slice(dataStart).toString('utf8').trim(), 'base64'),
    {libzip, readOnly: true},
  );

  process.chdir(tmpDir);

  await xfs.copyPromise(tmpDir, '/', {baseFs: zip});
  await zip
    .readFilePromise('/.yarnrc.yml', 'utf8')
    .then(rc =>
      xfs.writeFilePromise(
        `${tmpDir}/.yarnrc.yml`,
        rc.replace(/%%YAR%%/g, '.'),
      ),
    );

  process.env.YARN_IGNORE_CWD = '1';
  process.env.YARN_IGNORE_PATH = '1';

  process.argv = [
    process.argv[0],
    `${tmpDir}/.yarn/releases/yar.cjs`,
    '--cwd',
    cwd,
    'sdlx',
    'run-yar',
    ...process.argv.slice(3),
  ];
  require(`${tmpDir}/.yarn/releases/yar.cjs`);
});
