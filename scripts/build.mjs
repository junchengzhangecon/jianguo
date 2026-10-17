import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');await fs.mkdir(out,{recursive:true});
const assets=await fs.readdir(path.join(root,'assets'));await fs.mkdir(path.join(out,'assets'),{recursive:true});
for(const name of assets)await fs.copyFile(path.join(root,'assets',name),path.join(out,'assets',name));
for(const name of ['index.html','styles.css','core.js','app.js','sw.js','manifest.webmanifest'])await fs.copyFile(path.join(root,name),path.join(out,name));
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const font=(await fs.readFile(path.join(root,'assets/pixel.woff2'))).toString('base64');
const css=(await fs.readFile(path.join(root,'styles.css'),'utf8')).replace('assets/pixel.woff2','data:font/woff2;base64,'+font);
const icon=(await fs.readFile(path.join(root,'assets/icon.svg'))).toString('base64');
let standalone=html.replace(/<link rel="manifest"[^>]+>/,'').replace('href="assets/icon.svg"','href="data:image/svg+xml;base64,'+icon+'"').replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>');
async function licenseTexts(folder){let result='';for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);result+=entry.isDirectory()?await licenseTexts(file):'\n'+path.relative(root,file)+'\n'+await fs.readFile(file,'utf8');}return result;}
const licenses=(await fs.readFile(path.join(root,'LICENSE'),'utf8'))+'\nFusion Pixel Font 2026.10.16 — https://github.com/TakWolf/fusion-pixel-font\n'+await licenseTexts(path.join(root,'LICENSES'));
standalone=standalone.replace('<html lang="zh-CN">','<!--\n'+licenses.replace(/-->/g,'-- >')+'\n-->\n<html lang="zh-CN">');
for(const name of ['core.js','app.js']){const js=await fs.readFile(path.join(root,name),'utf8');standalone=standalone.replace('<script src="'+name+'"></script>','<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>');}
await fs.writeFile(path.join(out,'坚果像素屏-离线版.html'),standalone);
// GitHub Pages publishes main/root without requiring OAuth workflow permissions.
await fs.writeFile(path.join(root,'坚果像素屏-离线版.html'),standalone);
await fs.cp(path.join(root,'LICENSES'),path.join(out,'LICENSES'),{recursive:true});
await fs.copyFile(path.join(root,'README.md'),path.join(out,'使用说明.md'));
await fs.copyFile(path.join(root,'LICENSE'),path.join(out,'LICENSE'));
console.log('构建完成：dist/（网页）及 dist/坚果像素屏-离线版.html（单文件离线）');
