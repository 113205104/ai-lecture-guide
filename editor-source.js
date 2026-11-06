if(location.protocol==='file:'||window.guideCloud){
 if(location.protocol==='file:')document.title='講座互動指南｜本機同步版';
 let draft=structuredClone(window.guideData),target=null,editing=false;
 const sectionModel=window.GuideSections;
 const draftKey=window.guideBackupKey||'lecture-guide-draft-v1';
 const syncKey='lecture-guide-sync-state-v1';
 let syncState;
 try{syncState=JSON.parse(localStorage.getItem(syncKey));}catch{}
 syncState??=window.guideSyncSeed;
 const fingerprint=data=>{
  const {position,...content}=data;
  return JSON.stringify(content,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
   ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
 };
 const past=[],future=[];
 let last=JSON.stringify(draft);
 const record=()=>{const next=JSON.stringify(draft);if(next!==last){past.push(last);future.length=0;last=next;}};
 const gear=document.createElement('button');
 gear.id='gear';gear.textContent='⚙';gear.setAttribute('aria-label','設定');
 const menu=document.createElement('div');menu.id='guide-menu';menu.hidden=true;
 const edit=document.createElement('button');edit.textContent='編輯內容';
 const share=document.createElement('button');share.textContent='分享連結';
 const appearance=document.createElement('button');appearance.textContent='外觀設定';
 menu.append(edit,appearance,share);
 const closeMenu=()=>{menu.hidden=true;gear.setAttribute('aria-expanded','false');};
 gear.setAttribute('aria-expanded','false');
 gear.onclick=()=>{menu.hidden=!menu.hidden;gear.setAttribute('aria-expanded',String(!menu.hidden));};
 document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!gear.contains(e.target))closeMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
 const editor=document.createElement('dialog');editor.id='editor';editor.setAttribute('aria-label','編輯項目');
 // 手機縮放桌面講義時，彈窗仍以實際可見視窗計算大小。
 const sizeEditorViewport=()=>{
  const viewport=window.visualViewport;
  editor.style.setProperty('--guide-editor-viewport-width',(viewport?.width??window.innerWidth)+'px');
  editor.style.setProperty('--guide-editor-viewport-height',(viewport?.height??window.innerHeight)+'px');
 };
 sizeEditorViewport();
 window.addEventListener('resize',sizeEditorViewport);
 window.visualViewport?.addEventListener('resize',sizeEditorViewport);
 document.body.prepend(gear,menu,editor);
 const saveNotice=document.createElement('p');saveNotice.id='guide-save-notice';saveNotice.setAttribute('role','status');saveNotice.hidden=true;document.body.append(saveNotice);
 let noticeTimer;
 new MutationObserver(()=>{
  clearTimeout(noticeTimer);
  if(saveNotice.hidden||saveNotice.querySelector('button'))return;
  if(/正在|請在更新頁|首次|未完成|失敗|無法|未收到|未確認|逾時|超過|內容不同|目前離線/.test(saveNotice.textContent))return;
  noticeTimer=setTimeout(()=>{saveNotice.hidden=true;},5000);
 }).observe(saveNotice,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
 const downloadGuide=(data,name='index.html')=>{
  const json=JSON.stringify(data).replace(/</g,'\\u003c');
  const html=publicTemplate.replace('<!--CONFIG-->',()=>'<script>window.guideConfig='+json+';</scr'+'ipt>');
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const rememberRevision=(revision,data)=>{
  syncState={revision,fingerprint:fingerprint(data)};
  try{localStorage.setItem(syncKey,JSON.stringify(syncState));localStorage.setItem(draftKey,JSON.stringify(draft));}catch{}
 };
 let checkingCloud=false;
 const loadCloudDraft=(data,revision)=>{
  draft=structuredClone(data);last=JSON.stringify(draft);past.length=0;future.length=0;
  editing=false;target=null;historyControls.hidden=true;edit.hidden=false;
  document.body.classList.remove('guide-editing');if(editor.open)editor.close();
  window.guideData=structuredClone(draft);rememberRevision(revision,draft);
  refresh(draft.position||{group:0,page:0});
  saveNotice.textContent='已載入線上最新版，本機草稿也已更新。';saveNotice.hidden=false;
 };
 const checkForCloud=async()=>{
  if(location.protocol!=='file:'||checkingCloud||document.hidden)return;
  checkingCloud=true;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const url='https://firestore.googleapis.com/v1/projects/ai-lecture-guide/databases/(default)/documents/guides/lecture';
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)return;
   const documentData=await response.json();
   const data=JSON.parse(documentData.fields.payload.stringValue);
   const revision=Number(documentData.fields.revision.integerValue);
   if(!Number.isInteger(revision)||!Array.isArray(data.groups)||!Array.isArray(data.tools)||!data.labels)return;
   const remote=fingerprint(data),local=fingerprint(draft);
   if(local===remote){rememberRevision(revision,data);return;}
   if(syncState?.revision===revision)return;
   if(syncState?.fingerprint===local&&!editing&&!editor.open){loadCloudDraft(data,revision);return;}
   saveNotice.textContent='線上與本機內容不同，已保留兩邊版本，沒有自動覆蓋。';saveNotice.hidden=false;
   const useCloud=document.createElement('button');useCloud.textContent='備份本機，再載入線上最新版';
   useCloud.onclick=()=>{downloadGuide(draft,'本機講義-載入線上前備份.html');loadCloudDraft(data,revision);};
   const keepLocal=document.createElement('button');keepLocal.textContent='保留本機，稍後按匯出更新';
   keepLocal.onclick=()=>{saveNotice.textContent='已保留本機內容。匯出時會再次檢查線上版本，更新前可先備份線上。';};
   saveNotice.append(document.createElement('br'),useCloud,keepLocal);
  }catch{
   if(!navigator.onLine){saveNotice.textContent='目前離線，使用本機草稿。恢復連線後會重新檢查線上版本。';saveNotice.hidden=false;}
  }finally{clearTimeout(timeout);checkingCloud=false;}
 };
 let saving=false;
 const finish=async()=>{
  if(saving)return;
  saving=true;
  saveNotice.hidden=true;
  try{
   const root=document.querySelector('.lecture-mock');
   const next=structuredClone(draft);
   next.position={group:Number(root.dataset.group),page:Number(root.dataset.subpage)};
   if(window.guideCloud)await window.guideCloud.save(next);
   else localStorage.setItem(draftKey,JSON.stringify(next));
   draft=next;
   last=JSON.stringify(draft);
   past.length=0;future.length=0;
   editing=false;target=null;historyControls.hidden=true;
   edit.hidden=false;
   root.querySelectorAll('.guide-card-order,.guide-card-changed').forEach(element=>{
    if(element.matches('.guide-card-order'))element.remove();
    else element.classList.remove('guide-card-changed');
   });
   document.body.classList.remove('guide-editing');closeMenu();
   refresh();
  }catch(error){
   saveNotice.textContent=(window.guideCloud?'尚未儲存到雲端，修改仍留在編輯模式。':'瀏覽器無法儲存，修改仍留在編輯模式。')+error.message;
   saveNotice.hidden=false;
  }finally{saving=false;}
 };
 const openEditor=()=>{status.textContent='';renderEditor();if(!editor.open)editor.showModal();};
 const start=()=>{
  editing=true;edit.hidden=true;historyControls.hidden=false;
  document.body.classList.add('guide-editing');
  addCardOrderControls();
  addPageOrderControls();
  if(target)openEditor();
 };
 edit.onclick=()=>{
  closeMenu();
  if(editing){finish();return;}
  target=null;start();
 };
 appearance.onclick=()=>{closeMenu();target={kind:'appearance'};start();};
 const bar=document.createElement('div');bar.id='bar';
 const form=document.createElement('div');
 const status=document.createElement('p');status.setAttribute('role','status');
 const title=document.createElement('h2');title.textContent='編輯項目';
 const footer=document.createElement('div');footer.className='editor-footer';
 editor.append(title,bar,status,form,footer);
 const action=(parent,label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;parent.append(b);return b;};
 editor.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled)return;
  button.classList.add('guide-clicked');
  clearTimeout(button.guideFeedbackTimer);
  button.guideFeedbackTimer=setTimeout(()=>button.classList.remove('guide-clicked'),220);
 },true);
 document.addEventListener('click',e=>{
  if(!editing||e.target.closest('.guide-card-order,.guide-page-drag'))return;
  const root=e.target.closest('.lecture-mock');
  if(!root)return;
  const group=Number(root.dataset.group),page=Number(root.dataset.subpage);
  const card=e.target.closest('article');
  const section=e.target.closest('.guide-section-heading');
  if(section){
   e.preventDefault();e.stopPropagation();
   target={kind:'section',group,page,index:Number(section.dataset.section),sectionId:section.dataset.sectionId};
   openEditor();
   return;
  }
  if(card&&!e.target.closest('summary,[data-copy]')){
   target=card.dataset.tool!==undefined?{kind:'tool',index:Number(card.dataset.tool)}:{kind:'card',group,page,index:Number(card.dataset.card)};
  }else if(e.target.closest('header,footer'))target={kind:'labels'};
  else if(e.target.closest('h2,.lg-intro,nav,.lg-filter-options'))target={kind:'page',group,page};
  else return;
  if(card||e.target.closest('header,footer,h2,.lg-intro')){e.preventDefault();e.stopPropagation();}
  queueMicrotask(()=>{if(!card){target.group=Number(root.dataset.group);target.page=Number(root.dataset.subpage);}openEditor();});
 },true);
 const dialog=document.createElement('dialog');dialog.id='guide-share';
 dialog.innerHTML='<h2>分享連結</h2><label>公開講義網址<input type="url" placeholder="https://…"></label><p role="status"></p>';
 document.body.append(dialog);
 const urlInput=dialog.querySelector('input'),notice=dialog.querySelector('p');
 share.onclick=()=>{closeMenu();try{urlInput.value=localStorage.getItem('lecture-guide-public-url')||'';}catch{}notice.textContent=urlInput.value?'':'發布後，將公開網址貼在這裡。';dialog.showModal();};
 action(dialog,'複製連結',async()=>{
  const url=safeUrl(urlInput.value);
  if(!url){notice.textContent='請先填入已發布的公開網址。';return;}
  try{localStorage.setItem('lecture-guide-public-url',url);}catch{}
  try{await navigator.clipboard.writeText(url);notice.textContent='已複製連結。';}
  catch{urlInput.focus();urlInput.select();notice.textContent='請按 Ctrl + C 複製選取的網址。';}
 });
 action(dialog,'關閉',()=>dialog.close());
 const clean=html=>{
  const template=document.createElement('template');template.innerHTML=html;
  for(const el of Array.from(template.content.querySelectorAll('*'))){
   if(!['B','I','U','STRONG','EM','SPAN','FONT','DIV','BR','P','UL','OL','LI','S','STRIKE','A','IMG'].includes(el.tagName)){el.replaceWith(document.createTextNode(el.textContent));continue;}
   const href=safeUrl(el.getAttribute('href')),src=el.getAttribute('src')||'',imageWidth=el.style.width;
   const styles=['color','fontSize','fontWeight','fontStyle','textDecoration'].map(k=>[k,el.style[k]]);
   const color=el.getAttribute('color'),size=el.getAttribute('size');
   for(const a of Array.from(el.attributes))el.removeAttribute(a.name);
   if(el.tagName==='A'&&href){el.href=href;el.target='_blank';el.rel='noopener noreferrer';}
   if(el.tagName==='IMG'){if(/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src)||safeUrl(src)){el.src=src;el.alt='講義圖片';el.style.maxWidth='100%';el.style.height='auto';if(/^\d+%$/.test(imageWidth))el.style.width=imageWidth;}else{el.remove();continue;}}
   for(const [key,value] of styles)if(value)el.style[key]=value;
   if(color)el.style.color=color;
   if(size)el.style.fontSize=([10,13,16,18,24,32,48][Number(size)-1]||16)+'px';
  }
  return template.innerHTML;
 };
 const field=(parent,label,value,change,type='rich')=>{
  const wrap=document.createElement('label');wrap.append(document.createTextNode(label));parent.append(wrap);
  const input=document.createElement(type==='rich'?'div':'input');wrap.append(input);
  if(type==='rich'){input.className='field';input.contentEditable='true';input.setAttribute('aria-label',label);input.innerHTML=clean(value);input.oninput=()=>change(clean(input.innerHTML));}
  else{input.type=type;input.value=value;input.oninput=()=>change(input.value);}
 };
 const box=(parent,title)=>{const f=document.createElement('fieldset');const l=document.createElement('legend');l.textContent=title;f.append(l);parent.append(f);return f;};
 const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 function cardOrder(parent,list,index,order=list.map((_,i)=>i)){
  const controls=document.createElement('div');
  controls.className='guide-card-order';
  parent.append(controls);
  const position=order.indexOf(index);
  action(controls,'複製卡片',()=>{
   const copy=structuredClone(list[index]);
   if(list===draft.tools){
    let suffix=1;
    do{copy[0]=list[index][0]+'（副本 '+suffix+++'）';}
    while(list.some(other=>other[0]===copy[0]));
    draft.toolCategories[copy[0]]=[...(draft.toolCategories[list[index][0]]||[])];
    list.splice(index+1,0,copy);
   }else{
    const page=draft.groups.flatMap(group=>group.pages||[]).find(page=>page.items===list);
    sectionModel.duplicate(page,index);
   }
   showCardChange(list,index+1,index,'已複製卡片，副本放在原卡片後方。');
  });
  for(const [label,offset] of [['上移',-1],['下移',1]]){
   const destination=order[position+offset];
   action(controls,label,()=>{
    if(destination===undefined)return;
    const [card]=list.splice(index,1);
    list.splice(destination,0,card);
    showCardChange(list,destination,destination,'已'+label+'卡片，目前在第 '+(position+offset+1)+' 張。');
   }).disabled=destination===undefined;
  }
  controls.addEventListener('click',event=>event.stopPropagation());
 }
 function addCardOrderControls(){
  if(!editing)return;
  const root=document.querySelector('.lecture-mock');
  const page=draft.groups[root.dataset.group]?.pages?.[root.dataset.subpage];
  if(!page)return;
  const cards=Array.from(root.querySelectorAll('.lg-grid article'));
  const key=page.catalog?'tool':'card';
  const list=page.catalog?draft.tools:page.items;
  const order=cards.map(card=>Number(card.dataset[key]));
  cards.forEach((card,index)=>{
   if(!card.querySelector('.guide-card-order'))cardOrder(card,list,order[index],order);
  });
 }
 document.addEventListener('guide-rendered',addCardOrderControls);
 let draggedPage=null;
 function movePage(groupIndex,sourceIndex,destinationIndex){
  const pages=draft.groups[groupIndex].pages;
  if(sourceIndex===destinationIndex||destinationIndex<0||destinationIndex>=pages.length)return;
  const root=document.querySelector('.lecture-mock');
  const selectedPage=pages[Number(root.dataset.subpage)];
  const editedPage=target?.group===groupIndex?pages[target.page]:null;
  const [page]=pages.splice(sourceIndex,1);
  pages.splice(destinationIndex,0,page);
  if(editedPage)target.page=pages.indexOf(editedPage);
  const position={group:groupIndex,page:pages.indexOf(selectedPage)};
  if(!editor.open)record();
  refresh(position);
  const message='子分頁已移到第 '+(destinationIndex+1)+' 個位置。';
  if(editor.open){renderEditor();status.textContent=message;}
  else{saveNotice.textContent=message;saveNotice.hidden=false;}
 }
 function addPageOrderControls(){
  if(!editing)return;
  const root=document.querySelector('.lecture-mock');
  const group=Number(root.dataset.group);
  const tabs=root.querySelectorAll('[data-page-tabs] > [data-page-index]');
  const clear=()=>tabs.forEach(tab=>tab.classList.remove('guide-drop-before','guide-drop-after'));
  tabs.forEach(tab=>{
   if(tab.querySelector('.guide-page-drag'))return;
   const index=Number(tab.dataset.pageIndex);
   const handle=document.createElement('span');
   handle.className='guide-page-drag';handle.textContent='⠿';
   handle.draggable=true;
   handle.title='拖曳調整子分頁順序，也可點選子分頁後使用前移、後移';
   handle.setAttribute('aria-label','拖曳調整子分頁順序');
   handle.onclick=event=>event.stopPropagation();
   handle.ondragstart=event=>{
    draggedPage={group,index};
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',String(index));
   };
   handle.ondragend=()=>{draggedPage=null;clear();};
   const after=event=>event.clientX>tab.getBoundingClientRect().left+tab.getBoundingClientRect().width/2;
   tab.ondragover=event=>{
    if(!editing||draggedPage?.group!==group)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';clear();
    tab.classList.add(after(event)?'guide-drop-after':'guide-drop-before');
   };
   tab.ondragleave=()=>tab.classList.remove('guide-drop-before','guide-drop-after');
   tab.ondrop=event=>{
    if(!editing||draggedPage?.group!==group)return;
    event.preventDefault();event.stopPropagation();
    const source=draggedPage.index;
    const insertion=index+(after(event)?1:0);
    draggedPage=null;clear();
    movePage(group,source,insertion-(source<insertion?1:0));
   };
   tab.prepend(handle);
  });
 }
 document.addEventListener('guide-rendered',addPageOrderControls);
 function showCardChange(list,index,editingIndex,message){
  const keepEditorOpen=editor.open;
  if(keepEditorOpen)target.index=editingIndex;
  else record();
  refresh();
  const card=document.querySelector('.lecture-mock article[data-'+(list===draft.tools?'tool':'card')+'="'+index+'"]');
  if(card){
   card.classList.add('guide-card-changed');
   if(!keepEditorOpen){
    card.tabIndex=-1;
    card.focus({preventScroll:true});
    card.scrollIntoView({block:'nearest'});
   }
  }
  if(keepEditorOpen){
   renderEditor();
   status.textContent=message;
  }else{
   saveNotice.textContent=message;
   saveNotice.hidden=false;
  }
 }
 function renderEditor(){
  form.replaceChildren();
  selection=null;activeField=null;
  if(target?.kind==='section'){
   const page=draft.groups[target.group]?.pages?.[target.page];
   if(!page)return;
   const selected=sectionModel.find(page,target.sectionId)||sectionModel.read(page).find(section=>section.start===target.index&&section.title!==null);
   if(!selected)return;
   target.sectionId=selected.id;target.index=selected.start;
   const index=selected.start;
   const section=box(form,'分區設定');
   const currentTitle=selected.title??'';
   if(selected.title!==null)field(section,'副標題',currentTitle,value=>sectionModel.update(page,selected.id,{title:value}));
   const layouts=box(section,'卡片排版');
   for(let columns=1;columns<=4;columns++){
    const button=action(layouts,'每列 '+columns+' 張',()=>{
     sectionModel.update(page,selected.id,{columns});
     renderEditor();
    });
    button.setAttribute('aria-pressed',String((selected.columns??page.columns??1)===columns));
   }
   const cards=box(section,'此分區卡片');
   if(!selected.count){const empty=document.createElement('p');empty.textContent='此分區目前沒有卡片。';cards.append(empty);}
   for(let cardIndex=selected.start;cardIndex<selected.end;cardIndex++){
    const row=document.createElement('div');
    const label=document.createElement('span');label.innerHTML=clean(page.items[cardIndex][1]);row.append(label);cards.append(row);
    const remove=action(row,'刪除卡片',()=>{sectionModel.remove(page,cardIndex);refresh();renderEditor();});
    remove.setAttribute('aria-label','刪除卡片：'+label.textContent);
   }
   action(cards,'新增卡片',()=>{
    const count=sectionModel.find(page,selected.id).count;
    sectionModel.insert(page,selected.id,[String(count+1),'新任務','','說明','','操作與提示詞',[]]);
    refresh();renderEditor();status.textContent='已新增至目前分區。';
   });
   if(selected.title!==null)action(section,'刪除此副標題（保留卡片）',()=>{
    sectionModel.removeHeading(page,selected.id);
    target={kind:'page',group:target.group,page:target.page};
    refresh();renderEditor();
   });
   return;
  }
  if(!target){form.textContent='點選講義上的標題、文字或卡片開始編輯。';return;}
  if(target.kind==='appearance'||target.kind==='labels'){
  const common=box(form,'全站文字與配色');
  if(target.kind==='labels')for(const [key,label] of Object.entries({brand:'網站名稱',eyebrow:'上方小標',footer:'頁尾',copy:'複製按鈕'}))field(common,label,draft.labels[key],v=>draft.labels[key]=v);
  if(target.kind==='appearance')for(const [key,label,value] of [['page','頁面底色','#f3f7f7'],['card','卡片底色','#ffffff'],['border','卡片邊框','#bdd1d3'],['button','按鈕與連結','#176b73'],['buttonText','按鈕文字','#ffffff'],['copy','複製按鈕','#245a43'],['text','全站文字','#203c43']])field(common,label,draft.style[key]||value,v=>draft.style[key]=v,'color');
  if(target.kind==='appearance'){
   const typography=box(form,'講義字級（px）');
   const sizes=[['mainSize','主標題',30,42],['sectionSize','分區副標題',22,30],['cardTitleSize','卡片標題',22,30],['descriptionSize','說明文字',18,24],['bodySize','展開內文',18,24]];
   for(const [key,label,normal] of sizes){
    field(typography,label,draft.style[key]??normal,value=>{
     if(value==='')delete draft.style[key];
     else draft.style[key]=Math.max(12,Math.min(72,Number(value)));
    },'number');
    const input=typography.lastElementChild.querySelector('input');
    input.min=12;input.max=72;input.step=1;
   }
   const label=document.createElement('label');
   const uniform=document.createElement('input');
   uniform.type='checkbox';uniform.checked=!!draft.style.uniformSizes;
   uniform.onchange=()=>{draft.style.uniformSizes=uniform.checked;};
   label.append(uniform,' 統一字級（暫時以全站字級覆蓋區塊內個別字級）');
   typography.append(label);
  }
  return;
  }
  draft.groups.forEach((group,i)=>{
   if(i!==target.group)return;
   const panel=box(form,'分頁 '+(i+1));
   field(panel,'頁籤名稱',group.name,v=>group.name=v);
   field(panel,'標題',draft.pageTitles[i],v=>draft.pageTitles[i]=v);
   field(panel,'說明',group.subtitle,v=>group.subtitle=v);
   action(panel,'新增子分類',()=>{
    group.pages.push({name:'新子分類',columns:2,items:[]});
    target={kind:'page',group:i,page:group.pages.length-1};
    refresh({group:i,page:target.page});renderEditor();
   });
   group.pages.forEach((page,pageIndex)=>{
   if(pageIndex!==target.page)return;
   const pageBox=box(panel,'子分類 '+(pageIndex+1));
   field(pageBox,'子分類名稱',page.name,v=>page.name=v);
   if(target.kind==='page'){
    const order=document.createElement('div');pageBox.append(order);
    for(const [label,offset] of [['前移',-1],['後移',1]]){
     action(order,label,()=>movePage(i,pageIndex,pageIndex+offset))
      .disabled=pageIndex+offset<0||pageIndex+offset>=group.pages.length;
    }
   }
   if(target.kind==='page')action(pageBox,'刪除此子分類',()=>{
    const name=document.createElement('div');name.innerHTML=page.name;
    if(page.items.length&&!confirm('刪除「'+name.textContent+'」及其中的 '+page.items.length+' 張卡片？'))return;
    const index=group.pages.indexOf(page);
    if(index<0)return;
    group.pages.splice(index,1);
    target={kind:'page',group:i,page:Math.max(0,Math.min(index,group.pages.length-1))};
    refresh({group:i,page:target.page});renderEditor();
   });
   if(page.catalog)return;
   const headings=box(pageBox,'新增副標題');
   const headingPosition=document.createElement('select');
   headingPosition.setAttribute('aria-label','新增副標題的位置');
   for(let index=0;index<=page.items.length;index++){
    if(sectionModel.read(page).some(section=>section.start===index&&section.title!==null))continue;
    const title=document.createElement('div');
    title.innerHTML=page.items[index]?.[1]||'';
    headingPosition.add(new Option(index===page.items.length?'所有卡片之後':'第 '+(index+1)+' 張卡片之前｜'+title.textContent,String(index)));
   }
   headings.append(headingPosition);
   action(headings,'新增副標題',()=>{
    if(headingPosition.value==='')return;
    const index=Number(headingPosition.value);
    const sectionId=sectionModel.addHeading(page,index,'新副標題');
    target={kind:'section',group:i,page:pageIndex,index,sectionId};
    refresh();renderEditor();
   }).disabled=headingPosition.options.length===0;
   const layouts=box(pageBox,'卡片排版');
   const choices=[];
   for(let columns=1;columns<=4;columns++){
    const button=action(layouts,'▦'.repeat(columns)+' 每列 '+columns+' 張',()=>{
     page.columns=columns;
     choices.forEach((choice,index)=>choice.setAttribute('aria-pressed',String(index+1===columns)));
    });
    button.setAttribute('aria-pressed',String(page.columns===columns));
    choices.push(button);
   }
   page.items.forEach((card,j)=>{
    if(target.kind!=='card'||target.index!==j)return;
    const item=box(pageBox,'卡片 '+(j+1));
    cardOrder(item,page.items,j);
    for(const [k,label] of [[0,'編號'],[1,'標題'],[3,'說明'],[5,'操作與提示詞']])field(item,label,card[k],v=>card[k]=v);
    const expandLabel=document.createElement('label');
    const showExpand=document.createElement('input');
    showExpand.type='checkbox';
    showExpand.checked=card[8]??Boolean(card[5]||card[7]!==false);
    showExpand.onchange=()=>{card[8]=showExpand.checked;};
    expandLabel.append(showExpand,' 顯示展開／收合操作與提示詞');
    item.append(expandLabel);
    const expandHint=document.createElement('p');
    expandHint.textContent='取消勾選後，內文會直接顯示，標題與內容之間保留分隔線。';
    item.append(expandHint);
    const copyLabel=document.createElement('label');
    const showCopy=document.createElement('input');
    showCopy.type='checkbox';showCopy.checked=card[7]!==false;
    showCopy.onchange=()=>{card[7]=showCopy.checked;};
    copyLabel.append(showCopy,' 顯示複製範例按鈕');item.append(copyLabel);
    card[6]??=card[4]?[[card[2],card[4]]]:[];
    card[6].forEach((link,n)=>{
     field(item,'工具名稱',link[0],v=>link[0]=v);
     field(item,'工具網址',link[1],v=>link[1]=safeUrl(v),'url');
     action(item,'移除連結',()=>{card[6].splice(n,1);renderEditor()});
    });
    action(item,'新增連結',()=>{card[6].push(['工具','']);renderEditor()});
    action(item,'刪除此卡片',()=>{
     sectionModel.remove(page,j);
     target={kind:'page',group:i,page:pageIndex};
     refresh();renderEditor();
    });
   });
   const scopes=sectionModel.read(page);
   const current=target.kind==='card'?sectionModel.forCard(page,target.index):null;
   const scopeSelect=document.createElement('select');scopeSelect.setAttribute('aria-label','新增卡片的分區');
   if(scopes.length>1&&!current)scopeSelect.add(new Option('請選擇新增卡片的分區',''));
   for(const scope of scopes){const name=document.createElement('span');name.innerHTML=clean(scope.title??'此頁卡片');scopeSelect.add(new Option(name.textContent,scope.id));}
   if(current)scopeSelect.value=current.id;
   if(scopes.length>1)pageBox.append(scopeSelect);
   const add=action(pageBox,'新增卡片',()=>{
    const id=scopeSelect.value||scopes[0].id,scope=sectionModel.find(page,id);
    const index=sectionModel.insert(page,id,[String(scope.count+1),'新任務','','說明','','操作與提示詞',[]]);
    target={kind:'card',group:i,page:pageIndex,index};refresh();renderEditor();status.textContent='已新增至選取的分區。';
   });
   add.disabled=!scopeSelect.value;scopeSelect.onchange=()=>{add.disabled=!scopeSelect.value;};
   });
  });
  if(target.kind!=='tool'&&!draft.groups[target.group]?.pages?.[target.page]?.catalog)return;
  const catalog=box(form,'工具總覽');
  draft.tools.forEach((tool,i)=>{
   if(target.kind!=='tool'||target.index!==i)return;
   const item=box(catalog,'工具 '+(i+1));
   const visibleTools=Array.from(document.querySelectorAll('.lecture-mock article[data-tool]'),card=>Number(card.dataset.tool));
   cardOrder(item,draft.tools,i,visibleTools);
   for(const [k,label] of [[0,'名稱'],[1,'標籤'],[2,'說明']])field(item,label,tool[k],v=>{if(k===0){draft.toolCategories[v]=draft.toolCategories[tool[0]]||[];delete draft.toolCategories[tool[0]];}tool[k]=v;});
   field(item,'網址',tool[3],v=>tool[3]=safeUrl(v),'url');
   for(const category of draft.categories.slice(1)){
    const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';
    check.checked=(draft.toolCategories[tool[0]]||[]).includes(category);
    check.onchange=()=>{const selected=new Set(draft.toolCategories[tool[0]]||[]);if(check.checked)selected.add(category);else selected.delete(category);draft.toolCategories[tool[0]]=[...selected];};
    label.append(check,category);item.append(label);
   }
   action(item,'刪除工具',()=>{draft.tools.splice(i,1);renderEditor()});
  });
  action(catalog,'新增工具',()=>{draft.tools.push(['新工具','分類','說明','']);renderEditor()});
 }
 let selection=null,activeField=null;
 form.addEventListener('focusin',e=>{if(e.target.matches('.field')){activeField=e.target;selection=null;}});
 document.addEventListener('selectionchange',()=>{const s=getSelection();const field=s.anchorNode?.parentElement?.closest('.field');if(s.rangeCount&&field&&field.contains(s.focusNode)){activeField=field;selection=s.getRangeAt(0).cloneRange();}});
 const format=(command,value)=>{
  if(!activeField?.isConnected)activeField=form.querySelector('.field');
  if(!activeField)return;
  const field=activeField,range=selection?.cloneRange()||document.createRange();
  if(!selection||(range.collapsed&&command!=='insertImage')){
   range.selectNodeContents(field);
  }
  if(command==='insertImage')range.collapse(false);
  field.focus();
  const s=getSelection();s.removeAllRanges();s.addRange(range);
  document.execCommand(command,false,value);
  if(command==='insertImage'){
   const images=field.querySelectorAll('img');
   for(const img of images)if(!img.style.width)img.style.width=displayWidth.value+'%';
  }
  field.dispatchEvent(new Event('input',{bubbles:true}));
 };
 for(const [label,command] of [['粗體','bold'],['斜體','italic'],['底線','underline'],['刪除線','strikeThrough'],['項目符號','insertUnorderedList']]){
  const b=action(bar,label,()=>format(command));b.onmousedown=e=>e.preventDefault();
 }
 const size=document.createElement('select');size.setAttribute('aria-label','字級');
 for(const [i,n] of [10,13,16,18,24,32,48].entries())size.add(new Option(n+' px',i+1));
 size.value=3;size.onchange=()=>format('fontSize',size.value);bar.append(size);
 const palette=document.createElement('div');
 palette.id='guide-text-palette';palette.hidden=true;
 palette.setAttribute('role','group');palette.setAttribute('aria-label','文字調色盤');
 const colorButton=action(bar,'文字顏色 ▾',()=>setPalette(palette.hidden));
 colorButton.className='guide-color-trigger';
 colorButton.setAttribute('aria-controls',palette.id);
 colorButton.setAttribute('aria-expanded','false');
 colorButton.onmousedown=e=>e.preventDefault();
 function setPalette(open){
  palette.hidden=!open;colorButton.setAttribute('aria-expanded',String(open));
 }
 const applyColor=value=>{
  format('foreColor',value);
  colorButton.style.setProperty('--guide-color-sample',value);
  setPalette(false);
 };
 const swatches=document.createElement('div');swatches.className='guide-color-swatches';
 const colors=[
  ['黑','#000000'],['深灰','#434343'],['灰','#666666'],['淺灰','#999999'],['銀灰','#cccccc'],['白','#ffffff'],
  ['深紅','#990000'],['紅','#cc0000'],['橘','#e69138'],['黃','#f1c232'],['綠','#38761d'],['深青','#176b73'],
  ['深藍','#073763'],['藍','#1155cc'],['淺藍','#6fa8dc'],['紫','#674ea7'],['粉紅','#a64d79'],['棕','#783f04'],
  ['淺紅','#f4cccc'],['淺橘','#fce5cd'],['淺黃','#fff2cc'],['淺綠','#d9ead3'],['淺青','#d0e0e3'],['淺紫','#d9d2e9']
 ];
 for(const [name,value] of colors){
  const swatch=action(swatches,'',()=>applyColor(value));
  swatch.className='guide-color-swatch';swatch.title=name+' '+value;
  swatch.setAttribute('aria-label',swatch.title);
  swatch.style.setProperty('--guide-swatch',value);
  swatch.onmousedown=e=>e.preventDefault();
 }
 const custom=document.createElement('label');custom.append('自訂顏色 ');
 const color=document.createElement('input');color.type='color';color.setAttribute('aria-label','自訂文字顏色');
 color.onchange=()=>applyColor(color.value);custom.append(color);
 palette.append(swatches,custom);bar.append(palette);
 editor.addEventListener('click',event=>{if(!palette.contains(event.target)&&!colorButton.contains(event.target))setPalette(false);});
 editor.addEventListener('close',()=>setPalette(false));
 action(bar,'插入連結',()=>{const url=safeUrl(prompt('連結網址'));if(url)format('createLink',url);});
 action(bar,'圖片網址',()=>{const url=safeUrl(prompt('圖片網址'));if(url)format('insertImage',url);});
 const imageOptions=document.createElement('div');imageOptions.className='editor-image-options';bar.append(imageOptions);
 const imageSelect=(label,options,initial)=>{
  const wrap=document.createElement('label');wrap.append(label+' ');
  const select=document.createElement('select');select.setAttribute('aria-label',label);
  for(const [name,value] of options)select.add(new Option(name,value));
  select.value=initial;wrap.append(select);imageOptions.append(wrap);return select;
 };
 const displayWidth=imageSelect('圖片寬度',[[ '25%','25'],['50%','50'],['75%','75'],['100%','100']],'100');
 const resolution=imageSelect('解析度',[['標準（1600 px）','1600'],['高清（2400 px）','2400'],['高解析（3200 px）','3200']],'2400');
 const imageFormat=imageSelect('圖片格式',[['WebP','image/webp'],['PNG','image/png'],['JPEG','image/jpeg']],'image/webp');
 let selectedImage=null;
 form.addEventListener('click',e=>{
  selectedImage=e.target.matches('.field img')?e.target:null;
  if(selectedImage)displayWidth.value=selectedImage.style.width.replace('%','')||'100';
 });
 displayWidth.onchange=()=>{
  if(!selectedImage?.isConnected)return;
  selectedImage.style.width=displayWidth.value+'%';
  selectedImage.closest('.field').dispatchEvent(new Event('input',{bubbles:true}));
 };
 const imageFile=document.createElement('input');
 imageFile.type='file';imageFile.accept='.png,.jpg,.jpeg,.webp,.gif,.svg';imageFile.hidden=true;
 bar.append(imageFile);
 let imageTarget;
 const chooseImage=action(bar,'選擇本機圖片',()=>{
  const field=activeField?.isConnected?activeField:form.querySelector('.field');
  if(!field)return;
  imageTarget={field,range:selection?.cloneRange()};
  imageFile.value='';imageFile.click();
 });
 imageFile.onchange=async()=>{
  const file=imageFile.files[0],target=imageTarget;
  if(!file||!target)return;
  const url=URL.createObjectURL(file);
  chooseImage.disabled=true;status.textContent='正在處理圖片…';
  try{
   const img=new Image();img.src=url;await img.decode();
   const limit=Number(resolution.value);
   const ratio=limit/Math.max(img.naturalWidth,img.naturalHeight);
   const scale=file.name.toLowerCase().endsWith('.svg')?ratio:Math.min(1,ratio);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const context=canvas.getContext('2d');
   if(imageFormat.value==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}
   context.drawImage(img,0,0,canvas.width,canvas.height);
   const embedded=canvas.toDataURL(imageFormat.value,0.92);
   if(embedded.length>900000)throw new Error('圖片壓縮後仍過大，請縮小圖片再試。');
   if(!editor.open||!target.field.isConnected)return;
   activeField=target.field;selection=target.range||null;
   format('insertImage',embedded);
   status.textContent='圖片已插入，按「完成」保留修改。';
  }catch(error){
   status.textContent=error.message==='圖片壓縮後仍過大，請縮小圖片再試。'?error.message:'無法讀取圖片，請確認檔案格式或改用 PNG。';
  }finally{URL.revokeObjectURL(url);chooseImage.disabled=false;}
 };
 const historyControls=document.createElement('div');historyControls.id='guide-history';historyControls.hidden=true;
 document.body.append(historyControls);
 const refresh=position=>{window.refreshGuide(draft,position);undo.disabled=!past.length;redo.disabled=!future.length;};
 const travel=(from,to)=>{if(!from.length)return;to.push(last);last=from.pop();draft=JSON.parse(last);saveNotice.hidden=true;refresh();};
 const undo=action(historyControls,'↶',()=>travel(past,future));
 const redo=action(historyControls,'↷',()=>travel(future,past));
 action(historyControls,'完成',finish).className='guide-finish';
 undo.setAttribute('aria-label','復原');redo.setAttribute('aria-label','重做');
 undo.title='復原';redo.title='重做';undo.disabled=true;redo.disabled=true;
 document.addEventListener('keydown',e=>{
  if(!editing||editor.open||!(e.ctrlKey||e.metaKey)||e.altKey)return;
  const key=e.key.toLowerCase();
  if(key==='z'||key==='y'){e.preventDefault();if(key==='y'||e.shiftKey)travel(future,past);else travel(past,future);}
 });
 const commit=()=>{record();editor.close();refresh();};
 const cancel=()=>{draft=JSON.parse(last);editor.close();refresh();};
 action(footer,'取消',cancel);
 action(footer,'完成',commit);
 editor.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 let pendingPublish;
 const publishOnline=guide=>{
  pendingPublish?.cancel();
  const channel=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  const destination='https://113205104.github.io/ai-lecture-guide/';
  const origin=new URL(destination).origin;
  // 必須在使用者點擊時先開視窗，再下載；先安裝訊息監聽，再導向更新頁。
  const popup=window.open('about:blank','_blank');
  saveNotice.hidden=false;
  if(!popup){saveNotice.textContent='HTML 備份會照常下載，但瀏覽器阻擋了更新視窗。請允許此頁開啟彈出視窗，再按「匯出並更新線上」。';return;}
  const credentialKey='lecture-guide-online-pair-v1';
  let credentials;
  try{credentials=JSON.parse(localStorage.getItem(credentialKey));}catch{}
  const snapshot=structuredClone(guide);
  saveNotice.textContent='正在開啟更新頁。HTML 備份會同時下載；請在更新頁完成首次連結。';
  let readyTimer,completionTimer,ready=false;
  const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(readyTimer);clearTimeout(completionTimer);pendingPublish=null;};
  const receive=event=>{
   if(event.source!==popup||event.origin!==origin||event.data?.type!=='guide-sync'||event.data.channel!==channel)return;
   const message=event.data;
   if(message.action==='ready'&&!ready){
    ready=true;clearTimeout(readyTimer);
    saveNotice.textContent='更新頁已開啟，正在傳送講義。首次使用請在更新頁登入並允許連結。';
    popup.postMessage({type:'guide-sync',action:'publish',channel,guide:snapshot,credentials,baseRevision:Number.isInteger(syncState?.revision)?syncState.revision:null},origin);
    completionTimer=setTimeout(()=>{saveNotice.textContent='備份已下載，但尚未收到線上更新確認。請查看更新頁是否仍在等待登入或版本選擇。';cleanup();},300000);
   }
   if(message.action==='paired'){
    credentials=message.credentials;
    try{localStorage.setItem(credentialKey,JSON.stringify(credentials));}catch{}
   }
   if(message.action==='complete'){rememberRevision(message.revision,snapshot);saveNotice.textContent='HTML 備份已下載，線上講義也已更新成功。';cleanup();}
   if(message.action==='error'){saveNotice.textContent='HTML 備份已下載，線上更新未完成：'+message.message;cleanup();}
  };
  window.addEventListener('message',receive);
  readyTimer=setTimeout(()=>{saveNotice.textContent='30 秒內未收到更新頁回應。HTML 備份仍保留，線上尚未確認更新。請確認新分頁是否載入，或是否仍在使用舊版匯出功能。';cleanup();},30000);
  pendingPublish={cleanup,cancel:()=>{popup.postMessage({type:'guide-sync',action:'cancel',channel},origin);popup.close();cleanup();}};
  popup.location.replace(destination+'?update=1&request='+channel+'#channel='+channel);
 };
 const exportLabel=location.protocol==='file:'?'匯出並更新線上':'下載 HTML 備份';
 action(menu,exportLabel,()=>{
  closeMenu();
  try{if(location.protocol==='file:')publishOnline(draft);}
  catch(error){saveNotice.textContent='無法開啟線上更新：'+error.message+'。HTML 備份仍會下載。';saveNotice.hidden=false;}
  finally{downloadGuide(draft);}
 });
 renderEditor();
 if(location.protocol==='file:'){
  checkForCloud();
  window.addEventListener('online',checkForCloud);
  window.addEventListener('focus',checkForCloud);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForCloud();});
  setInterval(checkForCloud,60000);
 }
}
