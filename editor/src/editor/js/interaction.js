/* ─── interaction.js — Subtitle time lookup + drag/trim + KB drag/trim + selection + track + toggle + media upload + letterbox ─── */
/* ─── Subtitle time lookup ─── */
function getSubsAtTime(t){
  return SUBS.filter(s=>s.text&&t>=s.start&&t<s.end);
}
function scaleSubOv(){
  const ph=document.getElementById('phoneFrame');
  const ov=document.getElementById('subOv');
  if(!ph||!ov)return;
  const s=ph.clientWidth/432;
  ov.style.transform=`scale(${s})`;
  // Sync reference phone size
  const rph=document.getElementById('refPhoneFrame');
  if(rph){rph.style.width=ph.clientWidth+'px';rph.style.height=ph.clientHeight+'px'}
}

function showSubAtTime(t){
  updateKenBurnsFrame();
  const ov=document.getElementById('subOv');
  if(!subtitlesVisible){ov.classList.add('h');return}
  const activeSubs=getSubsAtTime(t);
  if(!activeSubs.length){ov.classList.add('h');ov.innerHTML='';return}
  ov.classList.remove('h');ov.innerHTML='';
  activeSubs.forEach(sub=>{
    const gi=SUBS.indexOf(sub);
    const st=sub.style||subStyleDefault;
    const span=document.createElement('span');
    span.className='sub-tx'+(gi===curSubIdx?' sub-active':'');
    // XSS 방지: textContent + 줄바꿈 별도 처리
    span.textContent='';
    const rawText=sub.text.replace(/\\n/g,'\n');
    rawText.split('\n').forEach((line,li)=>{
      if(li>0)span.appendChild(document.createElement('br'));
      span.appendChild(document.createTextNode(line));
    });
    // Fixed at 432px baseline — Playwright renders at same size with device_scale_factor
    span.style.fontSize=(st.size||16)+'px';
    span.style.left=(st.x||50)+'%';
    span.style.top=(st.y||80)+'%';
    span.style.transform='translate(-50%,-50%)';
    span.style.fontFamily=st.font||"'Apple SD Gothic Neo',sans-serif";
    span.style.color=st.color||'#ffffff';
    span.style.lineHeight=(st.lineHeight||140)+'%';
    span.style.textAlign=st.textAlign||'center';
    if(st.boxWidth&&st.boxWidth>0){
      span.style.width=(st.boxWidth)+'%';
      span.style.maxWidth=(st.boxWidth)+'%';
      span.style.wordBreak='break-word';
    }
    if(st.bg!==false){
      const bgC=st.bgColor||'#000000';
      const bgA=typeof st.bgAlpha==='number'?st.bgAlpha:0.6;
      const r=parseInt(bgC.slice(1,3),16),g=parseInt(bgC.slice(3,5),16),b=parseInt(bgC.slice(5,7),16);
      span.style.background=`rgba(${r},${g},${b},${bgA})`;
    }else{
      span.style.background='transparent';
    }
    // Stroke (outline)
    if(st.stroke){
      const sw=st.strokeWidth||2;
      const sc=st.strokeColor||'#000000';
      span.style.webkitTextStroke=sw+'px '+sc;
      span.style.paintOrder='stroke fill';
    }
    // ─── Effect animation (matches Remotion output) ───
    const effect=sub.effect||'none';
    const subProgress=(t-sub.start)/(sub.end-sub.start); // 0~1
    const subDuration=sub.end-sub.start;
    if(effect==='typewriter'){
      const revealPct=0.6;
      const fullText=rawText;
      const charsToShow=Math.floor(Math.min(subProgress/revealPct,1)*fullText.length);
      span.textContent='';
      const revealed=fullText.substring(0,charsToShow);
      revealed.split('\n').forEach((line,li)=>{
        if(li>0)span.appendChild(document.createElement('br'));
        span.appendChild(document.createTextNode(line));
      });
    }else if(effect==='slideUp'){
      const enterSec=0.33;const exitSec=0.33;
      const enterPct=enterSec/subDuration;const exitPct=1-exitSec/subDuration;
      let offsetY=0,opacity=1;
      if(subProgress<enterPct){
        offsetY=60*(1-subProgress/enterPct);
        opacity=subProgress/enterPct;
      }else if(subProgress>exitPct){
        offsetY=60*(subProgress-exitPct)/(1-exitPct);
        opacity=1-(subProgress-exitPct)/(1-exitPct);
      }
      span.style.transform=`translate(-50%,-50%) translateY(${offsetY}px)`;
      span.style.opacity=opacity;
    }else if(effect==='fadeIn'){
      const fadeSec=0.5;
      const fadeInPct=fadeSec/subDuration;const fadeOutPct=1-fadeSec/subDuration;
      let opacity=1;
      if(subProgress<fadeInPct){opacity=subProgress/fadeInPct;}
      else if(subProgress>fadeOutPct){opacity=1-(subProgress-fadeOutPct)/(1-fadeOutPct);}
      span.style.opacity=opacity;
    }

    span.dataset.subIdx=gi;
    span.addEventListener('mousedown',e=>{
      e.stopPropagation();
      selectSub(gi);
      initSubDrag(e,gi);
    });
    ov.appendChild(span);
  });
}

/* ─── Subtitle drag & trim ─── */
function subSnapTo(t){
  if(!snapOn)return t;
  const threshold=5/pxPerSec;
  // Snap to clip boundaries
  for(let j=0;j<starts.length;j++){
    if(Math.abs(t-starts[j])<threshold)return starts[j];
    const end=starts[j]+clipDur(j);
    if(Math.abs(t-end)<threshold)return end;
  }
  // Snap to other subtitle boundaries
  for(let j=0;j<subTiming.length;j++){
    const st=subTiming[j];if(!st)continue;
    if(Math.abs(t-st.start)<threshold)return st.start;
    if(Math.abs(t-st.end)<threshold)return st.end;
  }
  return t;
}
function initTimelineSubDrag(el,i){
  let startX,origStart,origEnd;
  el.addEventListener('mousedown',(e)=>{
    if(e.target.classList.contains('sub-trim'))return;
    e.preventDefault();e.stopPropagation();
    save();
    startX=e.clientX;
    const t=subTiming[i];origStart=t.start;origEnd=t.end;
    const dur=origEnd-origStart;
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      let ns=Math.max(0,origStart+dx);
      let ne=ns+dur;
      if(ne>total){ne=total;ns=ne-dur}
      ns=subSnapTo(ns);ne=ns+dur;
      subTiming[i].start=ns;subTiming[i].end=ne;
      subTiming[i]._manual=true;
      el.style.left=(ns*pxPerSec)+'px';
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}
function initSubTrim(handle,i,side){
  if(!handle)return;
  handle.addEventListener('mousedown',(e)=>{
    e.preventDefault();e.stopPropagation();
    save();
    const startX=e.clientX;
    const t=subTiming[i];const origStart=t.start;const origEnd=t.end;
    const parent=handle.closest('.tl-sub-clip');
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      if(side==='left'){
        let ns=Math.max(0,Math.min(origEnd-0.3,origStart+dx));
        ns=subSnapTo(ns);
        subTiming[i].start=ns;
        parent.style.left=(ns*pxPerSec)+'px';
        parent.style.width=((subTiming[i].end-ns)*pxPerSec)+'px';
      } else {
        let ne=Math.max(origStart+0.3,Math.min(total,origEnd+dx));
        ne=subSnapTo(ne);
        subTiming[i].end=ne;
        parent.style.width=((ne-subTiming[i].start)*pxPerSec)+'px';
      }
      subTiming[i]._manual=true;
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

/* ─── Global subtitle drag & trim ─── */
function initGlobalSubDrag(el,gi){
  el.addEventListener('mousedown',(e)=>{
    if(e.target.classList.contains('sub-trim'))return;
    e.preventDefault();e.stopPropagation();
    save();
    const startX=e.clientX;
    const sub=SUBS[gi];const origStart=sub.start;const origEnd=sub.end;
    const dur=origEnd-origStart;
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      let ns=Math.max(0,origStart+dx);
      let ne=ns+dur;
      if(ne>total){ne=total;ns=ne-dur}
      ns=subSnapTo(ns);ne=ns+dur;
      sub.start=ns;sub.end=ne;
      el.style.left=(ns*pxPerSec)+'px';
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);renderTL()};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}
function initGlobalSubTrim(handle,gi,side){
  if(!handle)return;
  handle.addEventListener('mousedown',(e)=>{
    e.preventDefault();e.stopPropagation();
    save();
    const startX=e.clientX;
    const sub=SUBS[gi];const origStart=sub.start;const origEnd=sub.end;
    const parent=handle.closest('.tl-sub-clip');
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      if(side==='left'){
        let ns=Math.max(0,Math.min(origEnd-0.3,origStart+dx));
        ns=subSnapTo(ns);
        sub.start=ns;
        parent.style.left=(ns*pxPerSec)+'px';
        parent.style.width=((sub.end-ns)*pxPerSec)+'px';
      }else{
        let ne=Math.max(origStart+0.3,Math.min(total+5,origEnd+dx));
        ne=subSnapTo(ne);
        sub.end=ne;
        parent.style.width=((ne-sub.start)*pxPerSec)+'px';
      }
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);renderTL()};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

/* ─── Global KB drag & trim ─── */
function initGlobalKBDrag(el,gi){
  el.addEventListener('mousedown',(e)=>{
    if(e.target.classList.contains('kb-trim'))return;
    e.preventDefault();e.stopPropagation();
    save();
    const startX=e.clientX;
    const kb=KB_EFFECTS[gi];const origStart=kb.start;const origEnd=kb.end;
    const dur=origEnd-origStart;
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      let ns=Math.max(0,origStart+dx);
      let ne=ns+dur;
      if(ne>total){ne=total;ns=ne-dur}
      ns=subSnapTo(ns);ne=ns+dur;
      kb.start=ns;kb.end=ne;
      el.style.left=(ns*pxPerSec)+'px';
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);renderTL()};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}
function initGlobalKBTrim(handle,gi,side){
  if(!handle)return;
  handle.addEventListener('mousedown',(e)=>{
    e.preventDefault();e.stopPropagation();
    save();
    const startX=e.clientX;
    const kb=KB_EFFECTS[gi];const origStart=kb.start;const origEnd=kb.end;
    const parent=handle.closest('.tl-kb-clip');
    const onMove=(ev)=>{
      const dx=(ev.clientX-startX)/pxPerSec;
      if(side==='left'){
        let ns=Math.max(0,Math.min(origEnd-0.3,origStart+dx));
        ns=subSnapTo(ns);
        kb.start=ns;
        parent.style.left=(ns*pxPerSec)+'px';
        parent.style.width=((kb.end-ns)*pxPerSec)+'px';
      }else{
        let ne=Math.max(origStart+0.3,Math.min(total+5,origEnd+dx));
        ne=subSnapTo(ne);
        kb.end=ne;
        parent.style.width=((ne-kb.start)*pxPerSec)+'px';
      }
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);renderTL()};
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

/* ─── Timeline Subtitle selection ─── */
function selectTimelineSub(i){
  selectedSub=i;
  document.querySelectorAll('.tl-sub-clip').forEach((el,j)=>el.classList.toggle('sel',j===i));
  // Move playhead without selecting clip
  const t=subTiming[i];
  if(t){
    gTime=t.start;
    const ph=document.getElementById('playhead');
    ph.style.left=(HDR+gTime*pxPerSec)+'px';
    showSubAtTime(gTime);
  }
}
function deselectSub(){
  selectedSub=-1;
  document.querySelectorAll('.tl-sub-clip').forEach(el=>el.classList.remove('sel'));
}
function deleteSelectedSub(){
  if(selectedSub<0||selectedSub>=SUBS.length)return;
  save();
  SUBS.splice(selectedSub,1);
  curSubIdx=-1;selectedSub=-1;
  deselectSub();
  renderTL();
  showSubAtTime(gTime);
}

/* ─── Track area click — deselect when clicking empty space ─── */
function onTrackAreaClick(e){
  // If click target is a clip or inside a clip, ignore (clip has its own handler)
  if(e.target.closest('.tl-clip,.tl-sub-clip,.tl-kb-clip,.tl-audio-clip,.tl-trim'))return;
  // Deselect all clips
  cur=-1;
  deselectSub();
  document.querySelectorAll('.tl-clip').forEach(el=>el.classList.remove('active'));
  // Hide subtitle overlay
  document.getElementById('subOv').classList.add('h');
  updateMediaBtn();
}

/* ─── Subtitle Toggle ─── */
let subtitlesVisible=true;
function toggleSubtitleDisplay(){
  subtitlesVisible=!subtitlesVisible;
  const btn=document.getElementById('subToggleBtn');
  btn.classList.toggle('on',subtitlesVisible);
  // Toggle subtitle track visibility
  const subTrack=document.getElementById('subTrack');
  if(subTrack)subTrack.style.display=subtitlesVisible?'':'none';
  // Refresh current subtitle display
  if(subtitlesVisible){
    applySubStyle();
  } else {
    document.getElementById('subOv').classList.add('h');
  }
}

/* ─── External Media Upload & Source Change ─── */
function updateMediaBtn(){
  const btn=document.getElementById('mediaBtn');
  if(!btn)return;
  const hasSelection=cur>=0&&cur<CLIPS.length&&document.querySelector('.tl-clip.active');
  if(hasSelection){
    btn.textContent='📎 미디어 수정';btn.title='현재 클립의 미디어 수정 또는 새 미디어 추가';
  } else {
    btn.textContent='📎 미디어 추가';btn.title='미디어 추가';
  }
}
function uploadExternalVideo(){
  document.getElementById('extVideoUpload').click();
}
function handleExtUpload(fileList){
  if(!fileList||!fileList.length)return;
  const fd=new FormData();
  for(const f of fileList)fd.append('files',f);
  const btn=document.getElementById('mediaBtn');
  btn.disabled=true;btn.textContent='⏳ 업로드 중...';
  fetch(apiUrl('/api/upload'),{method:'POST',body:fd})
    .then(r=>r.json()).then(data=>{
      btn.disabled=false;updateMediaBtn();
      document.getElementById('extVideoUpload').value='';
      if(!data.uploaded||!data.uploaded.length)return;
      showUploadResultModal(data.uploaded);
    }).catch(e=>{
      btn.disabled=false;updateMediaBtn();
      alert('업로드 실패: '+e);
    });
}

function addUploadedAsNewClips(uploaded){
  save();
  uploaded.forEach(v=>{
    CLIPS.push({source:v.name,source_idx:0,start:0,end:v.duration,score:0});
    clipMeta.push({speed:1});
    clipSubStyles.push({...subStyleDefault});clipCrops.push({x:0,y:0,w:100,h:100});clipZooms.push({scale:1,panX:0,panY:0});clipEffects.push([]);
    subTiming.push({start:0,end:0}); // will be recalculated by recalc()
  });
  syncTransitions();
  const srcNames=[...new Set(CLIPS.map(c=>c.source))];
  CLIPS.forEach(c=>{c.source_idx=srcNames.indexOf(c.source)});
  recalc();renderTL();sel(CLIPS.length-1);
}
function showUploadResultModal(uploaded){
  const hasSelection=cur>=0&&cur<CLIPS.length&&document.querySelector('.tl-clip.active');
  // 포커스 없으면 바로 추가
  if(!hasSelection){
    addUploadedAsNewClips(uploaded);
    return;
  }
  // 포커스 있으면 모달 표시 (수정 or 추가 선택)
  document.getElementById('uploadModal')?.remove();
  const modal=document.createElement('div');
  modal.id='uploadModal';
  modal.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:400;display:flex;align-items:center;justify-content:center';
  const items=uploaded.map(v=>`<div style="padding:8px 12px;background:#222;border:1px solid #333;border-radius:6px;margin-bottom:4px;font-size:12px;color:#ccc">${v.name} (${v.duration}s, ${v.size}MB)</div>`).join('');
  modal.innerHTML=`
    <div style="background:#1e1e1e;border:1px solid #3a3a3a;border-radius:12px;padding:24px 32px;min-width:360px;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <h3 style="font-size:14px;color:#e0e0e0;margin:0 0 12px">업로드 완료</h3>
      ${items}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn" id="uploadCancel" style="padding:8px 16px;font-size:12px">닫기</button>
        <button class="btn" id="uploadReplace" style="padding:8px 16px;font-size:12px;color:#fbbf24;border-color:#fbbf24">현재 클립 소스 변경</button>
        <button class="btn pri" id="uploadAdd" style="padding:8px 16px;font-size:12px">새 클립으로 추가</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('uploadCancel').onclick=()=>modal.remove();
  document.getElementById('uploadAdd').onclick=()=>{modal.remove();addUploadedAsNewClips(uploaded)};
  document.getElementById('uploadReplace').onclick=()=>{
    modal.remove();
    if(!uploaded.length)return;
    save();
    const v=uploaded[0];
    CLIPS[cur].source=v.name;
    CLIPS[cur].start=0;CLIPS[cur].end=v.duration;
    const srcNames=[...new Set(CLIPS.map(c=>c.source))];
    CLIPS.forEach(c=>{c.source_idx=srcNames.indexOf(c.source)});
    recalc();renderTL();sel(cur);
  };
}

function changeClipSource(){
  // Fetch available videos and let user pick
  fetch(apiUrl('/api/list-videos')).then(r=>r.json()).then(data=>{
    if(!data.videos||!data.videos.length){alert('서버에 영상이 없습니다');return}
    document.getElementById('srcChangeModal')?.remove();
    const modal=document.createElement('div');
    modal.id='srcChangeModal';
    modal.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:400;display:flex;align-items:center;justify-content:center';
    const items=data.videos.map(v=>`<div class="src-change-item" data-name="${v.name}" data-dur="${v.duration}" style="padding:8px 12px;background:#222;border:1px solid #333;border-radius:6px;margin-bottom:4px;font-size:12px;color:#ccc;cursor:pointer;transition:.1s">${v.name} (${v.duration}s, ${v.size}MB)</div>`).join('');
    modal.innerHTML=`
      <div style="background:#1e1e1e;border:1px solid #3a3a3a;border-radius:12px;padding:24px 32px;min-width:360px;max-width:500px;max-height:70vh;box-shadow:0 20px 60px rgba(0,0,0,.5);display:flex;flex-direction:column">
        <h3 style="font-size:14px;color:#e0e0e0;margin:0 0 12px">클립 #${cur+1} 소스 변경</h3>
        <div style="overflow-y:auto;flex:1;margin-bottom:12px">${items}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('srcChangeModal').remove()" style="padding:8px 16px;font-size:12px">취소</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.src-change-item').forEach(el=>{
      el.addEventListener('mouseover',()=>{el.style.borderColor='#2563eb';el.style.background='#1e293b'});
      el.addEventListener('mouseout',()=>{el.style.borderColor='#333';el.style.background='#222'});
      el.addEventListener('click',()=>{
        save();
        CLIPS[cur].source=el.dataset.name;
        CLIPS[cur].start=0;
        CLIPS[cur].end=parseFloat(el.dataset.dur)||5;
        const srcNames=[...new Set(CLIPS.map(c=>c.source))];
        CLIPS.forEach(c=>{c.source_idx=srcNames.indexOf(c.source)});
        recalc();renderTL();sel(cur);
        modal.remove();
      });
    });
  });
}

/* ─── Letterbox Detection ─── */
function checkLetterbox(){
  const vid=document.getElementById('vid');
  const phone=document.getElementById('phoneFrame');
  if(!vid.videoWidth||!vid.videoHeight){phone.classList.remove('letterbox');return}
  const videoRatio=vid.videoWidth/vid.videoHeight;
  const phoneRatio=phone.clientWidth/phone.clientHeight; // ~9:16 = 0.5625
  // If video is landscape (ratio > phone ratio), use letterbox
  if(videoRatio>phoneRatio*1.1){
    phone.classList.add('letterbox');
    // Sync blur background
    const blur=document.getElementById('vidBlur');
    if(blur.src!==vid.src){blur.src=vid.src;blur.currentTime=vid.currentTime}
  } else {
    phone.classList.remove('letterbox');
  }
}
// Sync blur bg time with main video
const _vid=document.getElementById('vid');
_vid.addEventListener('loadedmetadata',()=>{checkLetterbox()});
_vid.addEventListener('seeked',()=>{
  const blur=document.getElementById('vidBlur');
  if(document.getElementById('phoneFrame').classList.contains('letterbox')){
    blur.currentTime=_vid.currentTime;
  }
});
_vid.addEventListener('timeupdate',()=>{
  const blur=document.getElementById('vidBlur');
  if(document.getElementById('phoneFrame').classList.contains('letterbox')&&Math.abs(blur.currentTime-_vid.currentTime)>0.5){
    blur.currentTime=_vid.currentTime;
  }
});

