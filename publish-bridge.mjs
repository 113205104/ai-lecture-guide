import {validateGuide} from './guide-data.mjs';
// 本機檔案不持有 Firebase 登入憑證；由 HTTPS 更新頁核對講者身分並儲存。
// 除了 opener 與隨機通道，還需每個瀏覽器首次由講者明確核准的配對密鑰。
export function setupPublishBridge({getState, login, save}) {
  if (!new URLSearchParams(location.search).has('update')) return {refresh() {}};
  const channel = new URLSearchParams(location.hash.slice(1)).get('channel');
  const source = window.opener;
  const dialog = document.createElement('dialog'); dialog.className = 'guide-transfer-dialog';
  const title = document.createElement('h2'); title.textContent = '更新線上講義';
  const text = document.createElement('p'); text.setAttribute('role','status'); text.textContent = '正在接收本機匯出的講義…';
  const signIn = document.createElement('button'); signIn.textContent = '使用 Google 帳號登入'; signIn.hidden = true; signIn.onclick = login;
  const allow = document.createElement('button'); allow.textContent = '允許此本機編輯器更新講義'; allow.hidden = true;
  const view = document.createElement('button'); view.textContent = '開啟線上講義'; view.hidden = true; view.onclick = () => location.replace(location.pathname);
  dialog.append(title,text,signIn,allow,view); document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('cancel', event => event.preventDefault());
  if (!source || !channel || !/^[a-f0-9-]{20,100}$/i.test(channel)) { text.textContent = '請從本機講義按「匯出」，再由開啟的更新頁繼續。'; view.hidden = false; return {refresh() {}}; }
  const storeKey = 'lecture-guide-publish-pairs-v1';
  let data, credentials, busy = false, complete = false;
  const send = message => source.postMessage({type:'guide-sync',channel,...message}, '*');
  const readPairs = () => { try { return JSON.parse(localStorage.getItem(storeKey)) || {}; } catch { return {}; } };
  const paired = () => credentials?.id && credentials?.secret && readPairs()[credentials.id] === credentials.secret;
  const refresh = async () => {
    if (!data || busy || complete) return;
    const state = getState();
    signIn.hidden = state === 'owner'; allow.hidden = true;
    if (state !== 'owner') { text.textContent = state === 'signed-out' ? '請登入講者 Google 帳號。登入後即可繼續更新。' : '目前帳號沒有編輯權限，請切換為講者帳號。'; return; }
    if (!paired()) {
      text.textContent = '首次使用：允許目前開啟本頁的本機講義編輯器，在你保持登入時自動更新這份講義。其他編輯器仍需另行確認。';
      allow.hidden = false; return;
    }
    busy = true; text.textContent = '正在更新線上講義…';
    try {
      await save(data); complete = true; text.textContent = '已更新到線上。其他裝置重新開啟講義即可讀取最新版。'; view.hidden = false;
      send({action:'complete'});
    } catch (error) { text.textContent = '更新未完成：'+error.message+' 本機 HTML 備份仍然保留。'; send({action:'error',message:error.message}); }
  };
  allow.onclick = () => {
    if (getState() !== 'owner') return;
    try {
      credentials = {id:crypto.randomUUID(), secret:crypto.randomUUID()+crypto.randomUUID()};
      const pairs = readPairs(); pairs[credentials.id] = credentials.secret;
      localStorage.setItem(storeKey, JSON.stringify(pairs));
      send({action:'paired', credentials}); allow.hidden = true; refresh();
    } catch { text.textContent = '瀏覽器無法保存此編輯器的授權，請允許本站使用本機儲存空間後再試。'; }
  };
  window.addEventListener('message', event => {
    if (event.source !== source || event.origin !== 'null' || event.data?.type !== 'guide-sync' || event.data.channel !== channel || complete) return;
    if (event.data.action === 'cancel') { complete = true; allow.hidden = true; signIn.hidden = true; text.textContent = '這次更新已取消，請使用最新開啟的更新頁。'; view.hidden = false; return; }
    if (event.data.action !== 'publish' || busy) return;
    try { data = validateGuide(event.data.guide); credentials = event.data.credentials; refresh(); }
    catch (error) { text.textContent = error.message; send({action:'error',message:error.message}); }
  });
  send({action:'ready'});
  return {refresh};
}
