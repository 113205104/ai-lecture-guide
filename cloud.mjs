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
try {
  const response = await fetch('./firebase-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('無法讀取網站設定。');
  const config = await response.json();
  if (!config.apiKey || !config.projectId || !config.ownerEmail) {
    throw new Error('這是網站準備版，尚未完成免費雲端設定。目前顯示檔案內的講義，還不能跨裝置儲存。');
  }
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js');
  const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js');
  const { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
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
  apply(await getDocFromServer(ref));
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
  const {setupPublishBridge} = await import('./publish-bridge.mjs');
  const bridge = setupPublishBridge({
    getState: () => !auth.currentUser ? 'signed-out' : isOwner(auth.currentUser) && window.guideCloud ? 'owner' : 'other',
    login: () => login.click(),
    save: data => window.guideCloud.save(data)
  });
  onAuthStateChanged(auth, async user => {
    login.textContent = user ? '登出' : '⚙';
    login.setAttribute('aria-label', user ? '登出' : '講者登入');
    if (!user) { bridge.refresh(); return; }
    if (!isOwner(user)) { showNotice('目前帳號可閱讀，沒有講者編輯權限。'); bridge.refresh(); return; }
    try {
      // 登入後再次拿最新版，儲存以版本號檢查其他裝置的修改。
      apply(await getDocFromServer(ref));
      window.guideCloud = {
        async save(data) {
          if (!isOwner(auth.currentUser)) throw new Error('請先登入講者帳號。');
          const payload = JSON.stringify(data);
          if (new TextEncoder().encode(payload).length >= 900000) throw new Error('講義含圖片的大小超過儲存上限，請先縮小圖片。');
          showNotice('正在儲存到雲端…');
          try {
            await runTransaction(database, async transaction => {
              const current = await transaction.get(ref);
              const remoteRevision = current.exists() ? current.data().revision : 0;
              if (remoteRevision !== revision) throw new Error('另一台裝置已更新講義。請先匯出目前修改備份，再重新整理後編輯，避免覆蓋。');
              transaction.set(ref, { payload, revision: revision + 1, updatedAt: serverTimestamp() });
            });
            revision += 1;
            showNotice('已儲存到雲端，其他裝置重新開啟即可讀取。', true);
          } catch (error) { showNotice('尚未儲存到雲端。'); throw new Error(message(error)); }
        }
      };
      if (!editorLoaded) {
        const script = document.createElement('script'); script.src = './editor.js';
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('編輯器載入失敗，請重新整理。')); document.body.append(script); });
        editorLoaded = true;
      }
      login.classList.remove('guide-cloud-login');
      document.getElementById('guide-menu').append(login);
      const {installGuideImport} = await import('./guide-import.mjs');
      installGuideImport({menu:document.getElementById('guide-menu'),save:data => window.guideCloud.save(data)});
      panel.hidden = true;
      bridge.refresh();
    } catch (error) { showNotice(message(error)); }
  });
} catch (error) { showNotice(message(error)); }
