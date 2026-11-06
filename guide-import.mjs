import {parseGuide} from './guide-data.mjs';
export function installGuideImport({menu, save}) {
  if (menu.querySelector('[data-guide-import]')) return;
  const button = document.createElement('button'); button.textContent = '匯入講義'; button.dataset.guideImport = '';
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.html,.htm,.json'; input.hidden = true;
  document.body.append(input); menu.append(button);
  button.onclick = () => { menu.hidden = true; document.querySelector('#gear')?.setAttribute('aria-expanded','false'); input.value = ''; input.click(); };
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const dialog = document.createElement('dialog'); dialog.className = 'guide-transfer-dialog';
    const title = document.createElement('h2'); title.textContent = '匯入本機講義';
    const info = document.createElement('p'); const status = document.createElement('p'); status.setAttribute('role','status');
    const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.onclick = () => { dialog.close(); dialog.remove(); };
    const confirm = document.createElement('button'); confirm.textContent = '更新線上講義';
    dialog.append(title,info,status,cancel,confirm); document.body.append(dialog); dialog.showModal();
    try {
      if (file.size > 2000000) throw new Error('檔案過大，請確認選擇的是講義匯出檔。');
      const data = parseGuide(await file.text());
      info.textContent = '檔案：'+file.name+'。更新後會以其中的內容與樣式取代目前線上講義。';
      confirm.onclick = async () => {
        confirm.disabled = true; cancel.disabled = true; status.textContent = '正在更新…';
        try { await save(data); location.reload(); }
        catch (error) { status.textContent = error.message; confirm.disabled = false; cancel.disabled = false; }
      };
    } catch (error) { status.textContent = error.message; confirm.hidden = true; }
  };
}
