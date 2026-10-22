import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
await mkdir('public/vendor', { recursive: true });
await copyFile('node_modules/three/build/three.min.js', 'public/vendor/three.min.js');
await copyFile('node_modules/three/LICENSE', 'public/vendor/three-LICENSE.txt');
for (const name of ['core','cake','scrapbook','notes','main']) {
  new Script(await readFile(`public/js/${name}.js`, 'utf8'), { filename: `${name}.js` });
}
const html = await readFile('public/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\/(?:js|css|vendor)\/[^"?#]+)"/g)) await readFile(`public${match[1]}`);
console.log('Static files ready; all browser scripts parse and local assets exist.');
