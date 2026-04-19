/* ─── panels.js — Panel resizers + playhead + keyboard ─── */
/* ─── Panel Resizers ─── */
(function(){
  const rH=document.getElementById('resizerH'),pv=document.getElementById('pvPanel');
  rH.addEventListener('mousedown',e=>{e.preventDefault();rH.classList.add('drag');const sX=e.clientX,sW=pv.offsetWidth;
    const mv=ev=>{const w=Math.max(180,Math.min(600,sW+(ev.clientX-sX)));pv.style.width=w+'px';const ph=pv.querySelector('.phone');const pw=Math.max(100,w*0.72);ph.style.width=pw+'px';ph.style.height=(pw*16/9)+'px';scaleSubOv();showSubAtTime(gTime)};
    const up=()=>{rH.classList.remove('drag');document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)});
  const rV=document.getElementById('resizerV'),tl=document.getElementById('tlPanel');
  rV.addEventListener('mousedown',e=>{e.preventDefault();rV.classList.add('drag');const sY=e.clientY,sH=tl.offsetHeight;
    const mv=ev=>{tl.style.height=Math.max(100,Math.min(500,sH-(ev.clientY-sY)))+'px'};
    const up=()=>{rV.classList.remove('drag');document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);renderTL()};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)});
})();

/* ─── Playhead drag + track click to seek ─── */
(function(){
  const ph=document.getElementById('tlPlayhead');
  const scroll=document.getElementById('tlScroll');

  function timeFromX(clientX){
    const rect=scroll.getBoundingClientRect();
    const x=clientX-rect.left+scroll.scrollLeft-HDR;
    return Math.max(0,Math.min(total,x/pxPerSec));
  }

  function scrubTo(t){
    if(playing)stopP();
    gTime=Math.max(0,Math.min(total,t));
    updatePlayhead();updateTC();
    // Find clip and show frame
    for(let i=0;i<CLIPS.length;i++){
      const end=starts[i]+clipDur(i);
      if(gTime<=end+0.01){
        const vid=document.getElementById('vid');
        const src=VBASE+'/'+CLIPS[i].source.split('/').pop();
        const changed=cur!==i;
        if(vid.dataset.src!==src){
          vid.src=src;vid.dataset.src=src;
          vid.onloadedmetadata=()=>{
            vid.currentTime=CLIPS[i].start+(gTime-starts[i])*(clipMeta[i]?.speed||1);
            checkLetterbox();applyCropToVideo();applyZoomToVideo();
          };
        } else {
          vid.currentTime=CLIPS[i].start+(gTime-starts[i])*(clipMeta[i]?.speed||1);
        }
        showSubAtTime(gTime);
        if(changed){cur=i;document.querySelectorAll('.tl-clip').forEach((e,j)=>e.classList.toggle('active',j===i));updateDetail();syncZoomUI();renderKBList()}
        applyZoomToVideo();applyCropToVideo();checkLetterbox();
        break;
      }
    }
  }

  // Drag playhead
  ph.addEventListener('mousedown',e=>{
    e.preventDefault();e.stopPropagation();
    const onMove=ev=>{scrubTo(timeFromX(ev.clientX))};
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  });

  // Click on track area to seek (but not on clips)
  scroll.addEventListener('mousedown',e=>{
    // Skip if clicking on clip, trim handle, playhead, etc.
    if(e.target.closest('.tl-clip')||e.target.closest('.tl-sub-clip')||e.target.closest('.tl-kb-clip')||e.target.closest('.tl-playhead'))return;
    // BGM track: allow blade tool, block seek for other interactions
    if(e.target.closest('#bgmTrack')){
      if(tool==='blade'&&typeof bladeCutBgm==='function'){
        const rect=scroll.getBoundingClientRect();
        const x=e.clientX-rect.left+scroll.scrollLeft-HDR;
        const t=Math.max(0,Math.min(total,x/pxPerSec));
        bladeCutBgm(t);
      }
      return;
    }
    e.preventDefault();
    scrubTo(timeFromX(e.clientX));
    const onMove=ev=>{scrubTo(timeFromX(ev.clientX))};
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  });
})();

/* ─── Keyboard ─── */
function _handleShortcut(k, meta, ctrl, shift) {
  // Playback & navigation — always allowed
  if(k==='Space')togglePlay();
  if(k==='ArrowLeft')seekToGlobal(gTime-1);
  if(k==='ArrowRight')seekToGlobal(gTime+1);
  if(k==='ArrowUp')sel(Math.max(0,cur-1));
  if(k==='ArrowDown')sel(Math.min(CLIPS.length-1,cur+1));
  if(k==='KeyJ')jkl('j');
  if(k==='KeyK')jkl('k');
  if(k==='KeyL')jkl('l');
  if(k==='Home')seekStart();
  if(k==='End')seekEnd();
  if(k==='KeyZ'&&shift)zoomFit();
  if(k==='Minus'||k==='NumpadSubtract')zoomOut();
  if(k==='Equal'||k==='NumpadAdd')zoomIn();

  // Editing — blocked when locked
  if(typeof _projectLocked!=='undefined'&&_projectLocked){
    if(k==='Delete'||k==='Backspace'||k==='KeyC'||k==='KeyP'||(k==='KeyZ'&&(meta||ctrl))){
      if(typeof _guardLocked==='function')_guardLocked();
      return;
    }
    return; // block other edit keys silently
  }
  if(k==='KeyV')setTool('select');
  if(k==='KeyC'&&!meta&&!ctrl)setTool('blade');
  if(k==='KeyP')setTool('crop');
  if(k==='Delete'||k==='Backspace'){
    if(selectedSub>=0){deleteSelectedSub();return}
    if(cur>=0&&cur<CLIPS.length&&CLIPS.length>1)delCur();
  }
  if(k==='KeyZ'&&(meta||ctrl))undo();
}

// Direct keyboard events (when iframe has focus)
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='SELECT')return;
  if(e.target.tagName==='TEXTAREA')return;
  if(e.target.tagName==='INPUT'&&e.target.type==='range'){e.target.blur();}
  else if(e.target.tagName==='INPUT')return;
  e.preventDefault();
  _handleShortcut(e.code, e.metaKey, e.ctrlKey, e.shiftKey);
});

// Parent page forwards keys via postMessage (when parent has focus)
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'brxce-keydown') return;
  _handleShortcut(e.data.code, e.data.metaKey, e.data.ctrlKey, e.data.shiftKey);
});

let currentProjectId=null;
let currentProjectName='';

