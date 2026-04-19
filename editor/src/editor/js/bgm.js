/* ─── bgm.js — Multi-clip BGM/Audio track ─── */
let BGM_CLIPS = [];
let _bgmAudios = {};
let _bgmIdCounter = 0;
function _bgmId() { return 'bgm_' + (++_bgmIdCounter); }

// Legacy compat
Object.defineProperty(window, 'BGM', {
  get() { return BGM_CLIPS[0] || { source:'',start:0,duration:0,audioStart:0,totalDuration:0,volume:100 }; },
  set(v) { BGM_CLIPS = (v && v.source) ? [Object.assign({id:_bgmId()}, v)] : []; }
});

function fmtTime(s) { s=Math.max(0,s||0); return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); }

/* ─── px helpers ─── */
function _bgmPps() { return typeof pxPerSec!=='undefined' ? pxPerSec : 30; }
function _bgmHdr() { return typeof HDR!=='undefined' ? HDR : 56; }
function _bgmTotal() { return typeof total!=='undefined' ? total : 30; }
function _bgmSnap(t) {
  if (typeof snapTo==='function' && typeof snapOn!=='undefined' && snapOn) {
    const thr = Math.max(0.15, 8 / _bgmPps());
    return snapTo(t, thr);
  }
  return t;
}

/* ─── Render ─── */
function initBgmUI() { renderBgmTrack(); }

function renderBgmTrack() {
  const track = document.getElementById('bgmTrack');
  if (!track) return;
  if (!BGM_CLIPS.length) {
    track.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:10px;cursor:pointer" onclick="addBgm()">🎵 음원 추가 (클릭 또는 드래그)</div>';
    return;
  }
  const pps=_bgmPps(), hdr=_bgmHdr();
  let html='';
  BGM_CLIPS.forEach((c,i) => {
    const l=c.start*pps, w=Math.max(30,c.duration*pps);
    const fn=c.source.split('/').pop();
    html+=`<div class="bgm-clip" data-idx="${i}" style="position:absolute;left:${l}px;width:${w}px;top:2px;bottom:2px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border-radius:4px;cursor:grab;overflow:hidden" title="${fn} | ${fmtTime(c.audioStart)}~${fmtTime(c.audioStart+c.duration)} | Vol:${c.volume}%"><div class="bgm-h bgm-h-l" style="position:absolute;left:0;top:0;bottom:0;width:8px;cursor:col-resize;background:rgba(255,255,255,.4);z-index:3;border-radius:4px 0 0 4px"></div><canvas class="bgm-wv" data-idx="${i}" style="position:absolute;inset:0;width:100%;height:100%;opacity:.7;pointer-events:none"></canvas><span style="font-size:9px;color:#fff;z-index:1;padding:0 14px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🎵 ${fn}</span><div class="bgm-h bgm-h-r" style="position:absolute;right:0;top:0;bottom:0;width:8px;cursor:col-resize;background:rgba(255,255,255,.4);z-index:3;border-radius:0 4px 4px 0"></div></div>`;
  });
  html+='<div style="position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;gap:4px;z-index:5"><button onclick="addBgm()" style="background:none;border:none;color:#a78bfa;cursor:pointer;font-size:12px">＋</button><button onclick="removeAllBgm()" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px">✕</button></div>';
  track.innerHTML=html;
  BGM_CLIPS.forEach((_,i)=>setTimeout(()=>drawBgmWaveform(i),50));
}

/* ─── Direct DOM update during drag (no re-render) ─── */
function _updateBgmClipDOM(idx) {
  const el=document.querySelector(`.bgm-clip[data-idx="${idx}"]`);
  if(!el) return;
  const c=BGM_CLIPS[idx], pps=_bgmPps(), hdr=_bgmHdr();
  el.style.left=(c.start*pps)+'px';
  el.style.width=Math.max(30,c.duration*pps)+'px';
}

function _showSnap(t) {
  const sl=document.getElementById('snapLine');
  if(!sl)return;
  if(t<0){sl.style.display='none';return;}
  sl.style.display='block';
  sl.style.left=(_bgmHdr()+t*_bgmPps())+'px';
}

/* ─── Mouse events (delegated on track) ─── */
function _initBgmEvents() {
  const track=document.getElementById('bgmTrack');
  if(!track||track._bgmInit) return;
  track._bgmInit=true;

  track.addEventListener('mousedown', e => {
    const clipEl=e.target.closest('.bgm-clip');
    if(!clipEl) return;
    e.preventDefault(); e.stopPropagation();
    const idx=parseInt(clipEl.dataset.idx);
    const c=BGM_CLIPS[idx];
    if(!c) return;
    selectBgmClip(idx);

    const isLeft=!!e.target.closest('.bgm-h-l');
    const isRight=!!e.target.closest('.bgm-h-r');
    const pps=_bgmPps();
    const startX=e.clientX;
    const origStart=c.start, origDur=c.duration, origAS=c.audioStart;

    if(isLeft) {
      // Left trim: select audio IN point (audioStart + duration change, start stays)
      const onMove=ev=>{
        const dt=(ev.clientX-startX)/pps;
        let newAS=origAS+dt;
        newAS=Math.max(0, Math.min(c.totalDuration-0.3, newAS));
        const d=newAS-origAS;
        if(origDur-d>=0.3){
          c.audioStart=newAS;
          c.duration=origDur-d;
        }
        _updateBgmClipDOM(idx);
      };
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);renderBgmTrack();};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);

    } else if(isRight) {
      // Right trim — clamped to video total duration
      const onMove=ev=>{
        const dt=(ev.clientX-startX)/pps;
        const maxEnd=Math.min(origStart+c.totalDuration-origAS, _bgmTotal());
        let newEnd=Math.min(Math.max(c.start+0.3, origStart+origDur+dt), maxEnd);
        const snapped=_bgmSnap(newEnd);
        // Only apply snap if still within bounds
        c.duration=Math.max(0.3, Math.min(snapped, maxEnd) - c.start);
        _showSnap(snapped<=maxEnd ? snapped : -1);
        _updateBgmClipDOM(idx);
      };
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);_showSnap(-1);};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);

    } else {
      // Drag move
      const onMove=ev=>{
        const dt=(ev.clientX-startX)/pps;
        const raw=origStart+dt;
        let ns=Math.max(0, Math.min(_bgmTotal()-c.duration, raw));
        // Try snap start
        let snapped=false;
        const ss=_bgmSnap(ns);
        if(ss!==ns && Math.abs(ss-raw)*pps<12){ns=ss;snapped=true;}
        if(!snapped){
          // Try snap end
          const ne=ns+c.duration;
          const se=_bgmSnap(ne);
          if(se!==ne && Math.abs(se-ne)*pps<12){ns=se-c.duration;snapped=true;}
        }
        c.start=Math.max(0,ns);
        _showSnap(snapped?c.start:-1);
        _updateBgmClipDOM(idx);
      };
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);_showSnap(-1);};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    }
  });

  // Right-click for volume/delete
  track.addEventListener('contextmenu', e=>{
    const clipEl=e.target.closest('.bgm-clip');
    if(!clipEl)return;
    e.preventDefault();
    const idx=parseInt(clipEl.dataset.idx), c=BGM_CLIPS[idx];
    if(!c)return;
    const v=prompt(`볼륨 (0~100, 현재: ${c.volume}%)\n삭제하려면 "삭제" 입력:`,c.volume);
    if(v===null)return;
    if(v==='삭제'||v==='delete'){removeBgmClip(idx);return;}
    const n=parseInt(v);
    if(!isNaN(n)&&n>=0&&n<=100){c.volume=n;if(_bgmAudios[c.id])_bgmAudios[c.id].volume=n/100;}
  });

  // Drag & drop audio files
  track.addEventListener('dragover',e=>{e.preventDefault();track.style.outline='2px solid #a78bfa';});
  track.addEventListener('dragleave',()=>{track.style.outline='';});
  track.addEventListener('drop',async e=>{
    e.preventDefault();track.style.outline='';
    const file=e.dataTransfer.files[0];
    if(!file||(!file.type.startsWith('audio/')&&!file.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)))return;
    await _uploadAndAddBgm(file);
  });

  // Blade line on hover
  track.addEventListener('mousemove',e=>{
    if(typeof tool==='undefined'||tool!=='blade'||!BGM_CLIPS.length)return;
    const scroll=document.getElementById('tlScroll');
    const bl=document.getElementById('bladeLine');
    const x=e.clientX-scroll.getBoundingClientRect().left+scroll.scrollLeft;
    bl.style.display='block';bl.style.left=x+'px';bl.style.top='0';bl.style.height='100%';
  });
  track.addEventListener('mouseleave',()=>{
    if(typeof tool!=='undefined'&&tool==='blade')document.getElementById('bladeLine').style.display='none';
  });
}

/* ─── Add/Remove ─── */
async function _uploadAndAddBgm(file) {
  const fd=new FormData();fd.append('file',file);
  try{
    const r=await fetch(apiUrl('/api/upload'),{method:'POST',body:fd});
    const d=await r.json();
    if(d.uploaded&&d.uploaded.length){
      const c={id:_bgmId(),source:d.uploaded[0].name,start:0,audioStart:0,volume:100,totalDuration:d.uploaded[0].duration||0,duration:0};
      const td=_bgmTotal();
      c.duration=c.totalDuration?Math.min(c.totalDuration,td):td;
      if(!c.totalDuration){c.totalDuration=await _getDur(c.source);c.duration=Math.min(c.totalDuration,td);}
      BGM_CLIPS.push(c);
      renderBgmTrack();_setupAudio(c);
    }
  }catch(e){alert('음원 업로드 실패: '+e.message);}
}

function addBgm() {
  const inp=document.createElement('input');inp.type='file';
  inp.accept='audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac';
  inp.onchange=e=>{const f=e.target.files[0];if(f)_uploadAndAddBgm(f);};
  inp.click();
}

async function _getDur(source) {
  try{const a=new Audio(VBASE+'/'+source);return await new Promise((ok,no)=>{a.onloadedmetadata=()=>ok(a.duration);a.onerror=()=>ok(30);setTimeout(()=>ok(30),5000);});}catch{return 30;}
}

function removeBgmClip(idx) {
  const c=BGM_CLIPS[idx];
  if(c){
    if(_bgmAudios[c.id]){_bgmAudios[c.id].pause();delete _bgmAudios[c.id];}
    if(_bgmSources[c.id]){try{_bgmSources[c.id].node.stop();}catch{}delete _bgmSources[c.id];}
    delete _bgmBuffers[c.id];delete _bgmGains[c.id];
  }
  BGM_CLIPS.splice(idx,1);
  renderBgmTrack();
}
function removeAllBgm() {
  _stopAllBgmSources();
  Object.values(_bgmAudios).forEach(a=>a.pause());
  _bgmAudios={};_bgmBuffers={};_bgmGains={};
  BGM_CLIPS=[];renderBgmTrack();
}

/* ─── Blade: split into 2 ─── */
function bladeCutBgm(globalTime) {
  for(let i=0;i<BGM_CLIPS.length;i++){
    const c=BGM_CLIPS[i], end=c.start+c.duration;
    if(globalTime>c.start+0.2&&globalTime<end-0.2){
      const cut=globalTime-c.start;
      const nc={id:_bgmId(),source:c.source,start:globalTime,duration:c.duration-cut,audioStart:c.audioStart+cut,totalDuration:c.totalDuration,volume:c.volume};
      c.duration=cut;
      BGM_CLIPS.splice(i+1,0,nc);
      _setupAudio(nc);renderBgmTrack();
      return true;
    }
  }
  return false;
}

/* ─── Waveform ─── */
async function drawBgmWaveform(idx) {
  const canvas=document.querySelector(`.bgm-wv[data-idx="${idx}"]`);
  const c=BGM_CLIPS[idx];
  if(!canvas||!c)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.parentElement.getBoundingClientRect();
  canvas.width=rect.width;canvas.height=rect.height;
  try{
    const resp=await fetch(VBASE+'/'+c.source);
    const buf=await resp.arrayBuffer();
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    const ab=await ac.decodeAudioData(buf);
    const data=ab.getChannelData(0);
    const sr=ab.sampleRate;
    const s0=Math.floor(c.audioStart*sr), s1=Math.min(Math.floor((c.audioStart+c.duration)*sr),data.length);
    const step=Math.max(1,Math.ceil((s1-s0)/canvas.width));
    const amp=canvas.height/2;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(255,255,255,0.9)';
    for(let i=0;i<canvas.width;i++){
      let mn=1,mx=-1;
      for(let j=0;j<step;j++){const v=data[s0+i*step+j]||0;if(v<mn)mn=v;if(v>mx)mx=v;}
      const barH=Math.max(1,(mx-mn)*amp);
      ctx.fillRect(i,amp-barH/2,1,barH);
    }
    ac.close();
  }catch{}
}

/* ─── Playback sync — Web Audio API (no stutter) ─── */

/*
 * HTML5 Audio element seek is async and causes audible gaps.
 * Web Audio API uses pre-decoded AudioBuffer + precise scheduling = zero stutter.
 *
 * Architecture:
 *   _bgmCtx          — single AudioContext (reused)
 *   _bgmBuffers[id]  — decoded AudioBuffer per BGM clip
 *   _bgmSources[id]  — currently playing AudioBufferSourceNode (one-shot, recreated each play)
 *   _bgmGains[id]    — GainNode per clip for volume control
 */
let _bgmCtx = null;
let _bgmBuffers = {};   // id → AudioBuffer
let _bgmSources = {};   // id → { node: AudioBufferSourceNode, startedAt: ctx.currentTime, offset: audioStart }
let _bgmGains = {};     // id → GainNode
let _bgmPlaying = false;

function _getBgmCtx() {
  if (!_bgmCtx || _bgmCtx.state === 'closed') {
    _bgmCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_bgmCtx.state === 'suspended') _bgmCtx.resume();
  return _bgmCtx;
}

async function _setupAudio(c) {
  const ctx = _getBgmCtx();
  // Create gain node
  if (!_bgmGains[c.id]) {
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.value = c.volume / 100;
    _bgmGains[c.id] = g;
  } else {
    _bgmGains[c.id].gain.value = c.volume / 100;
  }
  // Decode audio buffer (if not cached or source changed)
  if (!_bgmBuffers[c.id] || _bgmBuffers[c.id]._src !== c.source) {
    try {
      const resp = await fetch(VBASE + '/' + c.source);
      const arrBuf = await resp.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrBuf);
      audioBuf._src = c.source;
      _bgmBuffers[c.id] = audioBuf;
    } catch (e) {
      console.warn('BGM decode failed:', c.source, e);
    }
  }
}

async function setupBgmAudio() {
  _stopAllBgmSources();
  _bgmBuffers = {};
  _bgmGains = {};
  for (const c of BGM_CLIPS) await _setupAudio(c);
}

function _stopAllBgmSources() {
  for (const id in _bgmSources) {
    try { _bgmSources[id].node.stop(); } catch {}
  }
  _bgmSources = {};
}

function _startBgmSource(c, audioOffset) {
  const ctx = _getBgmCtx();
  const buf = _bgmBuffers[c.id];
  if (!buf) return;

  // Stop existing source for this clip
  if (_bgmSources[c.id]) {
    try { _bgmSources[c.id].node.stop(); } catch {}
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = _bgmGains[c.id];
  if (gain) {
    src.connect(gain);
  } else {
    src.connect(ctx.destination);
  }

  // Clamp offset within buffer bounds
  const offset = Math.max(0, Math.min(audioOffset, buf.duration - 0.01));

  // Do NOT set a duration limit — let it play until explicitly stopped.
  src.start(0, offset);
  src.onended = () => {
    console.warn('BGM: source ENDED for', c.id, 'offset was', offset.toFixed(2), 'buf.duration=', buf.duration.toFixed(2));
  };
  _bgmSources[c.id] = {
    node: src,
    startedCtxTime: ctx.currentTime,
    startedOffset: offset,
  };
}

/*
 * BGM plays INDEPENDENTLY from video clips.
 * Once started, it runs on its own clock and is NEVER interrupted by clip transitions.
 *
 * syncBgmPlayback: called on timeupdate — does NOTHING (BGM is autonomous)
 * startBgmPlayback: called ONCE when play button is pressed
 * forceSyncBgm: called ONLY on manual seek (user clicks timeline) — NOT on clip transitions
 * stopBgmPlayback: called when stop button is pressed
 */

function syncBgmPlayback(t, isPlaying) {
  // Intentionally empty — BGM runs independently via Web Audio scheduler.
  // No intervention needed during normal playback.
}

async function startBgmPlayback(t) {
  _stopAllBgmSources();
  const ctx = _getBgmCtx();

  // CRITICAL: ensure AudioContext is actually running before scheduling anything
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch(e) { console.warn('BGM: AudioContext resume failed', e); }
  }

  // Ensure all buffers are decoded
  for (const c of BGM_CLIPS) {
    if (!_bgmBuffers[c.id]) {
      console.warn('BGM: buffer not ready for', c.source, '— decoding now');
      await _setupAudio(c);
    }
  }

  console.log('BGM startBgmPlayback t=', t, 'ctx.state=', ctx.state, 'clips=', BGM_CLIPS.length);

  BGM_CLIPS.forEach(c => {
    const lt = t - c.start;
    if (lt > c.duration + 0.05) return; // already past this clip

    const buf = _bgmBuffers[c.id];
    if (!buf) { console.warn('BGM: still no buffer for', c.id); return; }

    if (lt < -0.05) {
      // BGM clip hasn't started yet — schedule it to start in the future
      const delay = -lt;
      if (_bgmSources[c.id]) { try { _bgmSources[c.id].node.stop(); } catch {} }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = _bgmGains[c.id];
      src.connect(gain || ctx.destination);
      const offset = c.audioStart;
      src.start(ctx.currentTime + delay, offset);
      _bgmSources[c.id] = { node: src, startedCtxTime: ctx.currentTime + delay, startedOffset: offset };
      console.log('BGM: scheduled', c.id, 'delay=', delay.toFixed(2), 'offset=', offset.toFixed(2));
      return;
    }
    // Currently in range — start immediately from correct offset
    const audioOffset = c.audioStart + Math.max(0, lt);
    _startBgmSource(c, audioOffset);
    console.log('BGM: started', c.id, 'audioOffset=', audioOffset.toFixed(2), 'buf.duration=', buf.duration.toFixed(2));
  });
  _bgmPlaying = true;
}

function forceSyncBgm(t, isPlaying) {
  // Only used for manual seek (user interaction), NOT for clip transitions
  if (!isPlaying) {
    _stopAllBgmSources();
    _bgmPlaying = false;
    return;
  }
  startBgmPlayback(t);
}

function stopBgmPlayback() {
  _stopAllBgmSources();
  _bgmPlaying = false;
}

/* Keep legacy _bgmAudios for waveform drawing (read-only, not used for playback) */
function _setupAudioLegacy(c) {
  if (_bgmAudios[c.id]) return; // already exists
  const a = new Audio(VBASE + '/' + c.source); a.volume = 0; a.preload = 'auto'; _bgmAudios[c.id] = a;
}

/* ─── Detail Panel ─── */
let _bgmSelectedIdx = -1;
let _bgmWaveformData = null; // cached decoded audio data

function selectBgmClip(idx) {
  _bgmSelectedIdx = idx;
  const c = BGM_CLIPS[idx];
  if (!c) { hideBgmPanel(); return; }
  const panel = document.getElementById('bgmDetailPanel');
  panel.style.display = 'block';
  document.getElementById('bgmFileName').textContent = c.source.split('/').pop();
  document.getElementById('bgmVolume').value = c.volume;
  document.getElementById('bgmVolVal').textContent = c.volume + '%';
  document.getElementById('bgmInPoint').value = parseFloat(c.audioStart.toFixed(1));
  document.getElementById('bgmOutPoint').value = parseFloat((c.audioStart + c.duration).toFixed(1));
  document.getElementById('bgmDurLabel').textContent = fmtTime(c.duration) + ' (' + c.duration.toFixed(1) + '초)';
  document.getElementById('bgmTlStart').value = parseFloat(c.start.toFixed(1));
  document.getElementById('bgmTotalDurLabel').textContent = fmtTime(c.totalDuration);
  document.getElementById('bgmInPoint').max = c.totalDuration;
  document.getElementById('bgmOutPoint').max = c.totalDuration;
  drawBgmDetailWaveform(c);
  // Highlight selected clip
  document.querySelectorAll('.bgm-clip').forEach((el, i) => {
    el.style.outline = i === idx ? '2px solid #fff' : '';
  });
}

function hideBgmPanel() {
  _bgmSelectedIdx = -1;
  document.getElementById('bgmDetailPanel').style.display = 'none';
  document.querySelectorAll('.bgm-clip').forEach(el => el.style.outline = '');
}

function onBgmVolChange() {
  const c = BGM_CLIPS[_bgmSelectedIdx]; if (!c) return;
  c.volume = parseInt(document.getElementById('bgmVolume').value);
  document.getElementById('bgmVolVal').textContent = c.volume + '%';
  if (_bgmGains[c.id]) _bgmGains[c.id].gain.value = c.volume / 100;
  if (_bgmAudios[c.id]) _bgmAudios[c.id].volume = c.volume / 100;
}

function onBgmInOutChange() {
  const c = BGM_CLIPS[_bgmSelectedIdx]; if (!c) return;
  let inP = parseFloat(document.getElementById('bgmInPoint').value) || 0;
  let outP = parseFloat(document.getElementById('bgmOutPoint').value) || 0;
  inP = Math.max(0, Math.min(c.totalDuration, inP));
  outP = Math.max(inP + 0.3, Math.min(c.totalDuration, outP));
  c.audioStart = inP;
  c.duration = outP - inP;
  document.getElementById('bgmInPoint').value = inP.toFixed(1);
  document.getElementById('bgmOutPoint').value = outP.toFixed(1);
  document.getElementById('bgmDurLabel').textContent = fmtTime(c.duration) + ' (' + c.duration.toFixed(1) + '초)';
  renderBgmTrack();
  drawBgmDetailRange(c);
}

function onBgmTlStartChange() {
  const c = BGM_CLIPS[_bgmSelectedIdx]; if (!c) return;
  c.start = Math.max(0, parseFloat(document.getElementById('bgmTlStart').value) || 0);
  renderBgmTrack();
}

function removeBgmSelected() {
  if (_bgmSelectedIdx >= 0) { removeBgmClip(_bgmSelectedIdx); hideBgmPanel(); }
}

async function drawBgmDetailWaveform(c) {
  const canvas = document.getElementById('bgmDetailWaveform');
  if (!canvas || !c) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = rect.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  try {
    if (!_bgmWaveformData || _bgmWaveformData._src !== c.source) {
      const resp = await fetch(VBASE + '/' + c.source);
      const buf = await resp.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const ab = await ac.decodeAudioData(buf);
      _bgmWaveformData = { data: ab.getChannelData(0), sr: ab.sampleRate, dur: ab.duration, _src: c.source };
      ac.close();
    }
    const { data, sr } = _bgmWaveformData;
    const step = Math.max(1, Math.ceil(data.length / canvas.width));
    const amp = canvas.height / 2;
    ctx.fillStyle = '#a78bfa';
    for (let i = 0; i < canvas.width; i++) {
      let mn = 1, mx = -1;
      for (let j = 0; j < step; j++) { const v = data[i * step + j] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      ctx.fillRect(i, (1 + mn) * amp, 1, Math.max(1, (mx - mn) * amp));
    }
  } catch {}
  drawBgmDetailRange(c);
}

function drawBgmDetailRange(c) {
  const range = document.getElementById('bgmDetailRange');
  const canvas = document.getElementById('bgmDetailWaveform');
  if (!range || !canvas || !c || !c.totalDuration) return;
  const w = canvas.parentElement.clientWidth;
  const left = (c.audioStart / c.totalDuration) * w;
  const width = (c.duration / c.totalDuration) * w;
  range.style.left = left + 'px';
  range.style.width = Math.max(4, width) + 'px';
}

// Make range draggable for IN/OUT point
function _initBgmDetailRange() {
  const container = document.getElementById('bgmDetailRange')?.parentElement;
  if (!container || container._bgmRangeInit) return;
  container._bgmRangeInit = true;

  container.addEventListener('mousedown', e => {
    const c = BGM_CLIPS[_bgmSelectedIdx]; if (!c) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const range = document.getElementById('bgmDetailRange');
    const rangeRect = range.getBoundingClientRect();

    // Click on left edge, right edge, or middle of range
    const x = e.clientX;
    const isLeftEdge = Math.abs(x - rangeRect.left) < 8;
    const isRightEdge = Math.abs(x - rangeRect.right) < 8;
    const isInside = x > rangeRect.left + 8 && x < rangeRect.right - 8;

    if (!isLeftEdge && !isRightEdge && !isInside) {
      // Click outside range: set IN point here
      const pct = (e.clientX - rect.left) / rect.width;
      const t = pct * c.totalDuration;
      c.audioStart = Math.max(0, Math.min(c.totalDuration - 0.3, t));
      c.duration = Math.min(c.totalDuration - c.audioStart, _bgmTotal() - c.start);
      selectBgmClip(_bgmSelectedIdx);
      renderBgmTrack();
      return;
    }

    const origAS = c.audioStart, origDur = c.duration;
    const startX = e.clientX;

    const onMove = ev => {
      const dx = ev.clientX - startX;
      const dt = (dx / rect.width) * c.totalDuration;
      if (isLeftEdge) {
        let newAS = Math.max(0, Math.min(origAS + origDur - 0.3, origAS + dt));
        c.audioStart = newAS;
        c.duration = origDur - (newAS - origAS);
      } else if (isRightEdge) {
        let newOut = Math.max(c.audioStart + 0.3, Math.min(c.totalDuration, origAS + origDur + dt));
        c.duration = newOut - c.audioStart;
      } else {
        // Drag entire range
        let newAS = Math.max(0, Math.min(c.totalDuration - origDur, origAS + dt));
        c.audioStart = newAS;
      }
      drawBgmDetailRange(c);
      document.getElementById('bgmInPoint').value = c.audioStart.toFixed(1);
      document.getElementById('bgmOutPoint').value = (c.audioStart + c.duration).toFixed(1);
      document.getElementById('bgmDurLabel').textContent = fmtTime(c.duration) + ' (' + c.duration.toFixed(1) + '초)';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      renderBgmTrack();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* ─── Auto-find best segment ─── */
async function bgmAutoFind() {
  const c = BGM_CLIPS[_bgmSelectedIdx];
  if (!c) { alert('BGM을 먼저 선택하세요'); return; }

  const btn = document.getElementById('bgmAutoFindBtn');
  btn.textContent = '⏳ 분석 중...';
  btn.disabled = true;

  try {
    // Build clip boundaries + clip data from current timeline
    const boundaries = [0];
    const clipsData = [];
    if (typeof starts !== 'undefined' && typeof CLIPS !== 'undefined') {
      for (let i = 0; i < CLIPS.length; i++) {
        const dur = typeof clipDur === 'function' ? clipDur(i) : (CLIPS[i].end - CLIPS[i].start);
        const end = starts[i] + dur;
        boundaries.push(parseFloat(end.toFixed(2)));
        clipsData.push({
          tlStart: parseFloat(starts[i].toFixed(2)),
          duration: parseFloat(dur.toFixed(2)),
          speed: clipMeta && clipMeta[i] ? (clipMeta[i].speed || 1) : 1,
        });
      }
    }
    const videoDur = typeof total !== 'undefined' ? total : 15;

    const r = await fetch(apiUrl('/api/bgm/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: c.source,
        clipBoundaries: boundaries,
        clipsData: clipsData,
        videoDuration: videoDur,
        topN: 5,
      }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);

    const results = document.getElementById('bgmAutoResults');
    const list = document.getElementById('bgmAutoList');
    results.style.display = 'block';

    let html = `<div style="font-size:8px;color:#555;margin-bottom:4px">템포: ${d.tempo} BPM | 비트: ${d.beatCount}개</div>`;
    (d.segments || []).forEach((seg, i) => {
      const pct = Math.round(seg.score * 100);
      const barW = Math.max(5, pct);
      html += `<div onclick="bgmApplySegment(${seg.start},${seg.end})" style="cursor:pointer;padding:4px 6px;margin-bottom:3px;background:#1a1a1a;border-radius:4px;border:1px solid #333;font-size:10px;transition:background .15s" onmouseover="this.style.background='#2a2a2a'" onmouseout="this.style.background='#1a1a1a'">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#a78bfa;font-weight:bold">#${i + 1}</span>
          <span style="color:#ddd">${fmtTime(seg.start)} ~ ${fmtTime(seg.end)}</span>
          <span style="color:#4ade80;font-size:9px">${pct}점</span>
        </div>
        <div style="margin-top:2px;height:3px;background:#333;border-radius:2px;overflow:hidden">
          <div style="width:${barW}%;height:100%;background:linear-gradient(90deg,#7c3aed,#4ade80);border-radius:2px"></div>
        </div>
        <div style="font-size:8px;color:#888;margin-top:2px">${seg.reason}</div>
      </div>`;
    });
    list.innerHTML = html;

  } catch (e) {
    alert('분석 실패: ' + e.message);
  } finally {
    btn.textContent = '🪄 자동 구간 찾기';
    btn.disabled = false;
  }
}

function bgmApplySegment(start, end) {
  const c = BGM_CLIPS[_bgmSelectedIdx];
  if (!c) return;
  c.audioStart = start;
  c.duration = end - start;
  c.start = 0; // 타임라인 맨 앞에 배치
  selectBgmClip(_bgmSelectedIdx);
  renderBgmTrack();
  // Visual feedback
  const results = document.getElementById('bgmAutoResults');
  const items = results.querySelectorAll('[onclick]');
  items.forEach(el => {
    if (el.getAttribute('onclick').includes(String(start))) {
      el.style.borderColor = '#4ade80';
    } else {
      el.style.borderColor = '#333';
    }
  });
}

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded',()=>{initBgmUI();_initBgmEvents();setTimeout(_initBgmDetailRange,500);});
