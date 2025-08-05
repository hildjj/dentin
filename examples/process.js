import {Dentin} from '../lib/dentin.js';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const __dirname = fileURLToPath(new URL('./', import.meta.url));

const opts = JSON.parse(
  await fs.readFile(path.resolve(__dirname, '../.dentin.json'), 'utf8')
);

(async () => {
  const dir = (await fs.readdir(__dirname))
    .filter(x => x.endsWith('.xml') || x.endsWith('.html'));
  for (const fn of dir) {
    const f = path.join(__dirname, fn);
    const str = await Dentin.dentFile(f, {
      ...opts,
      colors: false,
      periodSpaces: 2,
    });
    await fs.writeFile(`${f}.out`, str, 'utf8');
  }
})();

