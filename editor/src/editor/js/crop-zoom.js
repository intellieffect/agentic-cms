/* ─── crop-zoom.js — Crop/Zoom + crop IIFE ─── */
(function(){
  const overlay=document.getElementById('cropOverlay');
  const rectEl=document.getElementById('cropRect');

  // Draw new crop by dragging on overlay
  overlay.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('crop-handle')||e.target===rectEl)return;
    e.preventDefault();
    const phone=document.getElementById('phoneFrame');
    const pr=phone.getBoundingClientRect();
    const startPx=((e.clientX-pr.left)/pr.width)*100;
    const startPy=((e.clientY-pr.top)/pr.height)*100;
    const onMove=ev=>{
      const cx=((ev.clientX-pr.left)/pr.width)*100;
      const cy=((ev.clientY-pr.top)/pr.height)*100;
      const c=clipCrops[cur];
      c.x=Math.max(0,Math.min(startPx,cx));
      c.y=Math.max(0,Math.min(startPy,cy));
      c.w=Math.min(100-c.x,Math.abs(cx-startPx));
      c.h=Math.min(100-c.y,Math.abs(cy-startPy));
      updateCropOverlay();
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      const c=clipCrops[cur];
      if(c.w<3||c.h<3){c.x=0;c.y=0;c.w=100;c.h=100}
      applyCropToVideo();updateCropOverlay();
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });

  // Drag crop rect to move
  rectEl.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('crop-handle'))return;
    e.preventDefault();e.stopPropagation();
    const phone=document.getElementById('phoneFrame');
    const pr=phone.getBoundingClientRect();
    const c=clipCrops[cur];
    const ox=c.x,oy=c.y;
    const sx=e.clientX,sy=e.clientY;
    const onMove=ev=>{
      const dx=(ev.clientX-sx)/pr.width*100;
      const dy=(ev.clientY-sy)/pr.height*100;
      c.x=Math.max(0,Math.min(100-c.w,ox+dx));
      c.y=Math.max(0,Math.min(100-c.h,oy+dy));
      updateCropOverlay();
    };
    const onUp=()=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      applyCropToVideo();
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
  rectEl.style.cursor='move';

  // Corner resize handles
  document.querySelectorAll('.crop-handle').forEach(h=>{
    h.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const corner=h.dataset.corner;
      const phone=document.getElementById('phoneFrame');
      const pr=phone.getBoundingClientRect();
      const c=clipCrops[cur];
      const orig={x:c.x,y:c.y,w:c.w,h:c.h};
      const onMove=ev=>{
        const mx=((ev.clientX-pr.left)/pr.width)*100;
        const my=((ev.clientY-pr.top)/pr.height)*100;
        if(corner==='tl'){
          c.x=Math.max(0,Math.min(orig.x+orig.w-5,mx));
          c.y=Math.max(0,Math.min(orig.y+orig.h-5,my));
          c.w=orig.x+orig.w-c.x;c.h=orig.y+orig.h-c.y;
        }else if(corner==='tr'){
          c.y=Math.max(0,Math.min(orig.y+orig.h-5,my));
          c.w=Math.max(5,Math.min(100-orig.x,mx-orig.x));
          c.h=orig.y+orig.h-c.y;
        }else if(corner==='bl'){
          c.x=Math.max(0,Math.min(orig.x+orig.w-5,mx));
          c.w=orig.x+orig.w-c.x;
          c.h=Math.max(5,Math.min(100-orig.y,my-orig.y));
        }else{
          c.w=Math.max(5,Math.min(100-c.x,mx-c.x));
          c.h=Math.max(5,Math.min(100-c.y,my-c.y));
        }
        updateCropOverlay();
      };
      const onUp=()=>{
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
        applyCropToVideo();
      };
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  });
})();

// Default subtitle style — position as % of phone frame
let subStyleDefault={size:16,x:50,y:80,font:"'BMDOHYEON',sans-serif",bg:true,bgColor:'#000000',bgAlpha:0.6,color:'#ffffff',lineHeight:120,textAlign:'center',boxWidth:0};
// Per-clip subtitle styles
let clipSubStyles=[];
// Convenience getter for current clip
function subStyle(){return clipSubStyles[cur]||subStyleDefault}

function applySubStyle(){
  showSubAtTime(gTime);
  const selSub=getCurSub();
  if(selSub){
    const st=selSub.style||subStyleDefault;
    document.getElementById('subPosInfo').textContent=`${Math.round(st.x||50)}%, ${Math.round(st.y||80)}%`;
  }
}

function initSubDrag(e,idx){
  const phone=document.getElementById('phoneFrame');
  const rect=phone.getBoundingClientRect();
  const sub=SUBS[idx];
  if(!sub)return;
  const st=sub.style||(sub.style={...subStyleDefault});
  const startX=st.x,startY=st.y;
  const mx0=e.clientX,my0=e.clientY;
  const span=e.target.closest('.sub-tx')||e.target;
  span.style.transition='none'; // disable transition during drag
  span.style.cursor='grabbing';
  let rafId=0,latestEv=null;
  
  const tick=()=>{
    if(!latestEv)return;
    const dx=(latestEv.clientX-mx0)/rect.width*100;
    const dy=(latestEv.clientY-my0)/rect.height*100;
    st.x=Math.max(5,Math.min(95,startX+dx));
    st.y=Math.max(5,Math.min(95,startY+dy));
    span.style.left=st.x+'%';
    span.style.top=st.y+'%';
    document.getElementById('subPosInfo').textContent=`${Math.round(st.x)}%, ${Math.round(st.y)}%`;
    latestEv=null;
  };
  
  const onMove=ev=>{
    ev.preventDefault();
    latestEv=ev;
    cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(tick);
  };
  const onUp=()=>{
    cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    span.style.cursor='';
    applySubStyle();
  };
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}

function selectSub(idx){
  curSubIdx=idx;
  renderSubList();
  syncSubStylePanel();
  applySubStyle();
}

function syncSubStylePanel(){
  const sub=getCurSub();
  const panel=document.getElementById('subEditPanel');
  if(!sub){panel.style.display='none';return}
  panel.style.display='block';
  const st=sub.style||clipSubStyles[cur]||subStyleDefault;
  document.getElementById('subIn').value=sub.text||'';
  document.getElementById('subSize').value=st.size||16;
  document.getElementById('subSizeVal').textContent=(st.size||16)+'px';
  document.getElementById('subFont').value=st.font||"'Apple SD Gothic Neo',sans-serif";
  document.getElementById('subBg').checked=(st.bg===true||st.bg===undefined||(typeof st.bg==='string'));
  document.getElementById('subBgColor').value=st.bgColor||'#000000';
  document.getElementById('subBgAlpha').value=Math.round((typeof st.bgAlpha==='number'?st.bgAlpha:0.6)*100);
  document.getElementById('subColor').value=st.color||'#ffffff';
  document.getElementById('subStroke').checked=!!st.stroke;
  document.getElementById('subStrokeColor').value=st.strokeColor||'#000000';
  document.getElementById('subStrokeWidth').value=st.strokeWidth||2;
  document.getElementById('subStrokeWidthVal').textContent=(st.strokeWidth||2)+'px';
  document.getElementById('subLineHeight').value=st.lineHeight||140;
  document.getElementById('subLineHeightVal').textContent=(st.lineHeight||140)+'%';
  document.getElementById('subBoxWidth').value=st.boxWidth||0;
  document.getElementById('subBoxWidthVal').textContent=st.boxWidth?st.boxWidth+'%':'자동';
  // Text align buttons
  const curAlign=st.textAlign||'left';
  ['Left','Center','Right'].forEach(a=>{
    const btn=document.getElementById('align'+a);
    if(btn){btn.classList.toggle('active',curAlign===a.toLowerCase())}
  });
  document.getElementById('subPosInfo').textContent=`${Math.round(st.x||50)}%, ${Math.round(st.y||80)}%`;
  document.getElementById('subEffect').value=sub.effect||'none';
}

function onSubStyleChange(){
  const sub=getCurSub();
  if(!sub)return;
  if(!sub.style)sub.style={...subStyleDefault};
  const st=sub.style;
  st.size=parseInt(document.getElementById('subSize').value);
  st.font=document.getElementById('subFont').value;
  st.bg=document.getElementById('subBg').checked;
  st.bgColor=document.getElementById('subBgColor').value;
  st.bgAlpha=parseInt(document.getElementById('subBgAlpha').value)/100;
  st.color=document.getElementById('subColor').value;
  st.stroke=document.getElementById('subStroke').checked;
  st.strokeColor=document.getElementById('subStrokeColor').value;
  st.strokeWidth=parseInt(document.getElementById('subStrokeWidth').value)||2;
  st.lineHeight=parseInt(document.getElementById('subLineHeight').value)||140;
  st.boxWidth=parseInt(document.getElementById('subBoxWidth').value)||0;
  document.getElementById('subBoxWidthVal').textContent=st.boxWidth?st.boxWidth+'%':'자동';
  // textAlign is set by setSubTextAlign(), read current active button
  const activeAlignBtn=document.querySelector('.sub-align-text-btn.active');
  if(activeAlignBtn){
    if(activeAlignBtn.id==='alignLeft')st.textAlign='left';
    else if(activeAlignBtn.id==='alignCenter')st.textAlign='center';
    else if(activeAlignBtn.id==='alignRight')st.textAlign='right';
  }
  document.getElementById('subSizeVal').textContent=st.size+'px';
  document.getElementById('subStrokeWidthVal').textContent=st.strokeWidth+'px';
  document.getElementById('subLineHeightVal').textContent=st.lineHeight+'%';
  // Effect
  sub.effect=document.getElementById('subEffect').value||'none';
  applySubStyle();
}

function alignSub(x,y){
  const sub=getCurSub();
  if(!sub)return;
  if(!sub.style)sub.style={...subStyleDefault};
  if(x!==null)sub.style.x=x;
  if(y!==null)sub.style.y=y;
  applySubStyle();
}

function setSubTextAlign(align){
  const sub=getCurSub();
  if(!sub)return;
  if(!sub.style)sub.style={...subStyleDefault};
  sub.style.textAlign=align;
  ['Left','Center','Right'].forEach(a=>{
    const btn=document.getElementById('align'+a);
    if(btn)btn.classList.toggle('active',align===a.toLowerCase());
  });
  applySubStyle();
}

function applyToAll(){
  const sub=getCurSub();
  if(!sub||!sub.style)return;
  const refStyle={...sub.style};
  SUBS.forEach(s=>{
    if(s.style)Object.assign(s.style,{size:refStyle.size,font:refStyle.font,bg:refStyle.bg,bgColor:refStyle.bgColor,bgAlpha:refStyle.bgAlpha,color:refStyle.color,stroke:refStyle.stroke,strokeColor:refStyle.strokeColor,strokeWidth:refStyle.strokeWidth,lineHeight:refStyle.lineHeight,textAlign:refStyle.textAlign,boxWidth:refStyle.boxWidth});
  });
  applySubStyle();
}

// ─── Subtitle Presets (localStorage) ─── 
const PRESET_KEY='tvcut_sub_presets';
const LAST_STYLE_KEY='tvcut_sub_last';

function getPresets(){try{return JSON.parse(localStorage.getItem(PRESET_KEY))||{}}catch{return{}}}
function setPresets(p){localStorage.setItem(PRESET_KEY,JSON.stringify(p))}

function saveSubPreset(){
  const name=prompt('프리셋 이름:');if(!name)return;
  const presets=getPresets();
  presets[name]={...subStyle()};
  setPresets(presets);
  refreshPresetList();
}

function loadSubPreset(){
  const sel=document.getElementById('presetSelect').value;
  if(!sel)return;
  const presets=getPresets();
  if(!presets[sel])return;
  Object.assign(subStyle(),presets[sel]);
  syncSubUI();applySubStyle();
}

function deleteSubPreset(){
  const sel=document.getElementById('presetSelect').value;
  if(!sel)return;
  const presets=getPresets();
  delete presets[sel];
  setPresets(presets);
  refreshPresetList();
}

function refreshPresetList(){
  const sel=document.getElementById('presetSelect');
  const presets=getPresets();
  sel.innerHTML='<option value="">-- 프리셋 선택 --</option>';
  Object.keys(presets).forEach(k=>{
    const o=document.createElement('option');o.value=k;o.textContent=k;sel.appendChild(o);
  });
}

function syncSubUI(){
  const s=subStyle();
  document.getElementById('subSize').value=s.size;
  document.getElementById('subSizeVal').textContent=s.size+'px';
}

// Auto-save last style on change, auto-restore on load
function persistLastStyle(){localStorage.setItem(LAST_STYLE_KEY,JSON.stringify(subStyle()))}
function restoreLastStyle(){
  try{
    const s=JSON.parse(localStorage.getItem(LAST_STYLE_KEY));
    if(s){Object.assign(subStyleDefault,s);clipSubStyles=CLIPS.map(()=>({...subStyleDefault}))}
  }catch{}
  syncSubUI();
}

// Subtitle drag is now handled per-subtitle in initSubDrag()

let cur=0,playing=false,gTime=0,playSpeed=1,_onTU=null,_playGen=0;
let starts=[],total=0;
let hist=[];
let pxPerSec=40;
let tool='select'; // select, trim, blade
let snapOn=true;
let markInT=null,markOutT=null;
const HDR=64; // header width
let activeFormat=0; // 0=full, 15, 30, 60

// Clip extra data
let clipMeta=[];
// Transitions between clips: TRANSITIONS[i] = transition between clip i and clip i+1
// length = CLIPS.length - 1
let TRANSITIONS=[]; // [{type:'none',duration:0},{type:'fade',duration:0.5},...]
// Independent subtitle timing: {start: globalSec, end: globalSec} per subtitle
let subTiming=[]; // legacy compat — not used for global subs
let selectedSub=-1; // timeline selected subtitle index into SUBS[]

function save(){hist.push({c:JSON.parse(JSON.stringify(CLIPS)),s:JSON.parse(JSON.stringify(SUBS)),m:JSON.parse(JSON.stringify(clipMeta)),ss:JSON.parse(JSON.stringify(clipSubStyles)),cr:JSON.parse(JSON.stringify(clipCrops)),zm:JSON.parse(JSON.stringify(clipZooms)),kb:JSON.parse(JSON.stringify(KB_EFFECTS)),fx:JSON.parse(JSON.stringify(clipEffects)),gfx:JSON.parse(JSON.stringify(globalEffects)),tr:JSON.parse(JSON.stringify(TRANSITIONS))})}
function undo(){if(!hist.length)return;const h=hist.pop();CLIPS=h.c;SUBS=h.s;clipMeta=h.m;clipSubStyles=h.ss;clipCrops=h.cr;clipZooms=h.zm;KB_EFFECTS=h.kb||[];clipEffects=h.fx||CLIPS.map(()=>[]);globalEffects=h.gfx||[];TRANSITIONS=h.tr||syncTransitions();recalc();renderTL();sel(Math.min(cur,CLIPS.length-1))}

function recalc(){
  syncTransitions();
  let t=0;starts=CLIPS.map((c,i)=>{
    const s=t;
    const spd=clipMeta[i]?.speed||1;
    t+=(c.end-c.start)/spd;
    // Subtract transition overlap (current clip overlaps with next)
    if(i<CLIPS.length-1&&TRANSITIONS[i]&&TRANSITIONS[i].type!=='none'&&TRANSITIONS[i].duration>0){
      const clipLen=(c.end-c.start)/spd;
      const nextSpd=clipMeta[i+1]?.speed||1;
      const nextLen=(CLIPS[i+1].end-CLIPS[i+1].start)/nextSpd;
      const maxOverlap=Math.min(clipLen,nextLen)*0.4; // max 40% of shorter clip
      t-=Math.min(TRANSITIONS[i].duration,maxOverlap);
    }
    return s;
  });total=t;
  document.getElementById('totalInfo').textContent=`${CLIPS.length} clips · ${total.toFixed(1)}s`;
  // Init subTiming if needed (default: match clip timing)
  while(subTiming.length<CLIPS.length){
    const i=subTiming.length;
    subTiming.push({start:starts[i]||0,end:(starts[i]||0)+clipDur(i)});
  }
  // Sync subTiming for clips that haven't been manually adjusted
  CLIPS.forEach((c,i)=>{
    if(!subTiming[i]._manual){
      subTiming[i].start=starts[i];
      subTiming[i].end=starts[i]+clipDur(i);
    }
  });
}

function fmt(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}
function tc(s){const m=Math.floor(s/60),sec=s%60;return String(m).padStart(2,'0')+':'+sec.toFixed(1).padStart(4,'0')}

/* ─── Tools ─── */
