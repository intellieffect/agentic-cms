/* ─── playback.js — Trim IIFE + playback + JKL + skimming + ruler + mark + zoom + export ─── */
// Update trim bar when video time updates
(function(){
  const vid=document.getElementById('vid');
  if(vid){
    vid.addEventListener('loadedmetadata',()=>updateTrimBar());
    vid.addEventListener('timeupdate',()=>{
      if(!_trimDragging){
        const phead=document.getElementById('trimPlayhead');
        if(phead&&_trimSrcDuration){
          phead.style.left=((vid.currentTime/_trimSrcDuration)*100).toFixed(2)+'%';
        }
      }
    });
  }
})();

// Patch updateDetail to also update trim bar
const _origUpdateDetail=typeof updateDetail==='function'?updateDetail:null;

let _detailDebounce=null;
function debouncedDetailChange(){clearTimeout(_detailDebounce);_detailDebounce=setTimeout(onDetailChange,200)}
function onDetailChange(){save();
  CLIPS[cur].start=parseFloat(document.getElementById('dStart').value)||0;
  CLIPS[cur].end=parseFloat(document.getElementById('dEnd').value)||CLIPS[cur].start+1;
  if(CLIPS[cur].end<=CLIPS[cur].start)CLIPS[cur].end=CLIPS[cur].start+0.3;
  const vid=document.getElementById('vid');
  vid.currentTime=CLIPS[cur].start;
  // Ensure video frame updates even if paused
  vid.pause();
  const seekDone=()=>{vid.removeEventListener('seeked',seekDone)};
  vid.addEventListener('seeked',seekDone);
  recalc();renderTL();
  // Update duration label without overwriting input fields
  document.getElementById('dDur').textContent=clipDur(cur).toFixed(1)+'s';
  document.getElementById('dSpeedDur').textContent=`(${clipDur(cur).toFixed(1)}s 재생)`;
  updateTrimBar();
  showSubAtTime(gTime);
}
function onSpeedChange(){save();clipMeta[cur].speed=parseFloat(document.getElementById('dSpeed').value);recalc();renderTL();updateDetail()}
// === Transition system (between-clip) ===
const TRANS_TYPES=[
  {value:'none',label:'없음'},{value:'fade',label:'페이드'}
];
function syncTransitions(){
  const needed=Math.max(0,CLIPS.length-1);
  while(TRANSITIONS.length<needed)TRANSITIONS.push({type:'none',duration:0.5});
  if(TRANSITIONS.length>needed)TRANSITIONS.length=needed;
  return TRANSITIONS;
}
function showFadePopup(type,anchorEl){
  document.getElementById('transPopup')?.remove();
  const isIn=type==='in';
  const fade=isIn?fadeInOut.fadeIn:fadeInOut.fadeOut;
  const rect=anchorEl.getBoundingClientRect();
  const pop=document.createElement('div');pop.id='transPopup';pop.className='trans-popup';
  const popH=120;
  if(rect.bottom+popH+10>window.innerHeight){pop.style.bottom=(window.innerHeight-rect.top+6)+'px'}
  else{pop.style.top=(rect.bottom+6)+'px'}
  pop.style.left=Math.max(4,Math.min(rect.left,window.innerWidth-240))+'px';
  pop.innerHTML=`
    <h5>${isIn?'페이드 인 (시작)':'페이드 아웃 (끝)'}</h5>
    <div class="d-row" style="margin-bottom:6px"><label style="font-size:10px;color:#aaa">활성화</label><input type="checkbox" id="fpEnabled" ${fade.enabled?'checked':''}></div>
    <div class="tp-dur"><label>시간</label><input type="range" min="0.1" max="3" step="0.1" value="${fade.duration}" id="fpDurSlider"><span id="fpDurVal">${fade.duration.toFixed(1)}초</span></div>
  `;
  document.body.appendChild(pop);
  const cb=document.getElementById('fpEnabled');
  const slider=document.getElementById('fpDurSlider');
  cb.addEventListener('change',()=>{
    save();
    if(isIn){fadeInOut.fadeIn.enabled=cb.checked}else{fadeInOut.fadeOut.enabled=cb.checked}
    recalc();renderTL();
  });
  slider.addEventListener('input',()=>{
    document.getElementById('fpDurVal').textContent=parseFloat(slider.value).toFixed(1)+'초';
    if(isIn){fadeInOut.fadeIn.duration=parseFloat(slider.value)||1}else{fadeInOut.fadeOut.duration=parseFloat(slider.value)||1}
  });
  slider.addEventListener('change',()=>{save()});
  setTimeout(()=>{
    const closer=e=>{if(!pop.contains(e.target)&&e.target!==anchorEl){pop.remove();document.removeEventListener('mousedown',closer)}};
    document.addEventListener('mousedown',closer);
  },0);
}
function showTransPopup(idx,anchorEl){
  document.getElementById('transPopup')?.remove();
  const t=TRANSITIONS[idx]||{type:'none',duration:0.5};
  const rect=anchorEl.getBoundingClientRect();
  const pop=document.createElement('div');pop.id='transPopup';pop.className='trans-popup';
  pop.style.left=Math.max(4,Math.min(rect.left,window.innerWidth-240))+'px';
  // Show above if not enough space below
  const popH=280;
  if(rect.bottom+popH+10>window.innerHeight){
    pop.style.bottom=(window.innerHeight-rect.top+6)+'px';
  }else{
    pop.style.top=(rect.bottom+6)+'px';
  }
  pop.innerHTML=`
    <h5>클립 ${idx+1} → ${idx+2} 전환</h5>
    <div class="tp-grid">${TRANS_TYPES.map(tt=>`<div class="tp-opt${t.type===tt.value?' sel':''}" data-v="${tt.value}">${tt.label}</div>`).join('')}</div>
    <div class="tp-dur"><label>시간</label><input type="range" min="0.1" max="2" step="0.1" value="${t.type==='none'?0.5:t.duration}" id="tpDurSlider"><span id="tpDurVal">${t.type==='none'?'0.5':t.duration.toFixed(1)}초</span></div>
  `;
  document.body.appendChild(pop);
  // Event: select type
  pop.querySelectorAll('.tp-opt').forEach(el=>{
    el.addEventListener('click',()=>{
      save();
      pop.querySelectorAll('.tp-opt').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');
      const v=el.dataset.v;
      TRANSITIONS[idx].type=v;
      if(v==='none')TRANSITIONS[idx].duration=0;
      else if(TRANSITIONS[idx].duration<=0)TRANSITIONS[idx].duration=parseFloat(document.getElementById('tpDurSlider').value)||0.5;
      recalc();renderTL();updateTransDetail();
    });
  });
  // Event: duration slider
  const slider=document.getElementById('tpDurSlider');
  slider.addEventListener('input',()=>{
    document.getElementById('tpDurVal').textContent=parseFloat(slider.value).toFixed(1)+'초';
  });
  slider.addEventListener('input',()=>{
    document.getElementById('tpDurVal').textContent=parseFloat(slider.value).toFixed(1)+'초';
    if(TRANSITIONS[idx].type!=='none')TRANSITIONS[idx].duration=parseFloat(slider.value)||0.5;
    recalc();renderTL();
    // Re-show popup since renderTL destroys anchor
  });
  slider.addEventListener('change',()=>{
    save();
    updateTransDetail();
  });
  // Close on outside click
  setTimeout(()=>{
    const closer=e=>{if(!pop.contains(e.target)&&e.target!==anchorEl){pop.remove();document.removeEventListener('mousedown',closer)}};
    document.addEventListener('mousedown',closer);
  },0);
}
// Legacy stubs (transitions managed in timeline popups)
function onTransBeforeChange(){}
function onTransAfterChange(){}
function updateTransDetail(){
  // Transitions managed in timeline popups only
}
function onSubEdit(v){
  const sub=getCurSub();
  if(sub)sub.text=v;
  applySubStyle();renderTL();
}
// textarea: Enter → 기본 동작 방지 (Shift+Enter만 줄바꿈)
document.addEventListener('DOMContentLoaded',()=>{
  const ta=document.getElementById('subIn');
  if(ta)ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault(); // Enter만 누르면 줄바꿈 안 됨
    }
  });
});

function addSubToClip(){
  save();
  // Add at playhead position, span 3 seconds by default
  const subStart=Math.max(0,gTime);
  const subEnd=Math.min(total||30,gTime+3);
  const yOffset=80-SUBS.length*10;
  const newStyle={...subStyleDefault, y:Math.max(15,yOffset)};
  const newSub={id:nextSubId(),text:'',style:newStyle,start:subStart,end:subEnd};
  SUBS.push(newSub);
  curSubIdx=SUBS.length-1;
  renderSubList();syncSubStylePanel();applySubStyle();renderTL();
  document.getElementById('subIn').focus();
}

function removeSubByIndex(globalIdx){
  save();
  if(globalIdx>=0&&globalIdx<SUBS.length)SUBS.splice(globalIdx,1);
  if(curSubIdx>=SUBS.length)curSubIdx=Math.max(-1,SUBS.length-1);
  renderSubList();syncSubStylePanel();applySubStyle();renderTL();
}

function renderSubList(){
  const list=document.getElementById('subList');
  const subColors=['#4ade80','#60a5fa','#f59e0b','#ec4899','#a78bfa','#14b8a6'];
  if(!SUBS.length){
    list.innerHTML='<div style="font-size:10px;color:#555;padding:4px 0">자막 없음 — ＋ 추가를 클릭하세요</div>';
    document.getElementById('subEditPanel').style.display='none';
    return;
  }
  list.innerHTML=SUBS.map((s,gi)=>{
    const isSel=gi===curSubIdx;
    const color=subColors[gi%subColors.length];
    return `
    <div class="d-row" style="padding:3px 4px;border-radius:4px;cursor:pointer;${isSel?'background:'+color+'15;border:1px solid '+color+'44':'border:1px solid transparent'}" onclick="selectSub(${gi})">
      <span style="color:${color};font-size:9px;min-width:16px;font-weight:700">#${gi+1}</span>
      <span style="flex:1;font-size:10px;color:${s.text?'#ddd':'#555'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.text)||'(빈 자막)'}</span>
      <span style="font-size:8px;color:#666;margin:0 4px">${s.start.toFixed(1)}-${s.end.toFixed(1)}s</span>
      <button class="btn" onclick="event.stopPropagation();removeSubByIndex(${gi})" style="font-size:9px;color:#f87171;padding:1px 4px" title="삭제">✕</button>
    </div>`;
  }).join('');
  document.getElementById('subEditPanel').style.display=curSubIdx>=0?'block':'none';
}

function getSubSpanInfo(sub){
  let count=0;
  for(let i=0;i<CLIPS.length;i++){
    const cs=starts[i],ce=cs+clipDur(i);
    if(sub.end>cs&&sub.start<ce)count++;
  }
  return count;
}

function delCur(){if(CLIPS.length<=1)return;if(typeof _guardLocked==='function'&&_guardLocked())return;save();CLIPS.splice(cur,1);clipMeta.splice(cur,1);clipSubStyles.splice(cur,1);clipCrops.splice(cur,1);clipZooms.splice(cur,1);clipEffects.splice(cur,1);
  // Sync transitions: when removing clip i, merge transitions around it
  if(cur>0&&cur<TRANSITIONS.length)TRANSITIONS.splice(cur-1,1);
  else if(TRANSITIONS.length>0)TRANSITIONS.splice(Math.min(cur,TRANSITIONS.length-1),1);
  syncTransitions();
  recalc();renderTL();sel(Math.min(cur,CLIPS.length-1))}

/* ─── Playback / JKL ─── */
function togglePlay(){playing?stopP():startP()}
function startP(){
  playing=true;document.getElementById('playBtn').textContent='⏸';document.getElementById('playBtn').classList.add('playing');playSpeed=1;updateSpeedBadge();
  startKenBurnsLoop();
  
  // Find clip and offset from gTime
  let startIdx=0,offset=0;
  for(let i=0;i<CLIPS.length;i++){
    const end=starts[i]+clipDur(i);
    if(gTime<end-0.01){startIdx=i;offset=gTime-starts[i];break}
    if(i===CLIPS.length-1){startIdx=i;offset=clipDur(i)}
  }
  // Start BGM independently — it will play continuously regardless of clip transitions
  if(typeof startBgmPlayback==='function')startBgmPlayback(gTime);
  playC(startIdx,offset);
}
function stopP(){
  playing=false;playSpeed=1;updateSpeedBadge();
  ++_playGen; // invalidate any in-flight playC
  const vid=document.getElementById('vid');
  if(_onTU){vid.removeEventListener('timeupdate',_onTU);_onTU=null}
  vid.pause();clearTransitionPreview();_unfreezeFrame();
  if(typeof stopBgmPlayback==='function')stopBgmPlayback();
  document.getElementById('playBtn').textContent='▶';document.getElementById('playBtn').classList.remove('playing');
}

function jkl(key){
  const vid=document.getElementById('vid');
  if(key==='k'){
    // K: stop, reset speed
    playSpeed=1;
    stopP();
    return;
  }
  if(key==='j'){
    // J: reverse skip — step back 1s/2s/4s per press (tap-to-scrub)
    if(!playing){
      seekToGlobal(gTime-1);
      return;
    }
    // During playback: decelerate or reverse skip
    if(playSpeed>1){
      playSpeed=Math.max(1,playSpeed/2);
      vid.playbackRate=playSpeed;
    } else {
      // Skip backward
      const skip=playing?2:1;
      seekToGlobal(gTime-skip);
    }
    updateSpeedBadge();
    return;
  }
  if(key==='l'){
    // L: forward speed up — 1x → 2x → 4x
    if(!playing){
      playSpeed=1;
      startP();
      return;
    }
    playSpeed=Math.min(4,playSpeed>=1?playSpeed*2:1);
    vid.playbackRate=playSpeed;
    // Adjust BGM playback rate if Web Audio supports it
    _adjustBgmRate(playSpeed);
    updateSpeedBadge();
  }
}
function updateSpeedBadge(){
  const b=document.getElementById('speedBadge');
  if(playSpeed!==1&&playing){b.textContent=playSpeed+'x';b.classList.add('show')}
  else b.classList.remove('show');
}

// Adjust BGM playback rate for L-key speed changes
function _adjustBgmRate(rate) {
  if (typeof _bgmSources === 'undefined') return;
  for (const id in _bgmSources) {
    try { _bgmSources[id].node.playbackRate.value = rate; } catch {}
  }
}

function seekStart(){gTime=0;seekToGlobal(0)}
function seekEnd(){gTime=total;seekToGlobal(total)}
function seekToGlobal(t){
  gTime=Math.max(0,Math.min(total,t));
  const vid=document.getElementById('vid');
  vid.onloadedmetadata=null;
  for(let i=0;i<CLIPS.length;i++){
    const end=starts[i]+clipDur(i);
    if(gTime<=end+0.01){
      if(cur!==i) selUI(i);
      const c=CLIPS[i];
      const src=VBASE+'/'+c.source.split('/').pop();
      const targetTime=c.start+(gTime-starts[i])*(clipMeta[i]?.speed||1);
      if(vid.dataset.src!==src){
        vid.src=src;vid.dataset.src=src;
        vid.onloadedmetadata=()=>{
          srcDurs[src]=vid.duration;vid.currentTime=targetTime;
          checkLetterbox();applyCropToVideo();applyZoomToVideo();
        };
      } else {
        vid.currentTime=targetTime;
      }
      break;
    }
  }
  updatePlayhead();updateTC();showSubAtTime(gTime);
  // Force-sync BGM on manual seek
  if(typeof forceSyncBgm==='function')forceSyncBgm(gTime,playing);
}

// CSS transition preview
function applyTransitionPreview(vid,transType,transDur){
  vid.style.transition='none';vid.style.opacity='1';vid.style.clipPath='';
  if(!transType||transType==='none')return;
  // Fade in effect on new clip
  if(transType==='fade'||transType==='fadeblack'||transType==='fadewhite'){
    vid.style.opacity='0';vid.style.transition=`opacity ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.opacity='1'})});
  }else if(transType==='wipeleft'){
    vid.style.clipPath='inset(0 100% 0 0)';vid.style.transition=`clip-path ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.clipPath='inset(0 0 0 0)'})});
  }else if(transType==='wiperight'){
    vid.style.clipPath='inset(0 0 0 100%)';vid.style.transition=`clip-path ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.clipPath='inset(0 0 0 0)'})});
  }else if(transType==='wipeup'){
    vid.style.clipPath='inset(100% 0 0 0)';vid.style.transition=`clip-path ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.clipPath='inset(0 0 0 0)'})});
  }else if(transType==='wipedown'){
    vid.style.clipPath='inset(0 0 100% 0)';vid.style.transition=`clip-path ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.clipPath='inset(0 0 0 0)'})});
  }else if(transType==='slideleft'||transType==='slideright'){
    const dir=transType==='slideleft'?'100%':'-100%';
    vid.style.transform=`translateX(${dir})`;vid.style.transition=`transform ${transDur}s ease`;
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{vid.style.transform='translateX(0)'})});
  }
}
function clearTransitionPreview(){
  const vid=document.getElementById('vid');
  vid.style.transition='none';vid.style.opacity='1';vid.style.clipPath='';vid.style.transform='';
}

/*
 * Preload cache: fetch all unique source URLs into browser cache at project load.
 * This eliminates network latency on src swap — browser serves from disk cache.
 */
let _preloadCache = new Set();
function preloadAllSources() {
  if (typeof CLIPS === 'undefined') return;
  CLIPS.forEach(c => {
    const src = VBASE + '/' + c.source.split('/').pop();
    if (_preloadCache.has(src)) return;
    _preloadCache.add(src);
    // Use a hidden video element to force full decode cache
    const tmp = document.createElement('video');
    tmp.preload = 'auto'; tmp.muted = true; tmp.src = src;
    tmp.load(); // triggers browser to cache the file
  });
}

/*
 * Freeze frame + loading spinner for smooth clip transitions.
 *
 * On clip transition during playback:
 *   1. Capture current frame → canvas overlay (hides black flash)
 *   2. If src change takes >300ms, show loading spinner
 *   3. Once new frame renders → hide canvas + spinner
 *
 * On initial project load (no previous frame):
 *   1. Show loading spinner immediately
 *   2. Hide once first frame renders
 */
let _loaderTimeout = null;

function _freezeFrame(vid) {
  const canvas = document.getElementById('vidFreeze');
  if (!canvas || !vid.videoWidth) {
    // No frame to capture — show spinner immediately (initial load case)
    _showLoader();
    return;
  }
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  try {
    canvas.getContext('2d').drawImage(vid, 0, 0);
    canvas.style.display = '';
  } catch {}
  // If transition takes too long, also show spinner on top of freeze
  _loaderTimeout = setTimeout(_showLoader, 300);
}

function _unfreezeFrame() {
  const canvas = document.getElementById('vidFreeze');
  if (canvas) canvas.style.display = 'none';
  _hideLoader();
}

function _showLoader() {
  const el = document.getElementById('vidLoader');
  if (el) el.style.display = 'flex';
}
function _hideLoader() {
  if (_loaderTimeout) { clearTimeout(_loaderTimeout); _loaderTimeout = null; }
  const el = document.getElementById('vidLoader');
  if (el) el.style.display = 'none';
}

function playC(i,offsetSec){
  if(i>=CLIPS.length){stopP();return}
  const vid=document.getElementById('vid');
  // Clean up previous listener
  if(_onTU){vid.removeEventListener('timeupdate',_onTU);_onTU=null}
  vid.onloadeddata=null;

  const gen=++_playGen;

  const incomingTrans=i>0?TRANSITIONS[i-1]:null;
  const hasIncoming=incomingTrans&&incomingTrans.type!=='none'&&incomingTrans.duration>0;

  const c=CLIPS[i];
  const spd=clipMeta[i]?.speed||1;
  const src=VBASE+'/'+c.source.split('/').pop();
  const srcOffset=(offsetSec||0)*spd;
  const startTime=Math.min(c.start+srcOffset,c.end-0.1);

  // Update UI only
  cur=i;
  document.querySelectorAll('.tl-clip').forEach((e,j)=>e.classList.toggle('active',j===i));
  updateDetail();
  showSubAtTime(gTime);
  applyZoomToVideo();applyCropToVideo();checkLetterbox();

  // Freeze current frame to prevent black flash
  if (playing && vid.videoWidth) _freezeFrame(vid);

  const startPlayback=()=>{
    if(gen!==_playGen)return;
    if(hasIncoming&&(!offsetSec||offsetSec<0.1)){
      applyTransitionPreview(vid,incomingTrans.type,incomingTrans.duration);
    }else if(i===0&&fadeInOut.fadeIn.enabled&&(!offsetSec||offsetSec<0.1)){
      applyTransitionPreview(vid,'fade',fadeInOut.fadeIn.duration);
    }else{clearTransitionPreview()}
    vid.playbackRate=spd*(typeof playSpeed!=='undefined'&&playSpeed>1?playSpeed:1);
    vid.currentTime=startTime;
    if(playing)vid.play();
    // Unfreeze once new frame is rendered
    const _onFrame = () => {
      vid.removeEventListener('timeupdate', _onFrame);
      _unfreezeFrame();
    };
    vid.addEventListener('timeupdate', _onFrame);
    // Safety: unfreeze after 500ms max even if no timeupdate fires
    setTimeout(() => _unfreezeFrame(), 500);
    // BGM is NOT synced here — it runs independently once started
  };

  if(vid.dataset.src!==src){
    vid.src=src;vid.dataset.src=src;
    vid.onloadeddata=()=>{
      vid.onloadeddata=null;
      if(gen!==_playGen)return;
      srcDurs[src]=vid.duration;
      checkLetterbox();applyCropToVideo();applyZoomToVideo();
      startPlayback();
    };
  } else {
    startPlayback();
  }

  _onTU=function(){
    if(gen!==_playGen||!playing)return;
    if(vid.currentTime<c.start-0.5||vid.currentTime>c.end+0.5)return;
    if(vid.currentTime>=c.end-0.05){
      vid.removeEventListener('timeupdate',_onTU);_onTU=null;
      // Don't pause — let playC handle it for seamless transition
      if(gen!==_playGen)return;
      playC(i+1,0);
      return;
    }
    gTime=starts[i]+(vid.currentTime-c.start)/spd;
    // Anchor Ken Burns interpolation to actual video time
    if(typeof kbSyncTime==='function')kbSyncTime(gTime);
    if(i===CLIPS.length-1&&fadeInOut.fadeOut.enabled){
      const remain=(c.end-vid.currentTime)/spd;
      if(remain<=fadeInOut.fadeOut.duration){
        vid.style.transition='none';
        vid.style.opacity=Math.max(0,remain/fadeInOut.fadeOut.duration).toFixed(2);
      }
    }
    updatePlayhead();updateTC();showSubAtTime(gTime);
    if(typeof syncBgmPlayback==='function')syncBgmPlayback(gTime,playing);
  };
  vid.addEventListener('timeupdate',_onTU);
}

function updatePlayhead(){document.getElementById('tlPlayhead').style.left=(HDR+gTime*pxPerSec)+'px'}
function updateTC(){document.getElementById('tcDisp').textContent=tc(gTime)}

/* ─── Skimming ─── */
function onSkim(e){
  if(playing)return;
  const scroll=document.getElementById('tlScroll');
  const rect=scroll.getBoundingClientRect();
  const x=e.clientX-rect.left+scroll.scrollLeft;
  const t=Math.max(0,(x-HDR)/pxPerSec);
  const sk=document.getElementById('tlSkim');
  sk.style.display='block';sk.style.left=(HDR+t*pxPerSec)+'px';
  // Preview always shows playhead position, not hover position
}
function skimHide(){document.getElementById('tlSkim').style.display='none'}

/* ─── Ruler seek ─── */
function onRulerDown(e){
  const rect=document.getElementById('ruler').getBoundingClientRect();
  const scroll=document.getElementById('tlScroll').scrollLeft;
  const t=Math.max(0,(e.clientX-rect.left+scroll-HDR)/pxPerSec);
  seekToGlobal(t);
  const onMove=ev=>{const t2=Math.max(0,(ev.clientX-rect.left+document.getElementById('tlScroll').scrollLeft-HDR)/pxPerSec);seekToGlobal(t2)};
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

/* ─── Mark In/Out ─── */
function markIn(){markInT=gTime;const b=document.getElementById('markInBadge');b.style.display='block';b.textContent='IN '+fmt(gTime)}
function markOut(){markOutT=gTime;const b=document.getElementById('markOutBadge');b.style.display='block';b.textContent='OUT '+fmt(gTime)}
function insertFromMark(){
  if(markInT===null||markOutT===null||markOutT<=markInT)return;
  // Find source clip at mark-in
  for(let i=0;i<CLIPS.length;i++){
    const end=starts[i]+clipDur(i);
    if(markInT<=end){
      const c=CLIPS[i];
      const sOff=(markInT-starts[i])*(clipMeta[i]?.speed||1);
      const eOff=(Math.min(markOutT,end)-starts[i])*(clipMeta[i]?.speed||1);
      save();
      CLIPS.push({source:c.source,source_idx:c.source_idx,start:c.start+sOff,end:c.start+eOff,score:0});
      clipMeta.push({speed:1});clipEffects.push([]);
      syncTransitions();
      recalc();renderTL();sel(CLIPS.length-1);
      return;
    }
  }
}

/* ─── Zoom ─── */
function setFormat(dur){
  activeFormat=dur;
  // Highlight button
  document.querySelectorAll('.fmt-btn').forEach(b=>{
    const d=parseInt(b.dataset.dur);
    b.style.borderColor=d===dur?'#60a5fa':'#3a3a3a';
    b.style.color=d===dur?'#60a5fa':'#ccc';
  });
  renderTL();
}

function onZoom(){pxPerSec=parseInt(document.getElementById('zoomSlider').value);document.getElementById('zoomInfo').textContent=pxPerSec+'px/s';renderTL()}
function zoomIn(){const s=document.getElementById('zoomSlider');s.value=Math.min(200,parseInt(s.value)+5);onZoom()}
function zoomOut(){const s=document.getElementById('zoomSlider');s.value=Math.max(4,parseInt(s.value)-5);onZoom()}
function zoomFit(){
  const w=document.getElementById('tlScroll').clientWidth-HDR-20;
  pxPerSec=Math.max(4,Math.min(200,Math.round(w/total)));
  document.getElementById('zoomSlider').value=pxPerSec;document.getElementById('zoomInfo').textContent=pxPerSec+'px/s';renderTL();
}

/* ─── Export ─── */
function exportSrt(){let s='',n=1;SUBS.forEach(sub=>{if(!sub.text)return;s+=`${n}\n${srtT(sub.start)} --> ${srtT(sub.end)}\n${sub.text}\n\n`;n++});copy(s,'SRT 복사됨!')}
function exportJson(){copy(JSON.stringify({clips:CLIPS.map((c,i)=>({...c,subtitles:getClipSubs(i),subStyle:clipSubStyles[i],crop:clipCrops[i],zoom:clipZooms[i],effects:clipEffects[i]||[],speed:clipMeta[i].speed})),transitions:TRANSITIONS,globalEffects},null,2),'JSON 복사됨!')}
function getMaxSourceFps(){
  const fpsVals=Object.values(srcFps);
  return fpsVals.length?Math.max(...fpsVals):30;
}

function renderVideo(){
  const maxDur=activeFormat||0;
  
  // Build clip list, trimming to maxDur if set
  let renderClips=[];
  let accumulated=0;
  for(let i=0;i<CLIPS.length;i++){
    const c=CLIPS[i];
    const spd=clipMeta[i]?.speed||1;
    const dur=clipDur(i);
    
    if(maxDur>0&&accumulated>=maxDur)break;
    
    let clipData={
      ...c,subtitles:getClipSubs(i),subStyle:clipSubStyles[i],
      crop:clipCrops[i],zoom:clipZooms[i],
      effects:clipEffects[i]||[],
      speed:spd
    };
    
    if(maxDur>0&&accumulated+dur>maxDur){
      const remain=maxDur-accumulated;
      clipData.end=clipData.start+remain*spd;
    }
    
    renderClips.push(clipData);
    accumulated+=(clipData.end-clipData.start)/(clipData.speed||1);
  }

  const maxFps=getMaxSourceFps();
  const defaultFps=maxFps>30?60:30;
  const label=maxDur>0?`${maxDur}초 (${renderClips.length}클립)`:`전체 ${accumulated.toFixed(1)}초 (${renderClips.length}클립)`;
  
  // Default output name from project name or timestamp
  const projName=document.querySelector('.top .info')?.textContent||'';
  const defaultName=projName.replace(/\s*\(.*\)/,'').trim()||('output_'+new Date().toISOString().slice(0,10));
  showRenderConfirm(label,defaultFps,renderClips,maxDur,defaultName);
}

function showRenderConfirm(label,defaultFps,renderClips,maxDur,defaultName){
  // Remove existing modal if any
  document.getElementById('fpsModal')?.remove();
  
  const modal=document.createElement('div');
  modal.id='fpsModal';
  modal.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:400;display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`
    <div style="background:#1e1e1e;border:1px solid #3a3a3a;border-radius:12px;padding:24px 32px;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <h3 style="font-size:14px;color:#e0e0e0;margin:0 0 16px">🎬 영상 추출</h3>
      <p style="font-size:12px;color:#999;margin:0 0 16px">${label}</p>
      <label style="font-size:11px;color:#888;display:block;margin-bottom:6px">파일 이름</label>
      <input type="text" id="outputName" value="${defaultName}" placeholder="파일 이름" style="width:100%;padding:8px 12px;background:#111;border:1px solid #333;color:#eee;border-radius:6px;font-size:13px;margin-bottom:12px;box-sizing:border-box">
      <label style="font-size:11px;color:#888;display:block;margin-bottom:6px">프레임레이트</label>
      <select id="fpsSelect" style="width:100%;padding:8px 12px;background:#111;border:1px solid #333;color:#eee;border-radius:6px;font-size:13px;margin-bottom:20px">
        <option value="24"${defaultFps===24?' selected':''}>24fps (영화)</option>
        <option value="30"${defaultFps===30?' selected':''}>30fps</option>
        <option value="60"${defaultFps===60?' selected':''}>60fps</option>
      </select>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" id="fpsCancel" style="padding:8px 20px;font-size:12px">취소</button>
        <button class="btn pri" id="fpsOk" style="padding:8px 20px;font-size:12px">추출 시작</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Default selection을 최대 fps에 가까운 값으로
  const sel=document.getElementById('fpsSelect');
  sel.value=String(defaultFps);
  
  document.getElementById('fpsCancel').onclick=()=>modal.remove();
  document.getElementById('fpsOk').onclick=()=>{
    const outputFps=parseInt(sel.value)||30;
    const outputName=(document.getElementById('outputName').value||'edited_output').replace(/[\/\\:*?"<>|]/g,'_');
    modal.remove();
    showRenderDialog(renderClips.length);
    window._lastOutputName=outputName;
    // Build transitions for render clips (may be subset of full TRANSITIONS)
    const renderTransitions=[];
    for(let ri=0;ri<renderClips.length-1;ri++){
      renderTransitions.push(TRANSITIONS[ri]||{type:'none',duration:0});
    }
    const payload={clips:renderClips,transitions:renderTransitions,maxDuration:maxDur,fps:outputFps,outputName,subtitlesEnabled:subtitlesVisible,globalSubs:SUBS,globalKB:KB_EFFECTS,globalEffects,fadeIn:fadeInOut.fadeIn,fadeOut:fadeInOut.fadeOut,bgmClips:typeof BGM_CLIPS!=='undefined'?BGM_CLIPS:[],clipMeta:clipMeta.slice(0,renderClips.length),clipCrops:clipCrops.slice(0,renderClips.length),clipZooms:clipZooms.slice(0,renderClips.length),clipSubStyles:clipSubStyles.slice(0,renderClips.length),clipEffects:clipEffects.slice(0,renderClips.length),totalDuration:maxDur,sources:[...new Set(renderClips.map(c=>c.source))]};
    // Remotion 렌더 (기본) — ffmpeg 폴백: /api/render
    fetch(apiUrl('/api/render-remotion'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(r=>r.json()).then(()=>pollRender(renderClips.length))
      .catch(e=>{renderError('렌더 요청 실패: '+e)});
  };
}

let _renderStartTime=0;

function showRenderDialog(totalClips){
  _renderStartTime=Date.now();
  const ov=document.getElementById('renderOverlay');
  ov.classList.add('show');
  document.getElementById('renderSpinner').style.display='inline-block';
  document.getElementById('renderTitle').textContent='영상 추출 중...';
  document.getElementById('renderBar').style.width='0';
  document.getElementById('renderStatusText').textContent='준비 중...';
  document.getElementById('renderDetailText').textContent=`총 ${totalClips}개 클립`;
  document.getElementById('renderCancelBtn').style.display='inline-block';
  document.getElementById('renderDoneBtn').style.display='none';
  document.getElementById('renderBtn').disabled=true;
}

function pollRender(totalClips){
  const poll=()=>{
    fetch(apiUrl('/api/render-remotion/status')).then(r=>r.json()).then(s=>{
      const elapsed=((Date.now()-_renderStartTime)/1000).toFixed(0);
      if(s.state==='rendering'||s.state==='starting'){
        const pct=s.total>0?Math.round(s.progress/s.total*100):(s.progress||0);
        document.getElementById('renderBar').style.width=pct+'%';
        document.getElementById('renderStatusText').textContent=`렌더링 중... ${pct}%`;
        document.getElementById('renderDetailText').textContent=`${elapsed}초 경과`;
        setTimeout(poll,1500);
      } else if(s.state==='done'){
        renderSuccess(elapsed);
      } else if(s.state==='error'){
        renderError(s.error);
      } else {
        setTimeout(poll,1000);
      }
    }).catch(()=>setTimeout(poll,2000));
  };
  poll();
}

function renderSuccess(elapsed){
  document.getElementById('renderSpinner').style.display='none';
  document.getElementById('renderTitle').innerHTML='<div class="render-done-icon">✅</div>영상 추출 완료!';
  document.getElementById('renderBar').style.width='100%';
  document.getElementById('renderBar').style.background='#22c55e';
  document.getElementById('renderStatusText').textContent=`${elapsed}초 소요`;
  document.getElementById('renderDetailText').textContent='';
  document.getElementById('renderCancelBtn').style.display='none';
  document.getElementById('renderDoneBtn').style.display='inline-block';
  document.getElementById('renderBtn').disabled=false;
  // Auto download via hidden <a> tag (works in iframe, no popup block)
  const fname=(window._lastOutputName||'edited_output')+'.mp4';
  const downloadUrl=apiUrl('/api/render-remotion/download');
  const a=document.createElement('a');
  a.href=downloadUrl;
  a.download=fname;
  a.target='_parent';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>a.remove(),1000);
}

function renderError(msg){
  document.getElementById('renderSpinner').style.display='none';
  document.getElementById('renderTitle').innerHTML='<div class="render-done-icon">❌</div>추출 실패';
  document.getElementById('renderBar').style.width='100%';
  document.getElementById('renderBar').style.background='#ef4444';
  document.getElementById('renderStatusText').textContent=msg||'알 수 없는 오류';
  document.getElementById('renderDetailText').textContent='';
  document.getElementById('renderCancelBtn').style.display='none';
  document.getElementById('renderDoneBtn').style.display='inline-block';
  document.getElementById('renderBtn').disabled=false;
}

function closeRenderDialog(){
  document.getElementById('renderOverlay').classList.remove('show');
  document.getElementById('renderBar').style.background='#2563eb';
}

function cancelRender(){
  closeRenderDialog();
  document.getElementById('renderBtn').disabled=false;
}

function exportCmd(){
  // Generate a full ffmpeg render script
  const outName='edited_output.mp4';
  const W=1080,H=1920; // 9:16 vertical
  let lines=['#!/bin/bash','set -e','# Auto-generated render script',''];

  // Step 1: Process each clip
  const tmpFiles=[];
  CLIPS.forEach((c,i)=>{
    const src=c.source;
    const spd=clipMeta[i]?.speed||1;
    const cr=cropOf(i);
    const zm=zoomOf(i);
    const tmp=`_clip_${String(i).padStart(3,'0')}.mp4`;
    tmpFiles.push(tmp);

    // Build filter chain
    let filters=[];

    // Trim
    const dur=((c.end-c.start)/spd);

    // Speed
    if(spd!==1){
      filters.push(`setpts=${(1/spd).toFixed(4)}*PTS`);
    }

    // Scale to output size first
    filters.push(`scale=${W}:${H}:force_original_aspect_ratio=increase`);
    filters.push(`crop=${W}:${H}`);

    // Zoom (scale + translate)
    if(zm.scale!==1||zm.panX!==0||zm.panY!==0){
      const zw=Math.round(W*zm.scale);
      const zh=Math.round(H*zm.scale);
      const zx=Math.round((zw-W)/2 - (zm.panX/100)*W);
      const zy=Math.round((zh-H)/2 - (zm.panY/100)*H);
      filters.push(`scale=${zw}:${zh}`);
      filters.push(`crop=${W}:${H}:${Math.max(0,zx)}:${Math.max(0,zy)}`);
    }

    // Crop (mask — draw black outside region)
    if(cr.x!==0||cr.y!==0||cr.w!==100||cr.h!==100){
      const cx=Math.round(cr.x/100*W);
      const cy=Math.round(cr.y/100*H);
      const cw=Math.round(cr.w/100*W);
      const ch=Math.round(cr.h/100*H);
      // Overlay crop region on black background
      filters.push(`split[orig][bg]`);
      filters.push(`[bg]drawbox=x=0:y=0:w=${W}:h=${H}:c=black:t=fill[black]`);
      filters.push(`[orig]crop=${cw}:${ch}:${cx}:${cy}[cropped]`);
      // Use complex filter for this clip
      const vf=filters.slice(0,-3).join(',');
      const pre=vf?`-vf "${vf}"`:'';
      lines.push(`# Clip ${i+1}: ${src} [${c.start.toFixed(2)}~${c.end.toFixed(2)}] crop`);
      lines.push(`ffmpeg -y -ss ${c.start.toFixed(3)} -t ${(c.end-c.start).toFixed(3)} -i "${src}" \\`);
      lines.push(`  -filter_complex "${vf?vf+',':''}split[orig][bg];[bg]drawbox=x=0:y=0:w=${W}:h=${H}:c=black:t=fill[black];[orig]crop=${cw}:${ch}:${cx}:${cy}[cropped];[black][cropped]overlay=${cx}:${cy}" \\`);
      lines.push(`  -c:v libx264 -preset fast -crf 18 -an -t ${dur.toFixed(3)} "${tmp}"`);
      lines.push('');
      return;
    }

    const vf=filters.join(',');
    lines.push(`# Clip ${i+1}: ${src} [${c.start.toFixed(2)}~${c.end.toFixed(2)}]${spd!==1?' speed:'+spd+'x':''}`);
    lines.push(`ffmpeg -y -ss ${c.start.toFixed(3)} -t ${(c.end-c.start).toFixed(3)} -i "${src}" \\`);
    lines.push(`  -vf "${vf}" \\`);
    lines.push(`  -c:v libx264 -preset fast -crf 18 -an -t ${dur.toFixed(3)} "${tmp}"`);
    lines.push('');
  });

  // Step 2: Concat list
  lines.push('# Concat all clips');
  lines.push(`cat > _concat.txt << 'EOF'`);
  tmpFiles.forEach(f=>lines.push(`file '${f}'`));
  lines.push('EOF');
  lines.push('');

  // Step 3: Concat
  lines.push(`ffmpeg -y -f concat -safe 0 -i _concat.txt -c copy _merged.mp4`);
  lines.push('');

  // Step 4: Generate SRT and burn subtitles
  let srt='',n=1;
  let hasSubs=false;
  SUBS.forEach(sub=>{
    if(!sub.text)return;
    hasSubs=true;
    srt+=`${n}\n${srtT(sub.start)} --> ${srtT(sub.end)}\n${sub.text}\n\n`;
    n++;
  });

  if(hasSubs){
    lines.push('# Generate SRT');
    lines.push(`cat > _subs.srt << 'SRTEOF'`);
    lines.push(srt.trim());
    lines.push('SRTEOF');
    lines.push('');

    // Get representative subtitle style (first clip with subtitle)
    const subIdx=SUBS.findIndex(s=>s);
    const ss=subIdx>=0?(clipSubStyles[subIdx]||{size:16,x:50,y:80}):{size:16,x:50,y:80};
    const fontSize=Math.round(ss.size*3); // scale up for 1080 render
    const mx=Math.round((ss.x/100)*W);
    const my=Math.round((ss.y/100)*H);

    lines.push('# Burn subtitles');
    lines.push(`ffmpeg -y -i _merged.mp4 \\`);
    lines.push(`  -vf "subtitles=_subs.srt:force_style='FontSize=${fontSize},Alignment=2,MarginV=${H-my},Bold=1'" \\`);
    lines.push(`  -c:v libx264 -preset fast -crf 18 "${outName}"`);
  } else {
    lines.push(`mv _merged.mp4 "${outName}"`);
  }

  lines.push('');
  lines.push('# Cleanup');
  lines.push(`rm -f ${tmpFiles.join(' ')} _concat.txt _merged.mp4 _subs.srt`);
  lines.push('');
  lines.push(`echo "✅ Done: ${outName}"`);

  const script=lines.join('\n');

  // Also save to file
  const blob=new Blob([script],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='render.sh';
  a.click();
  URL.revokeObjectURL(a.href);

  copy(script,'렌더 스크립트 복사 + render.sh 다운로드됨!');
}
function srtT(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=Math.floor(s%60),ms=Math.round(s%1*1000);return p(h)+':'+p(m)+':'+p(sec)+','+String(ms).padStart(3,'0')}
function p(n){return String(n).padStart(2,'0')}
function copy(t,msg){navigator.clipboard.writeText(t).then(()=>alert(msg)).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert(msg)})}

