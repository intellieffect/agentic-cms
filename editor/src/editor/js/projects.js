/* ─── projects.js — Project CRUD + source selector + analyze ─── */
/* ─── Project list ─── */
function showTab(){loadProjectList()}

/* ─── Project CRUD ─── */
function loadProjectList(){
  const list=document.getElementById('projectList');
  list.innerHTML='<div class="src-loading">불러오는 중...</div>';
  fetch(apiUrl('/api/projects')).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(data=>{
    if(!data.projects||!data.projects.length){
      list.innerHTML='<div class="src-loading" style="color:#555">저장된 프로젝트가 없습니다.<br><br>➕ 새 프로젝트 탭에서 시작하세요</div>';
      return;
    }
    list.innerHTML='';
    data.projects.forEach(p=>{
      const item=document.createElement('div');
      item.className='proj-item';
      // updatedAt: unix timestamp(number) or ISO string
      const ts=typeof p.updatedAt==='number'?p.updatedAt*1000:Date.parse(p.updatedAt);
      const date=new Date(ts);
      const dateStr=isNaN(ts)?'':`${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
      const srcs=(p.sources||[]).slice(0,3).map(s=>typeof s==='object'?s.filename:s).join(', ');
      const isDb=p.source==='db';
      const badge=isDb?'☁️':'💻';
      item.innerHTML=`
        <div style="font-size:18px">${badge}</div>
        <div class="proj-info">
          <div class="proj-name" ondblclick="event.stopPropagation();renameProject('${p.id}',this,${isDb})">${escHtml(p.name||p.id)}</div>
          <div class="proj-meta">${p.clipCount}클립 · ${Math.round(p.totalDuration||0)}초${dateStr?' · '+dateStr:''}</div>
          ${srcs?`<div class="proj-meta">${srcs}</div>`:''}
        </div>
        <span class="proj-del" onclick="event.stopPropagation();renameProject('${p.id}',this.parentElement.querySelector('.proj-name'),${isDb})" title="이름 수정">✏️</span>
        <span class="proj-del" onclick="event.stopPropagation();deleteProject('${p.id}',${isDb})" title="삭제">🗑</span>
      `;
      item.addEventListener('click',()=>loadProject(p.id));
      list.appendChild(item);
    });
  }).catch(e=>{
    console.error('loadProjectList failed:',e);
    list.innerHTML='<div class="src-loading" style="color:#f87171">프로젝트 목록 로드 실패<br>'+e.message+'</div>';
  });
}

let currentDbId=null;
function loadProject(pid){
  fetch(apiUrl('/api/projects/load/'+encodeURIComponent(pid))).then(r=>r.json()).then(data=>{
    currentProjectId=data.id;
    currentDbId=data.dbId||null;
    currentProjectName=data.name||'';
    CLIPS=data.clips||[];
    SUBS=data.globalSubs||data.subs||[];
    // normSubs needs starts[] so defer until after recalc
    // Restore per-clip metadata
    clipMeta=(data.clipMeta||[]).length===CLIPS.length?data.clipMeta:CLIPS.map(()=>({speed:1}));
    // Restore or migrate TRANSITIONS
    if(data.transitions&&data.transitions.length===CLIPS.length-1){
      TRANSITIONS=data.transitions;
    }else{
      // Migration: convert old clipMeta[i].transition to new TRANSITIONS array
      TRANSITIONS=[];
      for(let i=0;i<CLIPS.length-1;i++){
        const m=clipMeta[i+1];
        if(m&&m.transition&&m.transition!=='none'){
          TRANSITIONS.push({type:m.transition,duration:m.transDur||0.5});
        }else{
          TRANSITIONS.push({type:'none',duration:0});
        }
      }
    }
    // Clean transition fields from clipMeta
    clipMeta.forEach(m=>{delete m.transition;delete m.transDur});
    syncTransitions();
    clipSubStyles=(data.clipSubStyles||[]).length===CLIPS.length?data.clipSubStyles:CLIPS.map(()=>({...subStyleDefault}));
    clipCrops=(data.clipCrops||[]).length===CLIPS.length?data.clipCrops:CLIPS.map(()=>({x:0,y:0,w:100,h:100}));
    clipZooms=(data.clipZooms||[]).length===CLIPS.length?data.clipZooms:CLIPS.map(()=>({scale:1,panX:0,panY:0}));
    clipEffects=(data.clipEffects||[]).length===CLIPS.length?data.clipEffects:CLIPS.map(()=>[]);
    globalEffects=data.globalEffects||[];
    fadeInOut=data.fadeInOut||{fadeIn:{enabled:false,duration:1.0},fadeOut:{enabled:false,duration:1.0}};
    _selectedRefUrl=data.selectedRef||'';
    if(_selectedRefUrl){loadRefVideo(_selectedRefUrl);document.getElementById('refPanel').style.display='flex';document.getElementById('refToggleBtn').classList.add('on');populateRefList();scaleSubOv()}
    syncFadeInOutUI();
    // Global KB effects (new format)
    KB_EFFECTS=data.kbEffects||[];
    // Migration: convert legacy clipKenBurns to global KB_EFFECTS
    if(!KB_EFFECTS.length&&data.clipKenBurns&&data.clipKenBurns.length){
      migrateClipKBToGlobal(data.clipKenBurns);
    }
    subTiming=(data.subTiming||[]).length===CLIPS.length?data.subTiming:[];
    // Restore BGM
    if(data.bgmClips&&data.bgmClips.length){BGM_CLIPS=data.bgmClips;setupBgmAudio();}
    else if(data.bgm&&data.bgm.source){BGM_CLIPS=[data.bgm];setupBgmAudio();}
    else{BGM_CLIPS=[];}
    // Set locked state
    _projectLocked = !!(data.locked);
    _updateLockedUI();

    hist=[];cur=0;curKBIdx=-1;
    recalc();normSubs();renderTL();renderKBList();renderBgmTrack();
    if(typeof preloadAllSources==='function')preloadAllSources();
    if(CLIPS.length)sel(0);
    applySubStyle();refreshPresetList();
    document.getElementById('srcOverlay').classList.add('hidden');
    document.title=currentProjectName?`${currentProjectName} — Editor`:'Timeline Editor';
    // Notify parent frame of project info
    try{window.parent.postMessage({type:'brxce-project-info',id:currentProjectId,dbId:currentDbId,name:currentProjectName},'*')}catch(e){}
    // File resolver: check for missing source files
    checkMissingSources();
  });
}

// ============================================
// File Resolver UI
// ============================================
function checkMissingSources(){
  if(!CLIPS.length)return;
  const filenames=[...new Set(CLIPS.map(c=>c.source).filter(Boolean))];
  fetch(apiUrl('/api/resolver/resolve'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filenames})})
    .then(r=>r.json()).then(data=>{
      if(data.missing>0) showResolverDialog(data.results,filenames);
    }).catch(()=>{});
}

function showResolverDialog(results,allFiles){
  const missing=Object.entries(results).filter(([,v])=>v.status==='missing');
  if(!missing.length)return;
  
  // Remove existing dialog
  const old=document.getElementById('resolverOverlay');
  if(old)old.remove();
  
  const overlay=document.createElement('div');
  overlay.id='resolverOverlay';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center';
  
  const dialog=document.createElement('div');
  dialog.style.cssText='background:#1e1e1e;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;color:#fff;font-family:sans-serif';
  
  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 style="margin:0;font-size:16px">⚠️ ${missing.length}개 파일을 찾을 수 없습니다</h3>
    <button onclick="document.getElementById('resolverOverlay').remove()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button>
  </div>`;
  
  // Missing file list
  html+=`<div style="margin-bottom:16px">`;
  for(const [fname]of missing){
    html+=`<div style="padding:8px 12px;background:#2a2a2a;border-radius:6px;margin-bottom:4px;font-size:13px;display:flex;justify-content:space-between;align-items:center" id="rf_${fname.replace(/[^a-zA-Z0-9]/g,'_')}">
      <span>❌ ${fname}</span>
      <button onclick="manualLinkFile('${fname}',this)" style="background:#333;border:1px solid #555;color:#ccc;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">경로 지정</button>
    </div>`;
  }
  html+=`</div>`;
  
  // Add source directory button
  html+=`<div style="border-top:1px solid #333;padding-top:16px">
    <p style="color:#aaa;font-size:12px;margin:0 0 8px">💡 소스 폴더를 지정하면 일괄 검색합니다</p>
    <div style="display:flex;gap:8px">
      <input type="text" id="resolverDirInput" placeholder="/Volumes/Media/영상소스" style="flex:1;padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff;font-size:13px">
      <button onclick="pickResolverDirectory()" id="resolverSearchBtn" style="background:#4a9eff;border:none;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap">📁 폴더 선택</button>
      <button onclick="addResolverDirectory()" style="background:#333;border:1px solid #555;color:#ccc;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap">검색</button>
    </div>
  </div>`;
  
  // Ignore button
  html+=`<div style="text-align:right;margin-top:16px">
    <button onclick="document.getElementById('resolverOverlay').remove()" style="background:#333;border:1px solid #555;color:#ccc;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px">누락 무시하고 계속</button>
  </div>`;
  
  dialog.innerHTML=html;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function pickResolverDirectory(){
  // Finder 폴더 다이얼로그로 경로 선택 후 input에 채움
  fetch(apiUrl('/api/resolver/pick-directory'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})
    .then(r=>r.json()).then(data=>{
      if(data.error){if(data.error!=='cancelled')alert(data.error);return}
      if(data.directory){
        document.getElementById('resolverDirInput').value=data.directory;
        addResolverDirectory();
      }
    }).catch(()=>{});
}

function addResolverDirectory(){
  const dir=document.getElementById('resolverDirInput').value.trim();
  if(!dir){alert('폴더 경로를 입력하세요');return}
  const filenames=[...new Set(CLIPS.map(c=>c.source).filter(Boolean))];
  
  const btn=document.getElementById('resolverSearchBtn');
  btn.textContent='검색 중...';btn.disabled=true;
  
  fetch(apiUrl('/api/resolver/add-directory'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({directory:dir,filenames})})
    .then(r=>r.json()).then(data=>{
      if(data.error){alert(data.error);btn.textContent='📁 폴더 선택';btn.disabled=false;return}
      // Update UI with results
      for(const [fname,info]of Object.entries(data.results||{})){
        const el=document.getElementById('rf_'+fname.replace(/[^a-zA-Z0-9]/g,'_'));
        if(el&&info.status==='found'){
          el.innerHTML=`<span>✅ ${fname}</span><span style="color:#666;font-size:11px">${info.method||'found'}</span>`;
          el.style.background='#1a3a1a';
        }
      }
      btn.textContent='📁 폴더 선택';btn.disabled=false;
      // If all resolved, auto-close
      if(data.missing===0){
        setTimeout(()=>{const ov=document.getElementById('resolverOverlay');if(ov)ov.remove()},1000);
      }
    }).catch(e=>{alert('검색 실패: '+e);btn.textContent='📁 폴더 선택';btn.disabled=false});
}

function manualLinkFile(filename,btn){
  // Finder 파일 다이얼로그로 경로 선택
  if(!btn)btn=event?.target;
  const origText=btn?btn.textContent:'';
  btn.textContent='선택 중...';btn.disabled=true;
  
  fetch(apiUrl('/api/resolver/pick-file'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename})})
    .then(r=>r.json()).then(data=>{
      btn.textContent=origText;btn.disabled=false;
      if(data.error){if(data.error!=='cancelled')alert(data.error);return}
      const filepath=data.filepath;
      if(!filepath)return;
      // 선택한 파일을 link
      fetch(apiUrl('/api/resolver/link-file'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename,filepath})})
        .then(r=>r.json()).then(linkData=>{
          if(linkData.error){alert(linkData.error);return}
          const el=document.getElementById('rf_'+filename.replace(/[^a-zA-Z0-9]/g,'_'));
          if(el){
            el.innerHTML=`<span>✅ ${filename}</span><span style="color:#666;font-size:11px">수동 지정</span>`;
            el.style.background='#1a3a1a';
          }
        }).catch(e=>alert('연결 실패: '+e));
    }).catch(e=>{btn.textContent=origText;btn.disabled=false;alert('파일 선택 실패: '+e)});
}

let _projectLocked = false; // set on project load

function saveProject(){
  if(_guardLocked())return;
  if(!CLIPS.length){alert('편집 데이터가 없습니다');return}
  if(!currentProjectName){
    const name=prompt('프로젝트 이름:');
    if(!name)return;
    currentProjectName=name;
  }
  if(!currentProjectId)currentProjectId='proj_'+Date.now();
  
  const sources=[...new Set(CLIPS.map(c=>c.source))];
  const payload={
    id:currentProjectId,
    dbId:currentDbId||undefined,
    name:currentProjectName,
    clips:CLIPS,
    subs:SUBS,
    globalSubs:SUBS,
    clipMeta,
    transitions:TRANSITIONS,
    clipSubStyles,
    clipCrops,
    clipZooms,
    clipEffects,
    globalEffects,
    kbEffects:KB_EFFECTS,
    fadeInOut,
    bgmClips:typeof BGM_CLIPS!=='undefined'?BGM_CLIPS:[],
    selectedRef:_selectedRefUrl||'',
    subTiming:subTiming.map(t=>({start:t.start,end:t.end,_manual:!!t._manual})),
    sources,
    totalDuration:total
  };
  
  fetch(apiUrl('/api/projects/save'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(r=>{if(r.status===403)throw new Error('locked');return r.json()}).then(r=>{
      if(r.error){alert('⚠️ '+r.error);return}
      if(r.id)currentProjectId=r.id;
      if(r.dbId)currentDbId=r.dbId;
      document.title=`${currentProjectName} — Editor`;
      try{window.parent.postMessage({type:'brxce-project-info',id:currentProjectId,dbId:currentDbId,name:currentProjectName},'*')}catch(e){}
      // Brief visual feedback
      const btn=document.querySelector('[onclick="saveProject()"]');
      btn.textContent='✅ 저장됨';
      setTimeout(()=>{btn.textContent='💾 저장'},1500);
    });
}

function saveProjectAs(){
  if(!CLIPS.length){alert('편집 데이터가 없습니다');return}
  const name=prompt('새 프로젝트 이름:', (currentProjectName||'')+ ' 복사');
  if(!name)return;
  // Unlock the copy
  const wasLocked = _projectLocked;
  _projectLocked = false;
  currentProjectId='proj_'+Date.now();
  currentDbId=null;
  currentProjectName=name;
  _updateLockedUI();
  saveProject();
  // Note: if save fails, we don't re-lock since it's a new project
}

function renameProject(pid, el, isDb){
  const old=el.textContent;
  const input=document.createElement('input');
  input.type='text';input.value=old;
  input.style.cssText='background:#111;border:1px solid #2563eb;color:#fff;font-size:12px;font-weight:600;padding:2px 6px;border-radius:4px;width:100%';
  el.replaceWith(input);input.focus();input.select();
  const save=()=>{
    const newName=input.value.trim()||old;
    const span=document.createElement('div');
    span.className='proj-name';span.textContent=newName;
    span.setAttribute('ondblclick',`event.stopPropagation();renameProject('${pid}',this,${!!isDb})`);
    input.replaceWith(span);
    if(newName!==old){
      const payload=isDb?{id:pid,dbId:pid,name:newName}:{id:pid,name:newName};
      fetch(apiUrl('/api/projects/rename'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(currentProjectId===pid)currentProjectName=newName;
    }
  };
  input.addEventListener('blur',save);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape'){input.value=old;input.blur()}});
}

function deleteProject(pid,isDb){
  if(!confirm('이 프로젝트를 삭제할까요?'))return;
  const body={id:pid};
  if(isDb)body.dbId=pid;
  fetch(apiUrl('/api/projects/delete'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(()=>loadProjectList());
}

/* ─── Source Selector ─── */
function loadVideoList(){
  fetch(apiUrl('/api/list-videos')).then(r=>r.json()).then(data=>{
    const list=document.getElementById('srcList');
    if(!data.videos||!data.videos.length){
      list.innerHTML='<div class="src-loading">영상 파일이 없습니다. 폴더에 영상을 넣어주세요.</div>';
      return;
    }
    list.innerHTML='';
    data.videos.forEach((v,i)=>{
      if(v.fps)srcFps[v.name]=v.fps;
      const item=document.createElement('div');
      item.className='src-item selected';
      item.draggable=true;
      item.dataset.name=v.name;
      item.innerHTML=`
        <img class="src-thumb" src="${apiUrl('/api/thumbnail/'+encodeURIComponent(v.name))}" alt="" onerror="this.style.display='none'">
        <input type="checkbox" class="src-check" checked>
        <span class="src-idx">${i+1}</span>
        <span class="src-name">🎥 ${escHtml(v.name)}</span>
        <span class="src-meta">${v.duration}s · ${v.size}MB · ${v.fps||30}fps</span>
        <span class="src-drag">⠿</span>
        <span class="proj-del" title="목록에서 제거" onclick="event.stopPropagation();this.closest('.src-item').remove();reindexSrcList()">✕</span>
      `;
      // Toggle selection
      item.querySelector('.src-check').addEventListener('change',function(){
        item.classList.toggle('selected',this.checked);
      });
      // Drag reorder
      item.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',i);item.style.opacity='0.4'});
      item.addEventListener('dragend',()=>{item.style.opacity='1'});
      item.addEventListener('dragover',e=>{e.preventDefault();item.style.borderTopColor='#2563eb'});
      item.addEventListener('dragleave',()=>{item.style.borderTopColor=''});
      item.addEventListener('drop',e=>{
        e.preventDefault();item.style.borderTopColor='';
        const from=parseInt(e.dataTransfer.getData('text/plain'));
        const items=[...list.children];
        const target=items.indexOf(item);
        if(from!==target){
          const el=items[from];
          if(from<target)item.after(el);else item.before(el);
          reindexSrcList();
        }
      });
      list.appendChild(item);
    });
  }).catch(()=>{
    document.getElementById('srcList').innerHTML='<div class="src-loading">서버 연결 실패</div>';
  });
}

function handleFileDrop(e){
  e.preventDefault();e.currentTarget.style.borderColor='';
  const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('video/')||f.type.startsWith('image/'));
  if(files.length)uploadFiles(files);
}

function uploadFiles(fileList){
  if(!fileList.length)return;
  const fd=new FormData();
  for(const f of fileList)fd.append('files',f);
  
  const btn=document.querySelector('[onclick*="fileUpload"]');
  btn.disabled=true;btn.textContent='⏳ 업로드 중...';
  
  fetch(apiUrl('/api/upload'),{method:'POST',body:fd})
    .then(r=>r.json()).then(data=>{
      btn.disabled=false;btn.textContent='📁 영상 추가';
      if(data.uploaded&&data.uploaded.length){
        addVideosToList(data.uploaded);
      }
      document.getElementById('fileUpload').value='';
    }).catch(e=>{
      btn.disabled=false;btn.textContent='📁 영상 추가';
      alert('업로드 실패: '+e);
    });
}

function addVideosToList(videos){
  const list=document.getElementById('srcList');
  // Clear placeholder
  const placeholder=list.querySelector('.src-loading');
  if(placeholder)placeholder.remove();
  
  const existingNames=new Set([...list.querySelectorAll('.src-item')].map(el=>el.dataset.name));
  
  videos.forEach(v=>{
    if(existingNames.has(v.name))return; // skip duplicates
    const idx=list.querySelectorAll('.src-item').length;
    const item=document.createElement('div');
    item.className='src-item selected';
    item.draggable=true;
    item.dataset.name=v.name;
    item.innerHTML=`
      <img class="src-thumb" src="${apiUrl('/api/thumbnail/'+encodeURIComponent(v.name))}" alt="" onerror="this.style.display='none'">
      <input type="checkbox" class="src-check" checked>
      <span class="src-idx">${idx+1}</span>
      <span class="src-name">🎥 ${escHtml(v.name)}</span>
      <span class="src-meta">${v.duration}s · ${v.size}MB</span>
      <span class="src-drag">⠿</span>
      <span class="proj-del" title="목록에서 제거" onclick="event.stopPropagation();this.closest('.src-item').remove();reindexSrcList()">✕</span>
    `;
    item.querySelector('.src-check').addEventListener('change',function(){
      item.classList.toggle('selected',this.checked);
    });
    item.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',idx);item.style.opacity='0.4'});
    item.addEventListener('dragend',()=>{item.style.opacity='1'});
    item.addEventListener('dragover',e=>{e.preventDefault();item.style.borderTopColor='#2563eb'});
    item.addEventListener('dragleave',()=>{item.style.borderTopColor=''});
    item.addEventListener('drop',e=>{
      e.preventDefault();item.style.borderTopColor='';
      const from=parseInt(e.dataTransfer.getData('text/plain'));
      const items=[...list.children];
      const target=items.indexOf(item);
      if(from!==target){
        const el=items[from];
        if(from<target)item.after(el);else item.before(el);
        reindexSrcList();
      }
    });
    list.appendChild(item);
  });
  reindexSrcList();
}

function reindexSrcList(){
  document.querySelectorAll('.src-item .src-idx').forEach((el,i)=>el.textContent=i+1);
}

function getSelectedFiles(){
  const items=[...document.querySelectorAll('.src-item')];
  return items.filter(el=>el.querySelector('.src-check').checked).map(el=>el.dataset.name);
}

function startAnalyze(){
  const files=getSelectedFiles();
  if(!files.length){alert('영상을 선택해주세요');return}
  
  const subMode=document.getElementById('optAutoSub').value;
  const apiKey=document.getElementById('optApiKey').value.trim();
  // Save API key to localStorage
  if(apiKey)localStorage.setItem('tvcut_api_key',apiKey);
  const options={
    maxDuration:parseInt(document.getElementById('optMaxDur').value)||60,
    clipMin:parseFloat(document.getElementById('optClipMin').value)||1.5,
    clipMax:parseFloat(document.getElementById('optClipMax').value)||8,
    sceneThreshold:parseInt(document.getElementById('optScene').value)/100,
    subtitleMode:subMode,
    context:document.getElementById('subContext').value.trim(),
    apiKey:apiKey||localStorage.getItem('tvcut_api_key')||''
  };
  
  // Show analyze dialog
  showAnalyzeDialog(files.length);
  
  fetch(apiUrl('/api/analyze'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files,options})})
    .then(r=>r.json()).then(()=>pollAnalyze())
    .catch(e=>{analyzeError('분석 요청 실패: '+e)});
}

let _analyzeStartTime=0;

function showAnalyzeDialog(fileCount){
  _analyzeStartTime=Date.now();
  const ov=document.getElementById('analyzeOverlay');
  ov.classList.add('show');
  document.getElementById('analyzeSpinner').style.display='inline-block';
  document.getElementById('analyzeDoneIcon').style.display='none';
  document.getElementById('analyzeTitle').textContent='영상 분석 중...';
  document.getElementById('analyzeBar').style.width='10%';
  document.getElementById('analyzeBar').style.background='#2563eb';
  document.getElementById('analyzeStatusText').textContent='준비 중...';
  document.getElementById('analyzeDetailText').textContent=`${fileCount}개 영상`;
  document.getElementById('analyzeDoneBtn').style.display='none';
}

function pollAnalyze(){
  const poll=()=>{
    fetch(apiUrl('/api/analyze/status')).then(r=>r.json()).then(s=>{
      const elapsed=((Date.now()-_analyzeStartTime)/1000).toFixed(0);
      if(s.state==='analyzing'){
        document.getElementById('analyzeStatusText').textContent=s.progress||'분석 중...';
        document.getElementById('analyzeDetailText').textContent=`${elapsed}초 경과`;
        // Animate bar
        const cur=parseFloat(document.getElementById('analyzeBar').style.width)||10;
        document.getElementById('analyzeBar').style.width=Math.min(cur+2,85)+'%';
        setTimeout(poll,1000);
      } else if(s.state==='done'&&s.result){
        analyzeSuccess(elapsed,s.result);
      } else if(s.state==='error'){
        analyzeError(s.error);
      } else {
        setTimeout(poll,1000);
      }
    }).catch(()=>setTimeout(poll,2000));
  };
  poll();
}

function analyzeSuccess(elapsed,result){
  document.getElementById('analyzeSpinner').style.display='none';
  document.getElementById('analyzeDoneIcon').style.display='block';
  document.getElementById('analyzeDoneIcon').textContent='✅';
  document.getElementById('analyzeTitle').textContent='분석 완료!';
  document.getElementById('analyzeBar').style.width='100%';
  document.getElementById('analyzeBar').style.background='#22c55e';
  document.getElementById('analyzeStatusText').textContent=`${result.clips?.length||0}개 클립 생성`;
  document.getElementById('analyzeDetailText').textContent=`${elapsed}초 소요`;
  document.getElementById('analyzeDoneBtn').style.display='inline-block';
  document.getElementById('analyzeDoneBtn').onclick=()=>{
    closeAnalyzeDialog();
    loadAnalyzeResult(result);
  };
}

function analyzeError(msg){
  document.getElementById('analyzeSpinner').style.display='none';
  document.getElementById('analyzeDoneIcon').style.display='block';
  document.getElementById('analyzeDoneIcon').textContent='❌';
  document.getElementById('analyzeTitle').textContent='분석 실패';
  document.getElementById('analyzeBar').style.width='100%';
  document.getElementById('analyzeBar').style.background='#ef4444';
  document.getElementById('analyzeStatusText').textContent=msg||'알 수 없는 오류';
  document.getElementById('analyzeDetailText').textContent='';
  document.getElementById('analyzeDoneBtn').style.display='inline-block';
  document.getElementById('analyzeDoneBtn').onclick=()=>closeAnalyzeDialog();
}

function closeAnalyzeDialog(){
  document.getElementById('analyzeOverlay').classList.remove('show');
}

function loadAnalyzeResult(result){
  CLIPS=result.clips||[];
  SUBS=result.subs||[];
  recalc();normSubs();
  // Set project name from input
  currentProjectName=document.getElementById('projName').value||'새 프로젝트 '+new Date().toLocaleDateString('ko');
  currentProjectId='proj_'+Date.now();
  currentDbId=null;
  initEditorState();
  document.getElementById('srcOverlay').classList.add('hidden');
  document.title=`${currentProjectName} — Editor`;
  try{window.parent.postMessage({type:'brxce-project-info',id:currentProjectId,dbId:currentDbId,name:currentProjectName},'*')}catch(e){}
  // Auto-save
  saveProject();
}

function skipToEditor(){
  if(!CLIPS.length){
    alert('편집 데이터가 없습니다. 분석을 먼저 실행해주세요.');
    return;
  }
  document.getElementById('srcOverlay').classList.add('hidden');
}

function showSourceSelector(){
  document.getElementById('srcOverlay').classList.remove('hidden');
  showTab();
}


/* ─── 바로 타임라인에 추가 (분석 없이) ─── */
function quickAddToTimeline(){
  const files=getSelectedFiles();
  if(!files.length){alert('영상을 선택해주세요');return}
  
  // 선택된 파일들의 정보를 가져와서 바로 CLIPS로 변환
  const projName=document.getElementById('projName').value||'새 프로젝트 '+new Date().toLocaleDateString('ko');
  
  // ffprobe로 각 파일 duration 가져오기
  fetch(apiUrl('/api/resolver/resolve'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filenames:files})})
    .then(r=>r.json()).then(resolveData=>{
      const clips=[];
      const promises=files.map(fname=>{
        return fetch(apiUrl('/api/media/probe/'+encodeURIComponent(fname)))
          .then(r=>r.ok?r.json():null)
          .then(info=>{
            const dur=(info&&info.duration)?info.duration:10;
            clips.push({source:fname,start:0,end:dur,subtitle:''});
          })
          .catch(()=>{
            clips.push({source:fname,start:0,end:10,subtitle:''});
          });
      });
      
      Promise.all(promises).then(()=>{
        // 파일 순서 유지
        CLIPS=files.map(fname=>clips.find(c=>c.source===fname)||{source:fname,start:0,end:10,subtitle:''});
        SUBS=[];
        currentProjectName=projName;
        currentProjectId='proj_'+Date.now();
        initEditorState();
        document.getElementById('srcOverlay').classList.add('hidden');
        document.title=`${currentProjectName} — Editor`;
        saveProject();
      });
    })
    .catch(()=>{
      // resolve 실패해도 바로 추가
      CLIPS=files.map(fname=>({source:fname,start:0,end:10,subtitle:''}));
      SUBS=[];
      currentProjectName=projName;
      currentProjectId='proj_'+Date.now();
      initEditorState();
      document.getElementById('srcOverlay').classList.add('hidden');
      document.title=`${currentProjectName} — Editor`;
      saveProject();
    });
}

/* ─── Locked project UI ─── */
function _showLockedModal(msg) {
  const modal = document.getElementById('lockedModal');
  const msgEl = document.getElementById('lockedModalMsg');
  if (msg && msgEl) msgEl.innerHTML = msg;
  if (modal) modal.style.display = 'flex';
}

function _updateLockedUI() {
  const banner = document.getElementById('lockedBanner');
  const saveBtn = document.querySelector('[onclick="saveProject()"]');

  if (_projectLocked) {
    // Show banner
    if (banner) banner.style.display = '';
    // Offset editor content below banner
    document.body.style.paddingTop = '32px';
    // Disable save button
    if (saveBtn) {
      saveBtn.textContent = '🔒 잠금됨';
      saveBtn.style.opacity = '0.5';
      saveBtn.style.pointerEvents = 'none';
    }
    // Add locked class for CSS-based interaction blocking
    document.body.classList.add('project-locked');
  } else {
    if (banner) banner.style.display = 'none';
    document.body.style.paddingTop = '';
    if (saveBtn) {
      saveBtn.textContent = '💾 저장';
      saveBtn.style.opacity = '';
      saveBtn.style.pointerEvents = '';
    }
    document.body.classList.remove('project-locked');
  }
}

/* Guard function: call before any edit operation */
function _guardLocked() {
  if (!_projectLocked) return false;
  _showLockedModal('이 프로젝트는 잠금 상태입니다.<br>수정하려면 프로젝트 리스트에서 잠금을 해제하거나,<br><b>복사하여 편집</b>하세요.');
  return true; // blocked
}
