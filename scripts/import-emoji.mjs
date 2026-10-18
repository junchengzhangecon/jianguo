// Reproducible offline asset import; never executes upstream code.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/import-emoji.mjs /path/to/twemoji-source');
const images={};
for(const name of (await fs.readdir(path.join(source,'assets/svg'))).sort()){
  if(!/^[0-9a-f]+(?:-[0-9a-f]+)*\.svg$/.test(name))throw new Error('Unexpected asset: '+name);
  const svg=(await fs.readFile(path.join(source,'assets/svg',name),'utf8')).trim();
  if(!svg.startsWith('<svg')||/<(?:script|foreignObject|image)\b|\bon\w+\s*=|\bhref\s*=|url\((?!#[\w-]+\))/i.test(svg))throw new Error('Non-self-contained SVG: '+name);
  images[name.slice(0,-4)]=svg;
}
const data={version:'17.0.3',commit:'b6b55fef1e8636b540a6d016a4729ca8cdf2e60b',images};
await fs.writeFile(path.join(root,'emoji-data.js'),'// Generated Twemoji graphics, CC-BY-4.0. See LICENSES/Twemoji-NOTICE.md.\n(function(root){const data='+JSON.stringify(data)+';root.JianguoEmojiData=data;if(typeof module!=="undefined")module.exports=data;})(typeof globalThis!=="undefined"?globalThis:window);\n');
const license=(await fs.readFile(path.join(source,'LICENSE-GRAPHICS'),'utf8')).replace(/[\t ]+$/gm,'');
await fs.writeFile(path.join(root,'LICENSES/Twemoji-CC-BY-4.0.txt'),license);
console.log('Imported '+Object.keys(images).length+' self-contained SVG emoji');
