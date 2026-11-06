const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'guide.json'), 'utf8'));
if (!Array.isArray(data.groups) || !data.groups.length || !Array.isArray(data.tools)) {
  throw new Error('講義資料格式有誤：需要 groups 與 tools。');
}
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
if (template.split('<!--CONFIG-->').length !== 2) throw new Error('網站版型缺少唯一的內容插入位置。');
const safeJSON = JSON.stringify(data).replace(/</g, '\\u003c');
let html = template.replace('<!--CONFIG-->', () => '<script>window.guideConfig=' + safeJSON + ';</script>');
const editor = fs.readFileSync(path.join(__dirname, 'editor-source.js'), 'utf8');
// 編輯器與網站一起封裝，網站儲存時改呼叫具登入權限的雲端資料庫。
const cloudEditor = 'const publicTemplate=' + JSON.stringify(template).replace(/</g, '\\u003c') + ';\n' + editor;
const cloudFiles = ['cloud.mjs', 'firebase-config.json', 'desktop-view.css', 'guide-data.mjs', 'guide-import.mjs', 'publish-bridge.mjs'];
const digest=crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(template).update(safeJSON).update(editor);
for(const file of cloudFiles)digest.update(fs.readFileSync(path.join(__dirname,file)));
const version=digest.digest('hex').slice(0,16);
html=html.replace('</title>','</title><meta name="guide-build" content="'+version+'">');
html += '<link rel="stylesheet" href="./desktop-view.css?v='+version+'"><script type="module" src="./cloud.mjs?v='+version+'"></script>';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(__dirname, 'dist', '.nojekyll'), '');
fs.writeFileSync(path.join(__dirname, 'dist', 'editor.js'), cloudEditor);
for (const file of cloudFiles) {
  let content=fs.readFileSync(path.join(__dirname,file),'utf8');
  if(file.endsWith('.mjs'))content=content.replace(/(from\s+['"])(\.\/[^'"]+\.mjs)(['"])/g,(_match,prefix,url,suffix)=>prefix+url+'?v='+version+suffix);
  if(file==='cloud.mjs')content=content.replace("script.src = './editor.js';","script.src = './editor.js?v="+version+"';");
  fs.writeFileSync(path.join(__dirname,'dist',file),content);
}
console.log('已產生免費靜態網站：dist/index.html');
console.log('網站程式版本：'+version);
