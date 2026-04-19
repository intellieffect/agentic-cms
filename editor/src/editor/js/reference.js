/* ─── reference.js — Reference panel ─── */
/* ─── Reference Panel ─── */
let _refPlaying=false,_selectedRefUrl='';
function toggleRefPanel(){
  const p=document.getElementById('refPanel');
  const btn=document.getElementById('refToggleBtn');
  if(p.style.display==='none'){
    p.style.display='flex';
    btn.classList.add('on');
    populateRefList();
    scaleSubOv(); // sync ref phone size
  }else{
    p.style.display='none';
    btn.classList.remove('on');
    const rv=document.getElementById('refVid');
    rv.pause();_refPlaying=false;
  }
}
function closeRefPanel(){
  document.getElementById('refPanel').style.display='none';
  document.getElementById('refToggleBtn').classList.remove('on');
  document.getElementById('refVid').pause();_refPlaying=false;
}
function populateRefList(){
  const grid=document.getElementById('refGrid');
  grid.innerHTML='<div style="grid-column:1/-1;color:#555;font-size:10px;padding:8px;text-align:center">로딩 중...</div>';
  const items=[];
  // Reference videos via server proxy
  fetch(apiUrl('/api/references')).then(r=>r.json()).then(data=>{
    (data.videos||[]).forEach(v=>{
      items.push({thumb:v.thumbnail_url,video:v.video_url,caption:(v.caption||'').slice(0,30).replace(/\n/g,' '),dur:v.duration_sec,id:v.id});
    });
    renderRefGrid(items);
  }).catch(()=>{
    grid.innerHTML='<div style="grid-column:1/-1;color:#555;font-size:10px;padding:8px">레퍼런스를 불러올 수 없습니다</div>';
  });
}
function renderRefGrid(items){
  const grid=document.getElementById('refGrid');
  grid.innerHTML='';
  items.forEach(item=>{
    const card=document.createElement('div');
    card.style.cssText='cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid #222;position:relative;background:#000;height:140px';
    card.innerHTML=`<img src="${item.thumb}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0.8" loading="lazy"><div style="position:absolute;bottom:0;left:0;right:0;padding:2px 4px;background:linear-gradient(transparent,rgba(0,0,0,.8));font-size:7px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.dur||'?'}s</div>`;
    card.title=item.caption||item.id;
    if(_selectedRefUrl&&item.video===_selectedRefUrl){card.classList.add('ref-sel');card.style.borderColor='#2563eb'}
    card.onclick=()=>{
      const rv=document.getElementById('refVid');
      rv.src=item.video;rv.load();
      rv.onloadedmetadata=()=>{document.getElementById('refSeek').max=rv.duration};
      grid.querySelectorAll('.ref-sel').forEach(d=>{d.classList.remove('ref-sel');d.style.borderColor='#222'});
      card.classList.add('ref-sel');card.style.borderColor='#2563eb';
      _selectedRefUrl=item.video;
    };
    card.onmouseenter=()=>{if(!card.classList.contains('ref-sel'))card.style.borderColor='#444'};
    card.onmouseleave=()=>{if(!card.classList.contains('ref-sel'))card.style.borderColor='#222'};
    grid.appendChild(card);
  });
}
function loadRefVideo(url){
  if(!url)return;
  const rv=document.getElementById('refVid');
  rv.src=url;rv.load();
  rv.onloadedmetadata=()=>{document.getElementById('refSeek').max=rv.duration};
}
function refPlayPause(){
  const rv=document.getElementById('refVid');
  if(_refPlaying){rv.pause();_refPlaying=false;document.getElementById('refPlayBtn').textContent='▶'}
  else{rv.play();_refPlaying=true;document.getElementById('refPlayBtn').textContent='⏸'}
}
function refSeekTo(v){document.getElementById('refVid').currentTime=parseFloat(v)}
(function(){
  const rv=document.getElementById('refVid');
  if(rv)rv.addEventListener('timeupdate',()=>{
    const t=rv.currentTime;
    document.getElementById('refTC').textContent=Math.floor(t/60)+':'+('0'+Math.floor(t%60)).slice(-2);
    document.getElementById('refSeek').value=t;
  });
})();

function goToProjects(){
  showSourceSelector();
}

function initEditorState(){
  clipMeta=CLIPS.map(()=>({speed:1}));
  TRANSITIONS=[];syncTransitions();
  clipSubStyles=CLIPS.map(()=>({...subStyleDefault}));
  clipCrops=CLIPS.map(()=>({x:0,y:0,w:100,h:100}));
  clipZooms=CLIPS.map(()=>({scale:1,panX:0,panY:0}));
  clipEffects=CLIPS.map(()=>[]);
  globalEffects=[];
  KB_EFFECTS=[];curKBIdx=-1;
  hist=[];cur=0;
  restoreLastStyle();
  recalc();renderTL();
  if(CLIPS.length)sel(0);
  scaleSubOv();
  applySubStyle();
}


/* ─── Source Overlay Side Navigation (프로젝트 목록 화면) ─── */
function srcNavSwitch(tab){
  const projBtn=document.getElementById('srcNavProjects');
  const refPanel=document.getElementById('srcRefPanel');
  const doneBtn=document.getElementById('srcNavDone');
  const donePanel=document.getElementById('srcDonePanel');
  // Reset all
  projBtn.classList.remove('active');
  if(doneBtn)doneBtn.classList.remove('active');
  refPanel.classList.remove('open');
  if(donePanel)donePanel.classList.remove('open');
  if(tab==='done'){
    if(doneBtn)doneBtn.classList.add('active');
    if(donePanel){
      donePanel.classList.add('open');
      if(!donePanel.dataset.loaded){donePanel.dataset.loaded='1';srcDonePanelInit(donePanel)}
      srcDoneLoadVideos();
    }
  }else{
    projBtn.classList.add('active');
  }
}
function srcRefPanelInit(panel){
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;border-bottom:1px solid #1e1e1e">
      <span style="font-size:12px;font-weight:600;color:#ddd">🎬 레퍼런스 관리</span>
      <button onclick="srcNavSwitch('projects')" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">✕</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid #1e1e1e">
      <select id="srcRefAccFilter" onchange="srcRefFilterAccount(this.value)" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ccc;padding:4px 6px;border-radius:4px;font-size:10px">
        <option value="all">전체 계정</option>
      </select>
    </div>
    <div style="display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid #1e1e1e">
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="srcRefSort('latest')" id="srcSortLatest">최신순</button>
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="srcRefSort('views')" id="srcSortViews">조회순</button>
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="srcRefSort('likes')" id="srcSortLikes">좋아요순</button>
    </div>
    <div id="srcRefVideoList" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>
    </div>
    <div style="display:flex;gap:4px;padding:6px 8px;border-top:1px solid #1e1e1e">
      <input id="srcRefImportUrl" placeholder="영상 URL 붙여넣기" style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:4px 6px;border-radius:4px;font-size:10px">
      <button onclick="srcRefImport()" style="background:#2563eb;border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;cursor:pointer">임포트</button>
    </div>`;
}
let _srcRefSort='latest',_srcRefAccount='all';
function srcRefFilterAccount(v){_srcRefAccount=v;srcRefLoadVideos()}
function srcRefSort(s){_srcRefSort=s;srcRefLoadVideos()}
function srcRefLoadAccounts(){
  fetch(apiUrl('/api/references/accounts')).then(r=>r.json()).then(data=>{
    const sel=document.getElementById('srcRefAccFilter');if(!sel)return;
    const accts=data.accounts||data||[];
    sel.innerHTML='<option value="all">전체 계정 ('+accts.length+')</option>';
    accts.forEach(a=>{sel.innerHTML+=`<option value="${a.id}">${a.display_name||a.username||a.id}</option>`});
  }).catch(()=>{});
}
function srcRefLoadVideos(){
  const list=document.getElementById('srcRefVideoList');if(!list)return;
  list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>';
  let url='/api/references/videos?sort='+_srcRefSort+'&limit=50';
  if(_srcRefAccount!=='all')url+='&account_id='+_srcRefAccount;
  fetch(apiUrl(url)).then(r=>r.json()).then(data=>{
    const videos=data.videos||data||[];list.innerHTML='';
    if(!videos.length){list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">영상 없음</div>';return}
    videos.forEach(v=>{
      const caption=(v.caption||'').split('\n')[0].slice(0,40);
      const tags=(v.style_tags||[]).map(t=>`<span style="background:#1e3a5f;color:#60a5fa;padding:1px 4px;border-radius:3px;font-size:8px;margin-right:2px">${t}</span>`).join('');
      const card=document.createElement('div');
      card.style.cssText='background:#1a1a1a;border:1px solid #222;border-radius:6px;padding:8px;cursor:pointer;transition:.15s';
      card.onmouseenter=()=>{card.style.borderColor='#444'};card.onmouseleave=()=>{card.style.borderColor='#222'};
      card.innerHTML=`<div style="display:flex;gap:8px;align-items:start">
        <img src="${v.thumbnail_url||''}" style="width:80px;height:106px;object-fit:cover;border-radius:4px;background:#000;flex-shrink:0" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${caption||'(캡션 없음)'}</div>
          <div style="font-size:9px;color:#666;margin-top:2px">❤️${v.like_count||0} 💬${v.comment_count||0} ${v.duration_sec?Math.round(v.duration_sec)+'s':''}</div>
          <div style="margin-top:4px">${tags}</div>
        </div></div>`;
      card.onclick=()=>srcRefOpenDetail(v,card);
      list.appendChild(card);
    });
  }).catch(()=>{list.innerHTML='<div style="color:#f66;font-size:10px;text-align:center;padding:20px">로드 실패</div>'});
}
function srcRefOpenDetail(v,card){
  document.querySelectorAll('.src-ref-detail').forEach(d=>d.remove());
  const detail=document.createElement('div');detail.className='src-ref-detail';
  detail.style.cssText='background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:10px;margin-top:4px';
  detail.innerHTML=`
    <video src="${apiUrl('/api/references/videos/'+v.id+'/stream')}" controls style="width:100%;border-radius:4px;max-height:300px;background:#000" playsinline></video>
    <div style="margin-top:8px"><label style="font-size:9px;color:#888">Style Tags (쉼표 구분)</label>
      <input id="srcRefTags_${v.id}" value="${(v.style_tags||[]).join(', ')}" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:3px 6px;border-radius:4px;font-size:10px;box-sizing:border-box;margin-top:2px"></div>
    <div style="margin-top:6px"><label style="font-size:9px;color:#888">메모</label>
      <textarea id="srcRefNotes_${v.id}" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:3px 6px;border-radius:4px;font-size:10px;height:50px;resize:vertical;box-sizing:border-box;margin-top:2px">${v.notes||''}</textarea></div>
    <button onclick="srcRefSave('${v.id}')" style="margin-top:6px;background:#2563eb;border:none;color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;cursor:pointer;width:100%">💾 저장</button>`;
  card.after(detail);
}
function srcRefSave(id){
  const tags=document.getElementById('srcRefTags_'+id).value.split(',').map(t=>t.trim()).filter(Boolean);
  const notes=document.getElementById('srcRefNotes_'+id).value;
  fetch(apiUrl('/api/references/videos/'+id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({style_tags:tags,notes})})
    .then(r=>{if(r.ok){const btn=event.target;btn.textContent='✅ 저장됨';setTimeout(()=>{btn.textContent='💾 저장'},1500)}}).catch(()=>{});
}
function srcRefImport(){
  const input=document.getElementById('srcRefImportUrl');const url=input.value.trim();if(!url)return;
  fetch(apiUrl('/api/references/import'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})
    .then(r=>r.json()).then(()=>{input.value='';srcRefLoadVideos()}).catch(()=>{});
}

/* ─── Editor Side Nav (에디터 내부 사이드 네비) ─── */
function editorNavRef(){
  const panel=document.getElementById('editorRefPanel');
  const btn=document.getElementById('edNavRef');
  if(panel.classList.contains('open')){
    panel.classList.remove('open');btn.classList.remove('active');
  }else{
    panel.classList.add('open');btn.classList.add('active');
    if(!panel.dataset.loaded){panel.dataset.loaded='1';edRefPanelInit(panel)}
    edRefLoadAccounts();edRefLoadVideos();
  }
}
function edRefPanelInit(panel){
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;border-bottom:1px solid #1e1e1e">
      <span style="font-size:12px;font-weight:600;color:#ddd">🎬 레퍼런스</span>
      <button onclick="editorNavRef()" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">✕</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid #1e1e1e">
      <select id="edRefAccFilter" onchange="edRefFilterAccount(this.value)" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ccc;padding:4px 6px;border-radius:4px;font-size:10px">
        <option value="all">전체 계정</option>
      </select>
    </div>
    <div style="display:flex;gap:4px;padding:6px 10px;border-bottom:1px solid #1e1e1e">
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="edRefSort('latest')">최신순</button>
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="edRefSort('views')">조회순</button>
      <button class="src-sidenav-btn" style="width:auto;height:auto;font-size:9px;padding:3px 8px" onclick="edRefSort('likes')">좋아요순</button>
    </div>
    <div id="edRefVideoList" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>
    </div>
    <div style="display:flex;gap:4px;padding:6px 8px;border-top:1px solid #1e1e1e">
      <input id="edRefImportUrl" placeholder="영상 URL 붙여넣기" style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:4px 6px;border-radius:4px;font-size:10px">
      <button onclick="edRefImport()" style="background:#2563eb;border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;cursor:pointer">임포트</button>
    </div>`;
}
let _edRefSort='latest',_edRefAccount='all';
function edRefFilterAccount(v){_edRefAccount=v;edRefLoadVideos()}
function edRefSort(s){_edRefSort=s;edRefLoadVideos()}
function edRefLoadAccounts(){
  fetch(apiUrl('/api/references/accounts')).then(r=>r.json()).then(data=>{
    const sel=document.getElementById('edRefAccFilter');if(!sel)return;
    const accts=data.accounts||data||[];
    sel.innerHTML='<option value="all">전체 계정 ('+accts.length+')</option>';
    accts.forEach(a=>{sel.innerHTML+=`<option value="${a.id}">${a.display_name||a.username||a.id}</option>`});
  }).catch(()=>{});
}
function edRefLoadVideos(){
  const list=document.getElementById('edRefVideoList');if(!list)return;
  list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>';
  let url='/api/references/videos?sort='+_edRefSort+'&limit=50';
  if(_edRefAccount!=='all')url+='&account_id='+_edRefAccount;
  fetch(apiUrl(url)).then(r=>r.json()).then(data=>{
    const videos=data.videos||data||[];list.innerHTML='';
    if(!videos.length){list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">영상 없음</div>';return}
    videos.forEach(v=>{
      const caption=(v.caption||'').split('\n')[0].slice(0,40);
      const tags=(v.style_tags||[]).map(t=>`<span style="background:#1e3a5f;color:#60a5fa;padding:1px 4px;border-radius:3px;font-size:8px;margin-right:2px">${t}</span>`).join('');
      const card=document.createElement('div');
      card.style.cssText='background:#1a1a1a;border:1px solid #222;border-radius:6px;padding:8px;cursor:pointer;transition:.15s';
      card.onmouseenter=()=>{card.style.borderColor='#444'};card.onmouseleave=()=>{card.style.borderColor='#222'};
      card.innerHTML=`<div style="display:flex;gap:8px;align-items:start">
        <img src="${v.thumbnail_url||''}" style="width:80px;height:106px;object-fit:cover;border-radius:4px;background:#000;flex-shrink:0" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${caption||'(캡션 없음)'}</div>
          <div style="font-size:9px;color:#666;margin-top:2px">❤️${v.like_count||0} 💬${v.comment_count||0} ${v.duration_sec?Math.round(v.duration_sec)+'s':''}</div>
          <div style="margin-top:4px">${tags}</div>
        </div></div>`;
      card.onclick=()=>edRefOpenDetail(v,card);
      list.appendChild(card);
    });
  }).catch(()=>{list.innerHTML='<div style="color:#f66;font-size:10px;text-align:center;padding:20px">로드 실패</div>'});
}
function edRefOpenDetail(v,card){
  document.querySelectorAll('.ed-ref-detail').forEach(d=>d.remove());
  const detail=document.createElement('div');detail.className='ed-ref-detail';
  detail.style.cssText='background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:10px;margin-top:4px';
  detail.innerHTML=`
    <video src="${apiUrl('/api/references/videos/'+v.id+'/stream')}" controls style="width:100%;border-radius:4px;max-height:300px;background:#000" playsinline></video>
    <div style="margin-top:8px"><label style="font-size:9px;color:#888">Style Tags (쉼표 구분)</label>
      <input id="edRefTags_${v.id}" value="${(v.style_tags||[]).join(', ')}" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:3px 6px;border-radius:4px;font-size:10px;box-sizing:border-box;margin-top:2px"></div>
    <div style="margin-top:6px"><label style="font-size:9px;color:#888">메모</label>
      <textarea id="edRefNotes_${v.id}" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#ddd;padding:3px 6px;border-radius:4px;font-size:10px;height:50px;resize:vertical;box-sizing:border-box;margin-top:2px">${v.notes||''}</textarea></div>
    <button onclick="edRefSave('${v.id}')" style="margin-top:6px;background:#2563eb;border:none;color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;cursor:pointer;width:100%">💾 저장</button>`;
  card.after(detail);
}
function edRefSave(id){
  const tags=document.getElementById('edRefTags_'+id).value.split(',').map(t=>t.trim()).filter(Boolean);
  const notes=document.getElementById('edRefNotes_'+id).value;
  fetch(apiUrl('/api/references/videos/'+id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({style_tags:tags,notes})})
    .then(r=>{if(r.ok){const btn=event.target;btn.textContent='✅ 저장됨';setTimeout(()=>{btn.textContent='💾 저장'},1500)}}).catch(()=>{});
}
function edRefImport(){
  const input=document.getElementById('edRefImportUrl');const url=input.value.trim();if(!url)return;
  fetch(apiUrl('/api/references/import'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})
    .then(r=>r.json()).then(()=>{input.value='';edRefLoadVideos()}).catch(()=>{});
}

/* ─── 완료 영상 (Done Videos) Panel — Source Overlay ─── */
function srcDonePanelInit(panel){
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;border-bottom:1px solid #1e1e1e">
      <span style="font-size:12px;font-weight:600;color:#ddd">🎞️ 완료 영상</span>
      <button onclick="srcNavSwitch('projects')" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">✕</button>
    </div>
    <div style="padding:8px 10px;border-bottom:1px solid #1e1e1e">
      <label style="font-size:10px;color:#888;display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px;border:1px dashed #333;border-radius:6px;justify-content:center" onclick="document.getElementById('srcDoneUpload').click()">
        📂 영상 업로드
      </label>
      <input type="file" id="srcDoneUpload" accept="video/*" style="display:none" onchange="srcDoneUploadFile(this)">
    </div>
    <div id="srcDoneVideoList" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>
    </div>`;
}
function srcDoneUploadFile(input){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('file',file);fd.append('name',file.name);
  fetch(apiUrl('/api/finished/upload'),{method:'POST',body:fd}).then(r=>r.json()).then(()=>{
    srcDoneLoadVideos();input.value='';
  }).catch(()=>{});
}
function srcDoneLoadVideos(){
  const list=document.getElementById('srcDoneVideoList');if(!list)return;
  list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>';
  fetch(apiUrl('/api/finished?limit=50')).then(r=>r.json()).then(data=>{
    const videos=data.videos||[];list.innerHTML='';
    if(!videos.length){list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">완료 영상 없음<br><span style="font-size:9px;color:#444">영상 추출 시 자동 저장되거나 직접 업로드</span></div>';return}
    videos.forEach(v=>{
      const dur=v.duration?Math.round(v.duration)+'s':'';
      const size=v.file_size?Math.round(v.file_size/1024/1024)+'MB':'';
      const card=document.createElement('div');
      card.style.cssText='background:#1a1a1a;border:1px solid #222;border-radius:6px;overflow:hidden;cursor:pointer;transition:.15s';
      card.onmouseenter=()=>{card.style.borderColor='#444'};card.onmouseleave=()=>{card.style.borderColor='#222'};
      card.innerHTML=`
        <div style="position:relative;width:100%;padding-top:56.25%;background:#000">
          <img src="${apiUrl('/api/finished/'+v.id+'/thumbnail')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">
          <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">${dur}</div>
        </div>
        <div style="padding:6px 8px">
          <div style="font-size:10px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.name||'Untitled'}</div>
          <div style="font-size:9px;color:#666;margin-top:2px">${size} · ${new Date(v.created_at).toLocaleDateString('ko-KR')}</div>
        </div>`;
      card.onclick=()=>srcDoneOpenDetail(v,card);
      list.appendChild(card);
    });
  }).catch(()=>{list.innerHTML='<div style="color:#f66;font-size:10px;text-align:center;padding:20px">로드 실패</div>'});
}
function srcDoneOpenDetail(v,card){
  document.querySelectorAll('.src-done-detail').forEach(d=>d.remove());
  const detail=document.createElement('div');detail.className='src-done-detail';
  detail.style.cssText='background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:10px;margin-top:4px';
  detail.innerHTML=`
    <video src="${apiUrl('/api/finished/'+v.id+'/stream')}" controls style="width:100%;border-radius:4px;max-height:300px;background:#000" playsinline></video>
    <div style="margin-top:6px;display:flex;gap:4px">
      <a href="${apiUrl('/api/finished/'+v.id+'/stream')}" download="${v.name||'video'}.mp4" style="flex:1;text-align:center;background:#2563eb;color:#fff;padding:4px;border-radius:4px;font-size:10px;text-decoration:none">⬇ 다운로드</a>
      <button onclick="srcDoneDelete('${v.id}')" style="background:#dc2626;border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;cursor:pointer">🗑</button>
    </div>`;
  card.after(detail);
}
function srcDoneDelete(id){
  if(!confirm('삭제하시겠습니까?'))return;
  fetch(apiUrl('/api/finished/'+id),{method:'DELETE'}).then(()=>srcDoneLoadVideos()).catch(()=>{});
}

/* ─── 완료 영상 Panel — Editor Side Nav ─── */
function editorNavDone(){
  const panel=document.getElementById('editorDonePanel');
  const btn=document.getElementById('edNavDone');
  // Close ref panel if open
  const refPanel=document.getElementById('editorRefPanel');
  if(refPanel.classList.contains('open')){refPanel.classList.remove('open');const rb=document.getElementById('edNavRef');if(rb)rb.classList.remove('active')}
  if(panel.classList.contains('open')){
    panel.classList.remove('open');btn.classList.remove('active');
  }else{
    panel.classList.add('open');btn.classList.add('active');
    if(!panel.dataset.loaded){panel.dataset.loaded='1';edDonePanelInit(panel)}
    edDoneLoadVideos();
  }
}
function edDonePanelInit(panel){
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;border-bottom:1px solid #1e1e1e">
      <span style="font-size:12px;font-weight:600;color:#ddd">🎞️ 완료 영상</span>
      <button onclick="editorNavDone()" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">✕</button>
    </div>
    <div style="padding:8px 10px;border-bottom:1px solid #1e1e1e">
      <label style="font-size:10px;color:#888;display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px;border:1px dashed #333;border-radius:6px;justify-content:center" onclick="document.getElementById('edDoneUpload').click()">
        📂 영상 업로드
      </label>
      <input type="file" id="edDoneUpload" accept="video/*" style="display:none" onchange="edDoneUploadFile(this)">
    </div>
    <div id="edDoneVideoList" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>
    </div>`;
}
function edDoneLoadVideos(){
  const list=document.getElementById('edDoneVideoList');if(!list)return;
  list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>';
  fetch(apiUrl('/api/finished?limit=50')).then(r=>r.json()).then(data=>{
    const videos=data.videos||[];list.innerHTML='';
    if(!videos.length){list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">완료 영상 없음<br><span style="font-size:9px;color:#444">영상 추출 시 자동 저장되거나 직접 업로드</span></div>';return}
    videos.forEach(v=>{
      const dur=v.duration?Math.round(v.duration)+'s':'';
      const size=v.file_size?Math.round(v.file_size/1024/1024)+'MB':'';
      const card=document.createElement('div');
      card.style.cssText='background:#1a1a1a;border:1px solid #222;border-radius:6px;overflow:hidden;cursor:pointer;transition:.15s';
      card.onmouseenter=()=>{card.style.borderColor='#444'};card.onmouseleave=()=>{card.style.borderColor='#222'};
      card.innerHTML=`
        <div style="position:relative;width:100%;padding-top:56.25%;background:#000">
          <img src="${apiUrl('/api/finished/'+v.id+'/thumbnail')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">
          <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">${dur}</div>
        </div>
        <div style="padding:6px 8px">
          <div style="font-size:10px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.name||'Untitled'}</div>
          <div style="font-size:9px;color:#666;margin-top:2px">${size} · ${new Date(v.created_at).toLocaleDateString('ko-KR')}</div>
        </div>`;
      card.onclick=()=>edDoneOpenDetail(v,card);
      list.appendChild(card);
    });
  }).catch(()=>{list.innerHTML='<div style="color:#f66;font-size:10px;text-align:center;padding:20px">로드 실패</div>'});
}
function edDoneOpenDetail(v,card){
  document.querySelectorAll('.ed-done-detail').forEach(d=>d.remove());
  const detail=document.createElement('div');detail.className='ed-done-detail';
  detail.style.cssText='background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:10px;margin-top:4px';
  detail.innerHTML=`
    <video src="${apiUrl('/api/finished/'+v.id+'/stream')}" controls style="width:100%;border-radius:4px;max-height:300px;background:#000" playsinline></video>
    <div style="margin-top:6px;display:flex;gap:4px">
      <a href="${apiUrl('/api/finished/'+v.id+'/stream')}" download="${v.name||'video'}.mp4" style="flex:1;text-align:center;background:#2563eb;color:#fff;padding:4px;border-radius:4px;font-size:10px;text-decoration:none">⬇ 다운로드</a>
      <button onclick="edDoneDelete('${v.id}')" style="background:#dc2626;border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;cursor:pointer">🗑</button>
    </div>`;
  card.after(detail);
}
function edDoneDelete(id){
  if(!confirm('삭제하시겠습니까?'))return;
  fetch(apiUrl('/api/finished/'+id),{method:'DELETE'}).then(()=>edDoneLoadVideos()).catch(()=>{});
}
function edDoneUploadFile(input){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('file',file);fd.append('name',file.name);
  fetch(apiUrl('/api/finished/upload'),{method:'POST',body:fd}).then(r=>r.json()).then(()=>{
    edDoneLoadVideos();input.value='';
  }).catch(()=>{});
}

/* ─── 렌더 완료 → 완료 영상 저장 후킹 ─── */
(function(){
  const origSuccess=window.renderSuccess;
  if(!origSuccess)return;
  window.renderSuccess=function(elapsed){
    origSuccess(elapsed);
    // 체크박스 표시
    const row=document.getElementById('renderSaveRow');
    if(row)row.style.display='block';
    // 자동 저장
    const cb=document.getElementById('saveToFinished');
    if(cb&&cb.checked){
      const name=(window._lastOutputName||'edited_output');
      fetch(apiUrl('/api/finished/from-render'),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          filePath:apiUrl('/api/render/download').replace(API_BASE,''),
          name:name,
          projectId:window.currentProjectId||null
        })
      }).catch(()=>{});
    }
  };
})();

/* ─── 완료 영상 사이드 패널 (에디터 + 프로젝트 목록) ─── */
function toggleDonePanel(panelId){
  const panel=document.getElementById(panelId);
  if(!panel)return;
  if(panel.classList.contains('open')){
    panel.classList.remove('open');
  }else{
    panel.classList.add('open');
    if(!panel.dataset.loaded){panel.dataset.loaded='1';donePanelInit(panel,panelId)}
    doneLoadVideos(panelId);
  }
}
function donePanelInit(panel,panelId){
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;border-bottom:1px solid #1e1e1e">
      <span style="font-size:12px;font-weight:600;color:#ddd">🎞️ 완료 영상</span>
      <button onclick="toggleDonePanel('${panelId}')" style="background:none;border:none;color:#666;cursor:pointer;font-size:14px">✕</button>
    </div>
    <div style="padding:8px 10px;border-bottom:1px solid #1e1e1e">
      <label style="font-size:10px;color:#888;display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px;border:1px dashed #333;border-radius:6px;justify-content:center" onclick="document.getElementById('doneUpload_${panelId}').click()">
        📂 영상 업로드
      </label>
      <input type="file" id="doneUpload_${panelId}" accept="video/*" style="display:none" onchange="doneUploadFile(this,'${panelId}')">
    </div>
    <div id="doneVideoList_${panelId}" style="flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:6px">
      <div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>
    </div>`;
}
function doneLoadVideos(panelId){
  const list=document.getElementById('doneVideoList_'+panelId);if(!list)return;
  list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">로딩 중...</div>';
  fetch(apiUrl('/api/finished?limit=50')).then(r=>r.json()).then(data=>{
    const videos=data.videos||[];list.innerHTML='';
    if(!videos.length){list.innerHTML='<div style="color:#555;font-size:10px;text-align:center;padding:20px">완료 영상 없음</div>';return}
    videos.forEach(v=>{
      const dur=v.duration?Math.round(v.duration)+'s':'';
      const size=v.file_size?Math.round(v.file_size/1024/1024)+'MB':'';
      const card=document.createElement('div');
      card.style.cssText='background:#1a1a1a;border:1px solid #222;border-radius:6px;overflow:hidden;cursor:pointer;transition:.15s';
      card.onmouseenter=()=>{card.style.borderColor='#444'};card.onmouseleave=()=>{card.style.borderColor='#222'};
      card.innerHTML=`
        <div style="position:relative;width:100%;padding-top:56.25%;background:#000">
          <img src="${apiUrl('/api/finished/'+v.id+'/thumbnail')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" loading="lazy">
          <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">${dur}</div>
        </div>
        <div style="padding:6px 8px">
          <div style="font-size:10px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.name||'Untitled'}</div>
          <div style="font-size:9px;color:#666;margin-top:2px">${size} · ${new Date(v.created_at).toLocaleDateString('ko-KR')}</div>
        </div>`;
      card.onclick=()=>doneOpenDetail(v,card,panelId);
      list.appendChild(card);
    });
  }).catch(()=>{list.innerHTML='<div style="color:#f66;font-size:10px;text-align:center;padding:20px">로드 실패</div>'});
}
function doneOpenDetail(v,card,panelId){
  document.querySelectorAll('.done-detail').forEach(d=>d.remove());
  const detail=document.createElement('div');detail.className='done-detail';
  detail.style.cssText='background:#141414;border:1px solid #2a2a2a;border-radius:6px;padding:10px;margin-top:4px';
  detail.innerHTML=`
    <video src="${apiUrl('/api/finished/'+v.id+'/stream')}" controls style="width:100%;border-radius:4px;max-height:300px;background:#000" playsinline></video>
    <div style="margin-top:6px;display:flex;gap:4px">
      <a href="${apiUrl('/api/finished/'+v.id+'/stream')}" download="${v.name||'video'}.mp4" style="flex:1;text-align:center;background:#2563eb;color:#fff;padding:4px;border-radius:4px;font-size:10px;text-decoration:none">⬇ 다운로드</a>
      <button onclick="doneDelete('${v.id}','${panelId}')" style="background:#dc2626;border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;cursor:pointer">🗑 삭제</button>
    </div>`;
  card.after(detail);
}
function doneDelete(id,panelId){
  if(!confirm('삭제하시겠습니까?'))return;
  fetch(apiUrl('/api/finished/'+id),{method:'DELETE'}).then(()=>doneLoadVideos(panelId)).catch(()=>{});
}
function doneUploadFile(input,panelId){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('file',file);fd.append('name',file.name);
  fetch(apiUrl('/api/finished/upload'),{method:'POST',body:fd}).then(r=>r.json()).then(()=>{
    doneLoadVideos(panelId);input.value='';
  }).catch(()=>{});
}
