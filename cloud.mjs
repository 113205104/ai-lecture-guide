import {setupPublishBridge} from './publish-bridge.mjs';
import {installGuideImport} from './guide-import.mjs';
// Spark 免費方案：不使用付費 Cloud Functions、Storage 或簡訊登入。
const panel = document.createElement('aside');
panel.className = 'guide-cloud-status';
panel.hidden = true;
const note = document.createElement('p');
note.setAttribute('role', 'status');
note.textContent = '正在讀取線上講義…';
const login = document.createElement('button');
login.textContent = '⚙';
login.className = 'guide-cloud-login';
login.setAttribute('aria-label', '講者登入');
login.title = '講者登入';
login.hidden = true;
panel.append(note);
document.body.prepend(panel, login);
let noticeTimer;
const showNotice = (text, temporary = false) => {
  clearTimeout(noticeTimer);
  note.textContent = text;
  panel.hidden = false;
  if (temporary) noticeTimer = setTimeout(() => { panel.hidden = true; }, 4500);
};
const message = error => {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return '帳號沒有編輯權限，請確認講者帳號與資料庫規則。';
  if (code.includes('resource-exhausted')) return '免費用量已達上限，請稍後再試；修改尚未送出。';
  if (code.startsWith('auth/')) return 'Google 登入未完成，請檢查帳號、允許登入視窗及網路。';
  return error?.message || '網路連線失敗，請稍後再試。';
};
const withDeadline = async (operation, label) => {
  let timer;
  try { return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+'超過 30 秒未回應，尚未更新線上內容。請重新開啟更新頁再試。')),30000);})]); }
  finally { clearTimeout(timer); }
};
let bridgeState = 'loading';
// 先接收本機訊息，再載入 Firebase；不能讓登入元件或資料庫讀取卡住握手。
const bridge = setupPublishBridge({
  getState:()=>bridgeState,
  login:()=>login.click(),
  save:(data,options)=>window.guideCloud.save(data,options),
  getCurrent:()=>window.guideCloud.current()
});
try {
  const configOperation=fetch('./firebase-config.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('無法讀取網站設定。');return response.json();});
  const [config,appModule,authModule,firestoreModule]=await withDeadline(Promise.all([
    configOperation,
    import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js')
  ]),'載入網站設定與登入元件');
  if (!config.apiKey || !config.projectId || !config.ownerEmail) {
    throw new Error('這是網站準備版，尚未完成免費雲端設定。目前顯示檔案內的講義，還不能跨裝置儲存。');
  }
  const {initializeApp}=appModule;
  const {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut}=authModule;
  const {getFirestore,doc,getDocFromServer,runTransaction,serverTimestamp}=firestoreModule;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const isOwner = user => Boolean(user && user.emailVerified && user.email === config.ownerEmail
    && user.providerData.some(provider => provider.providerId === 'google.com')
    && (!config.ownerUid || user.uid === config.ownerUid));
  const database = getFirestore(app);
  const ref = doc(database, 'guides', 'lecture');
  let revision = 0;
  let editorLoaded = false;
  const apply = snapshot => {
    if (!snapshot.exists()) return;
    const data = JSON.parse(snapshot.data().payload);
    if (!Array.isArray(data.groups) || !Array.isArray(data.tools)) throw new Error('雲端講義格式有誤。');
    revision = snapshot.data().revision;
    window.guideData = data;
    window.refreshGuide(data, data.position);
  };
  apply(await withDeadline(getDocFromServer(ref),'讀取雲端講義'));
  note.textContent = '已讀取雲端講義。';
  login.hidden = false;
  login.onclick = async () => {
    try {
      if (auth.currentUser) {
        if (document.body.classList.contains('guide-editing') && !confirm('尚有編輯中的內容。確定要登出嗎？')) return;
        await signOut(auth); location.reload();
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ login_hint: config.ownerEmail, prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      }
    } catch (error) { showNotice(message(error)); }
  };
  onAuthStateChanged(auth, async user => {
    login.textContent = user ? '登出' : '⚙';
    login.setAttribute('aria-label', user ? '登出' : '講者登入');
    if (!user) { bridgeState='signed-out'; bridge.refresh(); return; }
    if (!isOwner(user)) { bridgeState='other'; showNotice('目前帳號可閱讀，沒有講者編輯權限。'); bridge.refresh(); return; }
    try {
      // 登入後再次拿最新版，儲存以版本號檢查其他裝置的修改。
      apply(await withDeadline(getDocFromServer(ref),'確認講者的雲端版本'));
      window.guideCloud = {
        current:()=>({revision,data:structuredClone(window.guideData)}),
        async save(data, options = {}) {
          if (!isOwner(auth.currentUser)) throw new Error('請先登入講者帳號。');
          const payload = JSON.stringify(data);
          const expectedRevision = options.expectedRevision ?? revision;
          if (expectedRevision !== revision) throw new Error('本機與線上版本不同，請先確認要保留的版本。');
          if (new TextEncoder().encode(payload).length >= 900000) throw new Error('講義含圖片的大小超過儲存上限，請先縮小圖片。');
          showNotice('正在儲存到雲端…');
          try {
            await runTransaction(database, async transaction => {
              const current = await transaction.get(ref);
              const remoteRevision = current.exists() ? current.data().revision : 0;
              if (remoteRevision !== expectedRevision) throw new Error('另一台裝置已更新講義。請先匯出目前修改備份，再重新整理後編輯，避免覆蓋。');
              transaction.set(ref, { payload, revision: expectedRevision + 1, updatedAt: serverTimestamp() });
            });
            revision = expectedRevision + 1;
            window.guideData = structuredClone(data);
            showNotice('已儲存到雲端，其他裝置重新開啟即可讀取。', true);
            return {revision};
          } catch (error) { showNotice('尚未儲存到雲端。'); throw new Error(message(error)); }
        }
      };
      if (!editorLoaded) {
        const script = document.createElement('script'); script.src = './editor.js';
        await withDeadline(new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('編輯器載入失敗，請重新整理。')); document.body.append(script); }),'載入講義編輯器');
        editorLoaded = true;
      }
      login.classList.remove('guide-cloud-login');
      document.getElementById('guide-menu').append(login);
      installGuideImport({menu:document.getElementById('guide-menu'),save:data => window.guideCloud.save(data)});
      panel.hidden = true;
      bridgeState='owner';
      bridge.refresh();
    } catch (error) { bridgeState='error';showNotice(message(error));bridge.fail(message(error)); }
  });
} catch (error) { bridgeState='error';showNotice(message(error));bridge.fail(message(error)); }
