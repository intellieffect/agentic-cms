/* ─── init.js — Init + PostMessage API ─── */
/* ─── Init ─── */
restoreLastStyle();refreshPresetList();

// URL ?project={id} → 해당 프로젝트 자동 로드, 오버레이 스킵
(function checkUrlProject(){
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('project');
  if(pid){
    // Hide source overlay immediately — don't flash while loading
    document.getElementById('srcOverlay').classList.add('hidden');
    // loadProject is defined in projects.js — loads and inits editor
    loadProject(pid);
    return;
  }
  showTab(); // Load project list on start
})();

// If CLIPS pre-loaded (e.g. from inline data), init editor
if(CLIPS.length){
  _hasInitialData=true;
  initEditorState();
  document.getElementById('srcOverlay').classList.add('hidden');
}

/* ─── Reference → New Project flow ─── */
(function checkRefProject(){
  const raw=localStorage.getItem('brxce-ref-project');
  if(!raw)return;
  localStorage.removeItem('brxce-ref-project');
  try{
    const ref=JSON.parse(raw);
    // Pre-fill project name with account name
    const projNameInput=document.getElementById('projName');
    if(projNameInput&&ref.accountName){
      projNameInput.value=ref.accountName+' 프로젝트';
      projNameInput.focus();
    }
  }catch(e){}
})();

/* ─── PostMessage API for parent frame (BrxceStudio) ─── */
window.addEventListener('message', async function(e) {
  // origin 검증 (localhost 개발 + 배포 도메인)
  const allowed = ['http://localhost:3200','http://localhost:3100','https://studio.brxce.ai'];
  if(!allowed.some(o=>e.origin===o||e.origin.startsWith('http://localhost:')))return;
  if (!e.data) return;
  // Handle rename from parent
  if (e.data.type === 'brxce-rename-project') {
    if(e.data.name){currentProjectName=e.data.name;document.title=`${currentProjectName} — Editor`;}
    return;
  }
  if (e.data.type !== 'brxce-load-preset') return;
  const preset = e.data.project;
  if (!preset) return;
  
  currentProjectId = 'preset_' + Date.now();
  // Auto-number: fetch existing projects to check name conflicts
  const baseName = preset.name || '프리셋 프로젝트';
  currentProjectName = baseName;
  try {
    const resp = await fetch(apiUrl('/api/projects'));
    const pdata = await resp.json();
    if (pdata.projects && pdata.projects.length) {
      const names = pdata.projects.map(p => p.name || '');
      if (names.includes(baseName)) {
        let n = 2;
        while (names.includes(`${baseName} ${n}`)) n++;
        currentProjectName = `${baseName} ${n}`;
      }
    }
  } catch(e) {}
  CLIPS = (preset.clips || []).map(c => ({
    source: c.source || '',
    start: c.start || 0,
    end: c.end || 5,
    source_idx: c.source_idx || 0
  }));
  // Build global subs: prefer globalSubs array, fallback to per-clip subtitle
  SUBS = [];
  if (preset.globalSubs && Array.isArray(preset.globalSubs) && preset.globalSubs.length) {
    preset.globalSubs.forEach(gs => {
      SUBS.push({
        id: nextSubId(),
        text: gs.text || '',
        style: gs.style ? {...subStyleDefault, ...gs.style} : {...subStyleDefault},
        start: gs.start || 0,
        end: gs.end || 3
      });
    });
  } else {
    let _presetOffset = 0;
    (preset.clips || []).forEach(c => {
      const dur = (c.end || 5) - (c.start || 0);
      if (c.subtitle) {
        SUBS.push({id: nextSubId(), text: c.subtitle, style: {...subStyleDefault}, start: _presetOffset, end: _presetOffset + dur});
      }
      _presetOffset += dur;
    });
  }
  clipMeta = CLIPS.map(c => ({
    speed: c.speed || (preset.clips && preset.clips[CLIPS.indexOf(c)]?.speed) || 1
  }));
  TRANSITIONS=[];syncTransitions();
  // Re-read speed from preset clips
  (preset.clips || []).forEach((c, i) => {
    if (c.speed && clipMeta[i]) clipMeta[i].speed = c.speed;
  });
  clipSubStyles = CLIPS.map(() => ({...subStyleDefault}));
  clipCrops = CLIPS.map(() => ({x:0, y:0, w:100, h:100}));
  clipZooms = (preset.clips || []).map(c => c.zoom || {scale:1, panX:0, panY:0});
  subTiming = [];
  hist = []; cur = 0;
  
  recalc(); renderTL();
  if (CLIPS.length) sel(0);
  applySubStyle(); refreshPresetList();
  document.getElementById('srcOverlay').classList.add('hidden');
  document.title = currentProjectName + ' — Editor';
  
  // Notify parent that preset was loaded
  // 부모 origin이 있으면 사용, 없으면 referrer 기반
  const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
  window.parent.postMessage({type: 'brxce-preset-loaded', id: currentProjectId}, parentOrigin);
});
