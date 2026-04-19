/* ─── state.js — Global state variables ─── */
let CLIPS=[];
// Global subtitle list — each sub has its own timing, independent of clips
// SUBS = [{id, text, style:{size,x,y,font,bg,bgColor,bgAlpha,color}, start, end}]
let SUBS=[];
let curSubIdx=-1; // currently selected global subtitle index
let _subIdCounter=0;
function nextSubId(){return 'sub_'+(++_subIdCounter)+'_'+Date.now()}

// Convert legacy formats to global subs
function normSubs(){
  if(!SUBS||!SUBS.length)return;
  // Already global format?
  if(SUBS[0]&&typeof SUBS[0]==='object'&&!Array.isArray(SUBS[0])&&SUBS[0].start!==undefined)return;
  // Legacy: SUBS[clipIdx] = string | [{text,style}]
  const global=[];
  SUBS.forEach((s,i)=>{
    const clipStart=starts[i]||0;
    const clipEnd=clipStart+clipDur(i);
    if(!s)return;
    if(typeof s==='string'&&s){
      global.push({id:nextSubId(),text:s,style:{...subStyleDefault},start:clipStart,end:clipEnd});
    }else if(Array.isArray(s)){
      s.forEach(entry=>{
        if(!entry)return;
        if(typeof entry==='string'&&entry){
          global.push({id:nextSubId(),text:entry,style:{...subStyleDefault},start:clipStart,end:clipEnd});
        }else if(entry.text){
          global.push({id:nextSubId(),text:entry.text,style:entry.style||{...subStyleDefault},start:entry.start!=null?entry.start:clipStart,end:entry.end!=null?entry.end:clipEnd});
        }
      });
    }
  });
  SUBS=global;
}

function getClipSubs(i){
  if(!starts||!starts.length)return[];
  const cs=starts[i]||0;
  const ce=cs+(clipDur(i)||0);
  return SUBS.filter(s=>s.end>cs&&s.start<ce);
}
function getCurSub(){return SUBS[curSubIdx]||null}
function getSubById(id){return SUBS.find(s=>s.id===id)||null}
let _hasInitialData=false;
const API_BASE=window.location.origin||'http://localhost:8092';
const VBASE=API_BASE;
const srcDurs={};
const srcFps={}; // source → fps mapping

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function apiUrl(path){
  if(/^https?:\/\//.test(path))return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// Per-clip crop data: {x,y,w,h} as 0~100% of frame (mask outside)
let clipCrops=[];
// Per-clip zoom data: {scale, panX, panY} scale=1~4, pan as % offset
let clipZooms=[];
let cropMode=false;

function cropOf(i){return clipCrops[i]||{x:0,y:0,w:100,h:100}}
function zoomOf(i){return clipZooms[i]||{scale:1,panX:0,panY:0}}

function applyCropToVideo(){
  // Crop = mask via clip-path (outside area = phone bg black)
  const vid=document.getElementById('vid');
  const c=cropOf(cur);
  if(c.x===0&&c.y===0&&c.w===100&&c.h===100){
    vid.style.clipPath='';
  } else {
    const l=c.x+'%', t=c.y+'%', r=(c.x+c.w)+'%', b=(c.y+c.h)+'%';
    vid.style.clipPath=`polygon(${l} ${t}, ${r} ${t}, ${r} ${b}, ${l} ${b})`;
  }
  applyZoomToVideo();
  updateCropInfo();
}

function applyZoomToVideo(){
  const vid=document.getElementById('vid');
  if(cur<0||cur>=clipZooms.length)return;
  const z=clipZooms[cur];
  if(!z||z.scale===undefined){vid.style.transform='';return}
  if(z.scale===1&&z.panX===0&&z.panY===0){
    vid.style.transform='';
    vid.style.transformOrigin='center center';
  } else {
    vid.style.transformOrigin='center center';
    vid.style.transform=`scale(${z.scale}) translate(${z.panX}%, ${z.panY}%)`;
  }
  // Ken Burns overrides static zoom transform
  const activeKB=getKBAtTime(gTime);
  if(activeKB.length) updateKenBurnsFrame();
  updateZoomInfo();
  console.log(`[zoom] clip=${cur} scale=${z.scale} panX=${z.panX} panY=${z.panY}`,clipZooms.map((z,i)=>`${i}:${z.scale}`).join(' '));
}

function updateCropOverlay(){
  const c=cropOf(cur);
  const rect=document.getElementById('cropRect');
  rect.style.left=c.x+'%';rect.style.top=c.y+'%';
  rect.style.width=c.w+'%';rect.style.height=c.h+'%';
  // dim regions
  const dT=document.getElementById('cropDimT');
  dT.style.left='0';dT.style.top='0';dT.style.right='0';dT.style.height=c.y+'%';
  const dB=document.getElementById('cropDimB');
  dB.style.left='0';dB.style.bottom='0';dB.style.right='0';dB.style.height=(100-c.y-c.h)+'%';
  const dL=document.getElementById('cropDimL');
  dL.style.left='0';dL.style.top=c.y+'%';dL.style.width=c.x+'%';dL.style.height=c.h+'%';
  const dR=document.getElementById('cropDimR');
  dR.style.right='0';dR.style.top=c.y+'%';dR.style.width=(100-c.x-c.w)+'%';dR.style.height=c.h+'%';
}

function updateCropInfo(){
  const c=cropOf(cur);
  const el=document.getElementById('cropInfo');
  if(c.x===0&&c.y===0&&c.w===100&&c.h===100)el.textContent='전체';
  else el.textContent=`${Math.round(c.x)}%, ${Math.round(c.y)}% — ${Math.round(c.w)}×${Math.round(c.h)}%`;
}

function updateZoomInfo(){
  const z=zoomOf(cur);
  document.getElementById('zoomScaleVal').textContent=z.scale.toFixed(1)+'x';
  document.getElementById('zoomPanXVal').textContent=Math.round(z.panX)+'%';
  document.getElementById('zoomPanYVal').textContent=Math.round(z.panY)+'%';
}

function syncZoomUI(){
  const z=zoomOf(cur);
  document.getElementById('zoomScale').value=z.scale*100;
  document.getElementById('zoomPanX').value=z.panX;
  document.getElementById('zoomPanY').value=z.panY;
  updateZoomInfo();
}

let zoomAllMode=false;
function toggleZoomAll(){
  zoomAllMode=!zoomAllMode;
  const btn=document.getElementById('zoomAllBtn');
  btn.textContent=zoomAllMode?'전체 적용: ON':'전체 적용: OFF';
  btn.style.color=zoomAllMode?'#fbbf24':'';
  btn.style.borderColor=zoomAllMode?'#fbbf24':'';
}
function onZoomChange(){
  const scale=parseInt(document.getElementById('zoomScale').value)/100;
  const panX=parseInt(document.getElementById('zoomPanX').value);
  const panY=parseInt(document.getElementById('zoomPanY').value);
  if(zoomAllMode){
    // 전체 적용 모드: 모든 클립에 동일 값 적용
    for(let i=0;i<clipZooms.length;i++){
      clipZooms[i]={scale,panX,panY};
    }
  } else {
    // 개별 적용: 현재 클립만
    clipZooms[cur]={scale,panX,panY};
  }
  applyZoomToVideo();
}

function resetZoom(){
  if(zoomAllMode){
    // 전체 적용 ON이면 모든 클립 초기화
    for(let i=0;i<clipZooms.length;i++)clipZooms[i]={scale:1,panX:0,panY:0};
  } else {
    clipZooms[cur]={scale:1,panX:0,panY:0};
  }
  syncZoomUI();applyZoomToVideo();
}


