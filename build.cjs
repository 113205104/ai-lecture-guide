const fs = require('node:fs');
const path = require('node:path');
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
const cloudFiles = ['cloud.mjs', 'firebase-config.json', 'desktop-view.css'];
html += '<link rel="stylesheet" href="./desktop-view.css"><script type="module" src="./cloud.mjs"></script>';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(__dirname, 'dist', '.nojekyll'), '');
fs.writeFileSync(path.join(__dirname, 'dist', 'editor.js'), cloudEditor);
for (const file of cloudFiles) fs.copyFileSync(path.join(__dirname, file), path.join(__dirname, 'dist', file));
console.log('已產生免費靜態網站：dist/index.html');
