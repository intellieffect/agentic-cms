/* ─── kenburns.js — Ken Burns effects ─── */

/* ─── Ken Burns (auto zoom) — Global track system ─── */
let KB_EFFECTS=[];  // [{id, effect, intensity, start, end}]
let curKBIdx=-1;    // currently selected global KB index
let _kbIdCounter=0;
function nextKBId(){return 'kb_'+(++_kbIdCounter)+'_'+Date.now()}

// Per-clip effects: clipEffects[i] = [{type, intensity, duration}]
let clipEffects=[];
// Global effects
let globalEffects=[];  // [{type, intensity, duration}]
let fadeInOut={fadeIn:{enabled:false,duration:1.0},fadeOut:{enabled:false,duration:1.0}};
// fadeIn/fadeOut managed via timeline popups
function onFadeInOutChange(){}
function syncFadeInOutUI(){}
let curFxIdx=-1;       // selected clip effect index

const FX_DEFS={
  grain:{label:'Grain/Noise',css:'brightness(1.05) contrast(1.1)',hasDur:false},
  vhs:{label:'VHS/Retro',css:'sepia(0.3) contrast(1.2) saturate(1.3)',hasDur:false},
  glitch:{label:'Glitch',css:'',hasDur:false},
  blur:{label:'Blur',css:'blur(3px)',hasDur:false},
  sharpen:{label:'Sharpen',css:'contrast(1.2)',hasDur:false},
  vignette:{label:'Vignette',css:'',hasDur:false},
  bw:{label:'흑백',css:'grayscale(1)',hasDur:false},
  sepia:{label:'세피아',css:'sepia(1)',hasDur:false},
  fadeIn:{label:'Fade In',css:'',hasDur:true},
  fadeOut:{label:'Fade Out',css:'',hasDur:true},
};

function fxOf(i){return clipEffects[i]||[]}

function showAddEffectMenu(e,target){
  e.stopPropagation();
  document.getElementById('fxDropdown')?.remove();
  const menu=document.createElement('div');
  menu.id='fxDropdown';
  menu.style.cssText='position:fixed;z-index:500;background:#1e1e1e;border:1px solid #3a3a3a;border-radius:8px;padding:4px 0;box-shadow:0 8px 24px rgba(0,0,0,.6);max-height:280px;overflow-y:auto;min-width:160px';
  // Position with bounds checking
  let mx=e.clientX,my=e.clientY;
  requestAnimationFrame(()=>{
    const r=menu.getBoundingClientRect();
    if(mx+r.width>window.innerWidth)mx=window.innerWidth-r.width-8;
    if(my+r.height>window.innerHeight)my=window.innerHeight-r.height-8;
    menu.style.left=Math.max(4,mx)+'px';menu.style.top=Math.max(4,my)+'px';
  });
  menu.style.left=mx+'px';menu.style.top=my+'px';
  Object.entries(FX_DEFS).forEach(([type,def])=>{
    const item=document.createElement('div');
    item.style.cssText='padding:6px 14px;font-size:11px;color:#ddd;cursor:pointer;display:flex;align-items:center;gap:6px';
    item.innerHTML=`<span class="fx-badge ${type}">${type}</span>${def.label}`;
    item.onmouseenter=()=>item.style.background='#333';
    item.onmouseleave=()=>item.style.background='';
    item.onclick=()=>{
      menu.remove();
      if(target==='clip'){
        addClipEffect(type);
      }else{
        addGlobalEffect(type);
      }
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  const close=ev=>{if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('mousedown',close)}};
  setTimeout(()=>document.addEventListener('mousedown',close),10);
}

function addClipEffect(type){
  if(cur<0)return;
  save();
  if(!clipEffects[cur])clipEffects[cur]=[];
  clipEffects[cur].push({type,intensity:0.5,duration:1.0});
  curFxIdx=clipEffects[cur].length-1;
  renderFxList();syncFxEditPanel();applyEffectPreview();
}

let curGfxIdx=-1;

function addGlobalEffect(type){
  save();
  globalEffects.push({type,intensity:0.5,duration:1.0});
  curGfxIdx=globalEffects.length-1;
  renderGfxList();syncGfxEditPanel();applyEffectPreview();
}

function removeClipEffect(idx){
  if(cur<0||!clipEffects[cur])return;
  save();
  clipEffects[cur].splice(idx,1);
  if(curFxIdx>=clipEffects[cur].length)curFxIdx=clipEffects[cur].length-1;
  renderFxList();syncFxEditPanel();applyEffectPreview();
}

function removeGlobalEffect(idx){
  save();
  globalEffects.splice(idx,1);
  if(curGfxIdx>=globalEffects.length)curGfxIdx=globalEffects.length-1;
  renderGfxList();syncGfxEditPanel();applyEffectPreview();
}

function selectGfx(idx){
  curGfxIdx=idx;
  syncGfxEditPanel();
  document.querySelectorAll('#gfxList .fx-item').forEach((el,i)=>el.style.background=i===idx?'#1e1e1e':'#161616');
}

function syncGfxEditPanel(){
  const panel=document.getElementById('gfxEditPanel');
  if(curGfxIdx<0||!globalEffects[curGfxIdx]){panel.style.display='none';return}
  panel.style.display='block';
  const fx=globalEffects[curGfxIdx];
  document.getElementById('gfxIntensity').value=Math.round(fx.intensity*100);
  document.getElementById('gfxIntensityVal').textContent=Math.round(fx.intensity*100)+'%';
  const hasDur=FX_DEFS[fx.type]?.hasDur;
  document.getElementById('gfxDurRow').style.display=hasDur?'flex':'none';
  if(hasDur)document.getElementById('gfxDuration').value=fx.duration;
}

function onGfxIntensityChange(){
  if(curGfxIdx<0||!globalEffects[curGfxIdx])return;
  const v=parseInt(document.getElementById('gfxIntensity').value);
  document.getElementById('gfxIntensityVal').textContent=v+'%';
  globalEffects[curGfxIdx].intensity=v/100;
  applyEffectPreview();
}

function onGfxDurationChange(){
  if(curGfxIdx<0||!globalEffects[curGfxIdx])return;
  globalEffects[curGfxIdx].duration=parseFloat(document.getElementById('gfxDuration').value)||1;
}

function selectFx(idx){
  curFxIdx=idx;
  syncFxEditPanel();
  document.querySelectorAll('#fxList .fx-item').forEach((el,i)=>el.style.background=i===idx?'#1e1e1e':'#161616');
}

function syncFxEditPanel(){
  const panel=document.getElementById('fxEditPanel');
  if(cur<0||curFxIdx<0||!clipEffects[cur]||!clipEffects[cur][curFxIdx]){panel.style.display='none';return}
  panel.style.display='block';
  const fx=clipEffects[cur][curFxIdx];
  document.getElementById('fxIntensity').value=Math.round(fx.intensity*100);
  document.getElementById('fxIntensityVal').textContent=Math.round(fx.intensity*100)+'%';
  const hasDur=FX_DEFS[fx.type]?.hasDur;
  document.getElementById('fxDurRow').style.display=hasDur?'flex':'none';
  if(hasDur)document.getElementById('fxDuration').value=fx.duration;
}

function onFxIntensityChange(){
  if(cur<0||curFxIdx<0||!clipEffects[cur]||!clipEffects[cur][curFxIdx])return;
  const v=parseInt(document.getElementById('fxIntensity').value);
  document.getElementById('fxIntensityVal').textContent=v+'%';
  clipEffects[cur][curFxIdx].intensity=v/100;
  applyEffectPreview();
}

function onFxDurationChange(){
  if(cur<0||curFxIdx<0||!clipEffects[cur]||!clipEffects[cur][curFxIdx])return;
  clipEffects[cur][curFxIdx].duration=parseFloat(document.getElementById('fxDuration').value)||1;
}

function renderFxList(){
  const list=document.getElementById('fxList');
  const effects=fxOf(cur);
  if(!effects.length){
    list.innerHTML='<div style="font-size:10px;color:#555;padding:4px 0">이펙트 없음</div>';
    curFxIdx=-1;syncFxEditPanel();
    return;
  }
  list.innerHTML='';
  effects.forEach((fx,i)=>{
    const def=FX_DEFS[fx.type]||{label:fx.type};
    const item=document.createElement('div');
    item.className='fx-item';
    if(i===curFxIdx)item.style.background='#1e1e1e';
    item.innerHTML=`
      <span class="fx-badge ${fx.type}">${fx.type}</span>
      <span class="fx-name">${def.label}</span>
      <span class="fx-val">${Math.round(fx.intensity*100)}%</span>
      <span class="fx-del" onclick="event.stopPropagation();removeClipEffect(${i})">✕</span>
    `;
    item.onclick=()=>selectFx(i);
    list.appendChild(item);
  });
}

function renderGfxList(){
  const list=document.getElementById('gfxList');
  if(!globalEffects.length){
    list.innerHTML='<div style="font-size:10px;color:#555;padding:4px 0">없음</div>';
    curGfxIdx=-1;syncGfxEditPanel();
    return;
  }
  list.innerHTML='';
  globalEffects.forEach((fx,i)=>{
    const def=FX_DEFS[fx.type]||{label:fx.type};
    const item=document.createElement('div');
    item.className='fx-item';
    if(i===curGfxIdx)item.style.background='#1e1e1e';
    item.innerHTML=`
      <span class="fx-badge ${fx.type}">${fx.type}</span>
      <span class="fx-name">${def.label}</span>
      <span class="fx-val">${Math.round(fx.intensity*100)}%</span>
      <span class="fx-del" onclick="event.stopPropagation();removeGlobalEffect(${i})">✕</span>
    `;
    item.onclick=()=>selectGfx(i);
    list.appendChild(item);
  });
}

function buildCssFilter(effects){
  let parts=[];
  for(const fx of (effects||[])){
    const def=FX_DEFS[fx.type];
    if(!def||!def.css)continue;
    // Scale CSS filter by intensity
    const i=fx.intensity;
    if(fx.type==='grain')parts.push(`brightness(${1+0.05*i}) contrast(${1+0.1*i})`);
    else if(fx.type==='vhs')parts.push(`sepia(${0.3*i}) contrast(${1+0.2*i}) saturate(${1+0.3*i})`);
    else if(fx.type==='blur')parts.push(`blur(${Math.round(i*6)}px)`);
    else if(fx.type==='sharpen')parts.push(`contrast(${1+0.2*i})`);
    else if(fx.type==='bw')parts.push(`grayscale(${i})`);
    else if(fx.type==='sepia')parts.push(`sepia(${i})`);
  }
  return parts.join(' ');
}

function applyEffectPreview(){
  const vid=document.getElementById('vid');
  if(!vid)return;
  const clipFx=fxOf(cur);
  const allFx=[...clipFx,...globalEffects];
  const css=buildCssFilter(allFx);
  vid.style.filter=css||'';
}

function getKBAtTime(t){
  return KB_EFFECTS.filter(kb=>t>=kb.start&&t<kb.end);
}

function addKBEffect(){
  save();
  const kbStart=Math.max(0,gTime);
  const kbEnd=Math.min(total||30,gTime+3);
  const newKB={id:nextKBId(),effect:'zoom-in',intensity:15,start:kbStart,end:kbEnd};
  KB_EFFECTS.push(newKB);
  curKBIdx=KB_EFFECTS.length-1;
  syncKBEditPanel();renderKBList();renderTL();
}

function removeKBByIndex(gi){
  save();
  if(gi>=0&&gi<KB_EFFECTS.length)KB_EFFECTS.splice(gi,1);
  if(curKBIdx>=KB_EFFECTS.length)curKBIdx=Math.max(-1,KB_EFFECTS.length-1);
  syncKBEditPanel();renderKBList();renderTL();
}

function selectKB(gi){
  curKBIdx=gi;
  syncKBEditPanel();renderKBList();renderTL();
}

function onKBEffectChange(){
  if(curKBIdx<0||!KB_EFFECTS[curKBIdx])return;
  KB_EFFECTS[curKBIdx].effect=document.getElementById('kbEffect').value;
  KB_EFFECTS[curKBIdx].intensity=parseInt(document.getElementById('kbIntensity').value);
  document.getElementById('kbIntensityVal').textContent=KB_EFFECTS[curKBIdx].intensity+'%';
  renderTL();
}

function syncKBEditPanel(){
  const panel=document.getElementById('kbEditPanel');
  if(curKBIdx<0||!KB_EFFECTS[curKBIdx]){panel.style.display='none';return}
  panel.style.display='block';
  const kb=KB_EFFECTS[curKBIdx];
  document.getElementById('kbEffect').value=kb.effect;
  document.getElementById('kbIntensity').value=kb.intensity;
  document.getElementById('kbIntensityVal').textContent=kb.intensity+'%';
}

function renderKBList(){
  const list=document.getElementById('kbList');
  const kbColors=['#4ade80','#60a5fa','#f59e0b','#ec4899','#a78bfa','#14b8a6'];
  const effectNames={'zoom-in':'줌인','zoom-out':'줌아웃','pan-left':'좌패닝','pan-right':'우패닝','none':'없음'};
  if(!KB_EFFECTS.length){
    list.innerHTML='<div style="font-size:10px;color:#555;padding:4px 0">자동줌 없음 — ＋ 추가를 클릭하세요</div>';
    document.getElementById('kbEditPanel').style.display='none';
    return;
  }
  list.innerHTML=KB_EFFECTS.map((kb,gi)=>{
    const isSel=gi===curKBIdx;
    const color=kbColors[gi%kbColors.length];
    return `
    <div class="d-row" style="padding:3px 4px;border-radius:4px;cursor:pointer;${isSel?'background:'+color+'15;border:1px solid '+color+'44':'border:1px solid transparent'}" onclick="selectKB(${gi})">
      <span style="color:${color};font-size:9px;min-width:16px;font-weight:700">#${gi+1}</span>
      <span style="flex:1;font-size:10px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(effectNames[kb.effect]||kb.effect)} ${kb.intensity}%</span>
      <span style="font-size:8px;color:#666;margin:0 4px">${kb.start.toFixed(1)}-${kb.end.toFixed(1)}s</span>
      <button class="btn" onclick="event.stopPropagation();removeKBByIndex(${gi})" style="font-size:9px;color:#f87171;padding:1px 4px" title="삭제">✕</button>
    </div>`;
  }).join('');
  document.getElementById('kbEditPanel').style.display=curKBIdx>=0?'block':'none';
}

let _kbRafId=null;
/*
 * Ken Burns uses interpolated time for 60fps smoothness.
 * gTime only updates at 4~15Hz (timeupdate), so we track when gTime
 * was last updated and interpolate forward using wall-clock time.
 */
let _kbLastGTime = 0;
let _kbLastWallTime = 0;

function _kbInterpolatedTime() {
  if (!playing) return gTime;
  const now = performance.now();
  const wallElapsed = (now - _kbLastWallTime) / 1000;
  // Interpolate: gTime + elapsed, but NEVER exceed gTime + 0.5s
  // This prevents overshoot when video stalls during clip transitions
  const interp = _kbLastGTime + Math.min(wallElapsed, 0.5);
  // Also clamp to total timeline duration
  return Math.min(interp, typeof total !== 'undefined' ? total : 9999);
}

// Called from timeupdate in playback.js — keeps interpolation anchored
function kbSyncTime(t) {
  _kbLastGTime = t;
  _kbLastWallTime = performance.now();
}

let _kbUpdating = false; // prevent recursion with applyZoomToVideo
function updateKenBurnsFrame(){
  if (_kbUpdating) return;
  _kbUpdating = true;
  const vid=document.getElementById('vid');
  const t = _kbInterpolatedTime();
  const active=getKBAtTime(t);
  if(!active.length){
    // No active KB — apply static zoom WITHOUT calling back into KB
    if(typeof clipZooms!=='undefined' && cur>=0 && cur<clipZooms.length){
      const z=clipZooms[cur];
      if(z && (z.scale!==1||z.panX!==0||z.panY!==0)){
        vid.style.transformOrigin='center center';
        vid.style.transform=`scale(${z.scale}) translate(${z.panX}%,${z.panY}%)`;
      } else {
        vid.style.transform='';
        vid.style.transformOrigin='center center';
      }
    }
    _kbUpdating = false;
    return;
  }
  const kb=active[0];
  const kbLen=kb.end-kb.start;
  if(kbLen<=0)return;
  const progress=Math.max(0,Math.min(1,(t-kb.start)/kbLen));
  const intensity=kb.intensity/100;
  let tx=0,ty=0,sc=1;
  if(kb.effect==='zoom-in'){
    sc=1+intensity*progress;
  }else if(kb.effect==='zoom-out'){
    sc=1+intensity*(1-progress);
  }else if(kb.effect==='pan-left'){
    sc=1+intensity;
    tx=5*(1-2*progress);
  }else if(kb.effect==='pan-right'){
    sc=1+intensity;
    tx=-5*(1-2*progress);
  }
  vid.style.transformOrigin='center center';
  vid.style.transform=`scale(${sc}) translate(${tx}%,${ty}%)`;
  _kbUpdating = false;
}

// 60fps Ken Burns animation loop — runs only during playback
function startKenBurnsLoop(){
  if(_kbRafId)return;
  _kbLastGTime = gTime;
  _kbLastWallTime = performance.now();
  function tick(){
    if(!playing){_kbRafId=null;return}
    updateKenBurnsFrame();
    _kbRafId=requestAnimationFrame(tick);
  }
  _kbRafId=requestAnimationFrame(tick);
}
// Hook into play/pause

// Migration: convert legacy clipKenBurns to global KB_EFFECTS
function migrateClipKBToGlobal(legacyKB){
  if(!legacyKB||!legacyKB.length||!starts||!starts.length)return;
  legacyKB.forEach((kb,i)=>{
    if(!kb||kb.effect==='none')return;
    const clipStart=starts[i]||0;
    const clipLen=clipDur(i);
    if(clipLen<=0)return;
    KB_EFFECTS.push({
      id:nextKBId(),
      effect:kb.effect,
      intensity:kb.intensity||15,
      start:clipStart,
      end:clipStart+clipLen
    });
  });
}


function toggleCropMode(){
  cropMode=!cropMode;
  document.getElementById('cropOverlay').classList.toggle('active',cropMode);
  document.getElementById('cropToggle').classList.toggle('on',cropMode);
  if(cropMode){updateCropOverlay();setTool('crop')}
  else setTool('select');
}

function resetCrop(){
  clipCrops[cur]={x:0,y:0,w:100,h:100};
  applyCropToVideo();updateCropOverlay();
}

function applyCropToAll(){
  const c={...cropOf(cur)};
  clipCrops=clipCrops.map(()=>({...c}));
  applyCropToVideo();
}

// Crop drag interaction
