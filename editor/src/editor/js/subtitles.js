/* ─── subtitles.js — Subtitle editing + tools + snap + timeline + trim + blade + drag + selection + trim bar ─── */
function setTool(t){
  tool=t;
  document.querySelectorAll('.tool-btn').forEach(e=>e.classList.remove('active'));
  const btn=document.getElementById('tool'+t.charAt(0).toUpperCase()+t.slice(1));
  if(btn)btn.classList.add('active');
  document.getElementById('tlScroll').classList.toggle('blade-cursor',t==='blade');
  if(t!=='blade')document.getElementById('bladeLine').style.display='none';
  // Crop mode sync
  if(t==='crop'){
    cropMode=true;
    document.getElementById('cropOverlay').classList.add('active');
    document.getElementById('cropToggle').classList.add('on');
    updateCropOverlay();
  } else if(cropMode){
    cropMode=false;
    document.getElementById('cropOverlay').classList.remove('active');
    document.getElementById('cropToggle').classList.remove('on');
  }
}

/* ─── Snap ─── */
function toggleSnap(){snapOn=!snapOn;document.getElementById('snapBtn').classList.toggle('on',snapOn)}
function getSnapPoints(){
  const pts=[0];
  CLIPS.forEach((c,i)=>{pts.push(starts[i]);pts.push(starts[i]+clipDur(i))});
  pts.push(total);
  return[...new Set(pts)];
}
function snapTo(t,threshold){
  if(!snapOn)return t;
  const pts=getSnapPoints();
  const thr=threshold||0.5;
  let best=t;
  pts.forEach(p=>{if(Math.abs(p-t)<thr&&Math.abs(p-t)<Math.abs(best-t))best=p});
  return best;
}
function clipDur(i){return(CLIPS[i].end-CLIPS[i].start)/(clipMeta[i]?.speed||1)}

/* ─── Timeline Render ─── */
function renderTL(){
  // Auto-assign source_idx if missing (based on unique source names)
  const srcNames=[...new Set(CLIPS.map(c=>c.source))];
  CLIPS.forEach(c=>{if(c.source_idx==null)c.source_idx=srcNames.indexOf(c.source)});

  const totalW=total*pxPerSec;
  document.getElementById('trackArea').style.width=(HDR+totalW+120)+'px';

  // Ruler
  const ruler=document.getElementById('ruler');
  ruler.innerHTML='';
  const step=pxPerSec>=20?1:pxPerSec>=10?2:5;
  for(let t=0;t<=total+step;t+=step){
    const x=HDR+t*pxPerSec;
    const tk=document.createElement('div');
    tk.className='tl-ruler-tick';tk.style.left=x+'px';
    tk.style.height=t%(step*2===0?step*2:step*5)===0?'100%':'40%';
    ruler.appendChild(tk);
    if(t%((step<=2)?step*2:step)===0){
      const lb=document.createElement('div');lb.className='tl-ruler-label';lb.style.left=x+'px';lb.textContent=fmt(t);
      ruler.appendChild(lb);
    }
  }

  // Video track
  const vt=document.getElementById('videoTrack');vt.innerHTML='';
  CLIPS.forEach((c,i)=>{
    const dur=clipDur(i);
    const x=starts[i]*pxPerSec;const w=Math.max(dur*pxPerSec,6);
    const div=document.createElement('div');
    div.className=`tl-clip s${c.source_idx%6}${i===cur?' active':''}`;
    div.style.left=x+'px';div.style.width=w+'px';div.id='tc-'+i;

    const nm=c.source.split('/').pop().replace(/\.\w+$/,'');
    const clipSubs=getClipSubs(i);
    const subText=clipSubs.map(s=>s.text).filter(Boolean).join(' / ');
    const spd=clipMeta[i]?.speed||1;
    div.innerHTML=`
      <div class="tl-trim left" data-i="${i}" data-side="left"></div>
      <div class="tl-clip-inner">
        <div class="tl-clip-name">${i+1}. ${escHtml(nm)}${spd!==1?' ('+spd+'x)':''}</div>
        ${subText?`<div class="tl-clip-sub">${escHtml(subText)}</div>`:''}
      </div>
      <div class="tl-clip-dur">${dur.toFixed(1)}s</div>
      <div class="tl-trim right" data-i="${i}" data-side="right"></div>
    `;

    // Transition overlap visual (incoming: before this clip)
    if(i>0){
      const t=TRANSITIONS[i-1];
      if(t&&t.type!=='none'&&t.duration>0){
        const tw=t.duration*pxPerSec;
        const to=document.createElement('div');to.className='tl-trans-overlap';
        to.style.left='0';to.style.width=Math.min(tw,w)+'px';
        div.appendChild(to);
      }
    }
    // Transition overlap visual (outgoing: after this clip)
    if(i<CLIPS.length-1){
      const t=TRANSITIONS[i];
      if(t&&t.type!=='none'&&t.duration>0){
        const tw=t.duration*pxPerSec;
        const to=document.createElement('div');to.className='tl-trans-overlap';
        to.style.right='0';to.style.width=Math.min(tw,w)+'px';
        div.appendChild(to);
      }
    }

    div.addEventListener('mousedown',e=>{
      if(e.target.classList.contains('tl-trim'))return;
      if(tool==='blade'){bladeCut(e,i);return}
      sel(i);
      if(tool==='select')startClipDrag(e,i);
    });
    div.addEventListener('mousemove',e=>{
      if(tool==='blade')showBladeLine(e,i);
    });
    vt.appendChild(div);

    // Fade-in zone at start of first clip
    if(i===0){
      const fi=fadeInOut.fadeIn;
      const fiz=document.createElement('div');
      fiz.className='tl-trans-zone tl-fade-zone'+(fi.enabled?' has-trans':'');
      fiz.style.left='0px';
      fiz.innerHTML=`<span class="tz-icon">${fi.enabled?'◀':'◁'}</span>`;
      fiz.title='페이드 인';
      fiz.addEventListener('click',e=>{e.stopPropagation();showFadePopup('in',fiz)});
      vt.appendChild(fiz);
    }

    // Transition zone icon between clips
    if(i<CLIPS.length-1){
      const t=TRANSITIONS[i]||{type:'none',duration:0};
      const nextStart=starts[i+1]*pxPerSec;
      const tz=document.createElement('div');
      tz.className='tl-trans-zone'+(t.type!=='none'?' has-trans':'');
      tz.style.left=nextStart+'px';
      tz.innerHTML=`<span class="tz-icon">${t.type!=='none'?'⬡':'▸◂'}</span>`;
      tz.addEventListener('click',e=>{e.stopPropagation();showTransPopup(i,tz)});
      vt.appendChild(tz);
    }

    // Fade-out zone at end of last clip
    if(i===CLIPS.length-1){
      const fo=fadeInOut.fadeOut;
      const endX=(starts[i]+clipDur(i))*pxPerSec;
      const foz=document.createElement('div');
      foz.className='tl-trans-zone tl-fade-zone'+(fo.enabled?' has-trans':'');
      foz.style.left=endX+'px';
      foz.innerHTML=`<span class="tz-icon">${fo.enabled?'▶':'▷'}</span>`;
      foz.title='페이드 아웃';
      foz.addEventListener('click',e=>{e.stopPropagation();showFadePopup('out',foz)});
      vt.appendChild(foz);
    }
  });

  // Sub track — each global subtitle as independent bar, multi-row for overlaps
  const st=document.getElementById('subTrack');st.innerHTML='';
  const subColors=['#4ade80','#60a5fa','#f59e0b','#ec4899','#a78bfa','#14b8a6'];
  const ROW_H=24;
  
  // Assign rows: greedy interval scheduling
  const rows=[]; // rows[r] = end time of last subtitle in that row
  const subRows=[];
  SUBS.forEach((sub,gi)=>{
    let placed=false;
    for(let r=0;r<rows.length;r++){
      if(sub.start>=rows[r]){rows[r]=sub.end;subRows[gi]=r;placed=true;break}
    }
    if(!placed){subRows[gi]=rows.length;rows.push(sub.end)}
  });
  const numRows=Math.max(1,rows.length);
  const trackH=numRows*ROW_H+2;
  st.style.height=trackH+'px';
  document.getElementById('subTrackHeader').style.height=trackH+'px';
  
  SUBS.forEach((sub,gi)=>{
    if(!sub.text&&curSubIdx!==gi)return;
    const x=sub.start*pxPerSec;
    const w=Math.max((sub.end-sub.start)*pxPerSec,20);
    const row=subRows[gi]||0;
    const color=subColors[gi%subColors.length];
    const d=document.createElement('div');d.className='tl-sub-clip';
    d.style.left=x+'px';d.style.width=w+'px';
    d.style.top=(row*ROW_H+1)+'px';d.style.height=(ROW_H-2)+'px';
    d.style.borderColor=color;d.style.background=color+'22';
    const _tl=document.createElement('span');_tl.className='sub-trim left';_tl.style.background=color;
    const _tx=document.createElement('span');_tx.style.cssText=`pointer-events:none;overflow:hidden;text-overflow:ellipsis;color:${color};font-size:10px`;_tx.textContent=sub.text||'(빈 자막)';
    const _tr=document.createElement('span');_tr.className='sub-trim right';_tr.style.background=color;
    d.appendChild(_tl);d.appendChild(_tx);d.appendChild(_tr);
    if(selectedSub===gi||curSubIdx===gi)d.classList.add('sel');
    d.addEventListener('mousedown',(e)=>{e.stopPropagation()});
    d.addEventListener('click',(e)=>{
      if(e.target.classList.contains('sub-trim'))return;
      e.stopPropagation();
      curSubIdx=gi;selectedSub=gi;
      syncSubStylePanel();applySubStyle();renderTL();
    });
    initGlobalSubDrag(d,gi);
    initGlobalSubTrim(d.querySelector('.sub-trim.left'),gi,'left');
    initGlobalSubTrim(d.querySelector('.sub-trim.right'),gi,'right');
    st.appendChild(d);
  });

  // KB track — each global KB effect as independent bar, multi-row for overlaps
  const kbt=document.getElementById('kbTrack');kbt.innerHTML='';
  const kbColors=['#4ade80','#60a5fa','#f59e0b','#ec4899','#a78bfa','#14b8a6'];
  const KB_ROW_H=24;
  const effectLabels={'zoom-in':'줌인','zoom-out':'줌아웃','pan-left':'좌패닝','pan-right':'우패닝','none':'없음'};

  // Assign rows: greedy interval scheduling
  const kbRows=[];const kbRowEnds=[];
  KB_EFFECTS.forEach((kb,gi)=>{
    let placed=false;
    for(let r=0;r<kbRowEnds.length;r++){
      if(kb.start>=kbRowEnds[r]){kbRowEnds[r]=kb.end;kbRows[gi]=r;placed=true;break}
    }
    if(!placed){kbRows[gi]=kbRowEnds.length;kbRowEnds.push(kb.end)}
  });
  const kbNumRows=Math.max(1,kbRowEnds.length);
  const kbTrackH=kbNumRows*KB_ROW_H+2;
  kbt.style.height=kbTrackH+'px';
  document.getElementById('kbTrackHeader').style.height=kbTrackH+'px';

  KB_EFFECTS.forEach((kb,gi)=>{
    const x=kb.start*pxPerSec;
    const w=Math.max((kb.end-kb.start)*pxPerSec,20);
    const row=kbRows[gi]||0;
    const color=kbColors[gi%kbColors.length];
    const d=document.createElement('div');d.className='tl-kb-clip';
    d.style.left=x+'px';d.style.width=w+'px';
    d.style.top=(row*KB_ROW_H+1)+'px';d.style.height=(KB_ROW_H-2)+'px';
    d.style.borderColor=color;d.style.background=color+'22';
    const _kl=document.createElement('span');_kl.className='kb-trim left';_kl.style.background=color;
    const _kx=document.createElement('span');_kx.style.cssText=`pointer-events:none;overflow:hidden;text-overflow:ellipsis;color:${color};font-size:10px`;_kx.textContent=(effectLabels[kb.effect]||kb.effect)+' '+kb.intensity+'%';
    const _kr=document.createElement('span');_kr.className='kb-trim right';_kr.style.background=color;
    d.appendChild(_kl);d.appendChild(_kx);d.appendChild(_kr);
    if(curKBIdx===gi)d.classList.add('sel');
    d.addEventListener('mousedown',(e)=>{e.stopPropagation()});
    d.addEventListener('click',(e)=>{
      if(e.target.classList.contains('kb-trim'))return;
      e.stopPropagation();
      curKBIdx=gi;
      syncKBEditPanel();renderKBList();renderTL();
    });
    initGlobalKBDrag(d,gi);
    initGlobalKBTrim(d.querySelector('.kb-trim.left'),gi,'left');
    initGlobalKBTrim(d.querySelector('.kb-trim.right'),gi,'right');
    kbt.appendChild(d);
  });

  // Audio track (visual)
  const at=document.getElementById('audioTrack');at.innerHTML='';
  CLIPS.forEach((c,i)=>{
    const dur=clipDur(i);
    const x=starts[i]*pxPerSec;const w=Math.max(dur*pxPerSec,6);
    const d=document.createElement('div');d.className=`tl-audio-clip s${c.source_idx%6}`;
    d.style.left=x+'px';d.style.width=w+'px';
    at.appendChild(d);
  });

  // Format guide line + overflow shading
  document.getElementById('trackArea').querySelectorAll('.fmt-guide,.fmt-overflow').forEach(e=>e.remove());
  if(activeFormat>0){
    const guideX=HDR+activeFormat*pxPerSec;
    const guide=document.createElement('div');
    guide.className='fmt-guide';guide.style.left=guideX+'px';
    guide.innerHTML=`<span class="fmt-guide-label">${activeFormat}s</span>`;
    document.getElementById('trackArea').appendChild(guide);
    
    // Overflow shading
    if(total>activeFormat){
      const ov=document.createElement('div');
      ov.className='fmt-overflow';
      ov.style.left=guideX+'px';
      ov.style.right='0';
      document.getElementById('trackArea').appendChild(ov);
    }
    
    // Dim clips that exceed format duration
    CLIPS.forEach((c,i)=>{
      const clipEnd=starts[i]+clipDur(i);
      const el=document.getElementById('tc-'+i);
      if(el&&clipEnd>activeFormat)el.classList.add('overflow');
    });
  }

  initTrimHandles();
  updatePlayhead();
  if(typeof renderBgmTrack==='function')renderBgmTrack();
}

/* ─── Trim ─── */
function initTrimHandles(){
  document.querySelectorAll('.tl-trim').forEach(el=>{
    el.addEventListener('mousedown',e=>{
      e.stopPropagation();
      const i=parseInt(el.dataset.i),side=el.dataset.side;
      sel(i);save();
      const orig={s:CLIPS[i].start,e:CLIPS[i].end};
      const startX=e.clientX;
      const onMove=ev=>{
        const dt=(ev.clientX-startX)/pxPerSec*(clipMeta[i]?.speed||1);
        if(side==='left'){
          CLIPS[i].start=Math.max(0,Math.round((orig.s+dt)*10)/10);
          if(CLIPS[i].start>=CLIPS[i].end-0.2)CLIPS[i].start=CLIPS[i].end-0.2;
        } else {
          CLIPS[i].end=Math.round((orig.e+dt)*10)/10;
          if(CLIPS[i].end<=CLIPS[i].start+0.2)CLIPS[i].end=CLIPS[i].start+0.2;
        }
        recalc();renderTL();updateDetail();
      };
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp)};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
  });
}

/* ─── Blade ─── */
function showBladeLine(e,i){
  const el=document.getElementById('tc-'+i);
  if(!el)return;
  const scroll=document.getElementById('tlScroll');
  const scrollRect=scroll.getBoundingClientRect();
  const bl=document.getElementById('bladeLine');
  const x=e.clientX-scrollRect.left+scroll.scrollLeft;
  bl.style.display='block';
  bl.style.left=x+'px';
  bl.style.top='0';
  bl.style.height='100%';
}

function bladeCut(e,i){
  const el=document.getElementById('tc-'+i);
  if(!el)return;
  const rect=el.getBoundingClientRect();
  const pct=(e.clientX-rect.left)/rect.width;
  const c=CLIPS[i];
  const cutPoint=c.start+pct*(c.end-c.start);
  if(cutPoint<=c.start+0.2||cutPoint>=c.end-0.2)return;

  save();
  const newClip={...c,start:cutPoint,source_idx:c.source_idx};
  const origEnd=c.end;
  CLIPS[i].end=cutPoint;
  CLIPS.splice(i+1,0,{...newClip,end:origEnd});
  // Global subs: no clip-based splice needed (subtitles span clips independently)
  clipMeta.splice(i+1,0,{...clipMeta[i]});
  clipSubStyles.splice(i+1,0,{...clipSubStyles[i]});
  clipCrops.splice(i+1,0,{...clipCrops[i]});
  clipZooms.splice(i+1,0,{...clipZooms[i]});
  clipEffects.splice(i+1,0,[...(clipEffects[i]||[]).map(fx=>({...fx}))]);
  // Insert 'none' transition at split point
  TRANSITIONS.splice(i,0,{type:'none',duration:0});
  syncTransitions();
  // Split subTiming at cut point
  if(subTiming[i]){
    const st=subTiming[i];
    const splitT=starts[i]+((cutPoint-CLIPS[i].start)/(clipMeta[i]?.speed||1));
    subTiming.splice(i+1,0,{start:splitT,end:st.end,_manual:st._manual});
    st.end=splitT;
  }
  recalc();renderTL();sel(i);
  document.getElementById('bladeLine').style.display='none';
}

/* ─── Clip Drag Reorder ─── */
function startClipDrag(e,i){
  const startX=e.clientX;let moved=false;let dropTarget=-1;
  const el=document.getElementById('tc-'+i);
  const indicator=document.getElementById('dropIndicator');
  
  const onMove=ev=>{
    if(Math.abs(ev.clientX-startX)>8&&!moved){
      moved=true;
      if(el)el.classList.add('dragging');
    }
    if(!moved)return;
    
    // Calculate drop target
    const dt=(ev.clientX-startX)/pxPerSec;
    const newPos=starts[i]+dt;
    let t=0;
    for(let j=0;j<CLIPS.length;j++){if(newPos>starts[j]+clipDur(j)/2)t=j+1}
    if(t>i)t--;
    t=Math.max(0,Math.min(CLIPS.length-1,t));
    dropTarget=t;
    
    // Show drop indicator
    if(t!==i){
      const insertIdx=t>=i?t+1:t;
      let indicatorX;
      if(insertIdx>=CLIPS.length){
        indicatorX=HDR+(starts[CLIPS.length-1]+clipDur(CLIPS.length-1))*pxPerSec;
      } else {
        indicatorX=HDR+starts[insertIdx]*pxPerSec;
      }
      indicator.style.display='block';
      indicator.style.left=(indicatorX-1)+'px';
      indicator.style.top='0';
      indicator.style.height='100%';
    } else {
      indicator.style.display='none';
    }
  };
  
  const onUp=ev=>{
    document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
    if(el)el.classList.remove('dragging');
    indicator.style.display='none';
    if(!moved)return;
    
    if(dropTarget>=0&&dropTarget!==i){save();
      const cl=CLIPS.splice(i,1)[0],me=clipMeta.splice(i,1)[0],sst=clipSubStyles.splice(i,1)[0],scr=clipCrops.splice(i,1)[0],szm=clipZooms.splice(i,1)[0],sfx=(clipEffects.splice(i,1)[0]||[]);
      CLIPS.splice(dropTarget,0,cl);clipMeta.splice(dropTarget,0,me);clipSubStyles.splice(dropTarget,0,sst);clipCrops.splice(dropTarget,0,scr);clipZooms.splice(dropTarget,0,szm);clipEffects.splice(dropTarget,0,sfx);
      // Reset transitions (reorder invalidates positions)
      syncTransitions();
      recalc();renderTL();sel(dropTarget);
    }
  };
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

/* ─── Selection ─── */
// UI-only selection: updates highlight, detail panel, zoom/crop without touching video or gTime
function selUI(i){
  cur=i;
  document.querySelectorAll('.tl-clip').forEach((e,j)=>e.classList.toggle('active',j===i));
  updateDetail();
  deselectSub();
  showSubAtTime(gTime);
  syncSubUI();applySubStyle();
  applyCropToVideo();syncZoomUI();renderKBList();applyZoomToVideo();if(cropMode)updateCropOverlay();
  renderFxList();renderGfxList();curFxIdx=-1;syncFxEditPanel();applyEffectPreview();
  checkLetterbox();
  scrollToClip(i);
  updateMediaBtn();
}
function sel(i){
  cur=i;
  _trimZoom=1;_trimOffset=0; // reset trim zoom on clip change
  document.querySelectorAll('.tl-clip').forEach((e,j)=>e.classList.toggle('active',j===i));
  updateDetail();
  const c=CLIPS[i],vid=document.getElementById('vid');
  const src=VBASE+'/'+c.source.split('/').pop();
  // Set gTime to clip start and move playhead there
  gTime=starts[i];
  if(vid.dataset.src!==src){
    if(typeof _showLoader==='function')_showLoader();
    vid.src=src;vid.dataset.src=src;
    vid.onloadedmetadata=()=>{srcDurs[src]=vid.duration;vid.currentTime=c.start};
    vid.onloadeddata=()=>{vid.onloadeddata=null;if(typeof _hideLoader==='function')_hideLoader()};
  } else vid.currentTime=c.start;
  // Update playhead position to match gTime
  document.getElementById('tlPlayhead').style.left=(HDR+gTime*pxPerSec)+'px';
  updateTC();
  deselectSub();
  showSubAtTime(gTime);
  syncSubUI();applySubStyle();
  applyCropToVideo();syncZoomUI();renderKBList();applyZoomToVideo();if(cropMode)updateCropOverlay();
  renderFxList();renderGfxList();curFxIdx=-1;syncFxEditPanel();applyEffectPreview();
  checkLetterbox();
  scrollToClip(i);
  updateMediaBtn();
}

function scrollToClip(i){
  const scroll=document.getElementById('tlScroll');
  const x=HDR+starts[i]*pxPerSec;
  if(x<scroll.scrollLeft+60||x>scroll.scrollLeft+scroll.clientWidth-100)
    scroll.scrollLeft=Math.max(0,x-scroll.clientWidth/3);
}

function updateDetail(){
  const c=CLIPS[cur],m=clipMeta[cur];
  document.getElementById('clipLabel').textContent=`#${cur+1} / ${CLIPS.length}`;
  document.getElementById('dSrc').textContent=c.source.split('/').pop();
  // Don't overwrite focused input (user is typing)
  const ae=document.activeElement;
  const dS=document.getElementById('dStart'),dE=document.getElementById('dEnd');
  if(ae!==dS)dS.value=c.start.toFixed(1);
  if(ae!==dE)dE.value=c.end.toFixed(1);
  document.getElementById('dDur').textContent=clipDur(cur).toFixed(1)+'s';
  document.getElementById('dSpeed').value=m.speed;
  document.getElementById('dSpeedDur').textContent=`(${clipDur(cur).toFixed(1)}s 재생)`;
  updateTransDetail();
  // Subtitle list (independent of clip)
  renderSubList();
  if(curSubIdx>=0)syncSubStylePanel();
  // Update trim bar
  setTimeout(updateTrimBar,50);
}

/* ─── Visual Trim Bar ─── */
let _trimSrcDuration=0;
let _trimDragging=null; // 'start'|'end'|'range'|'seek'|null

let _trimZoom=1, _trimOffset=0; // zoom level and scroll offset (seconds)

function trimZoomIn(){
  _trimZoom=Math.min(20,_trimZoom*1.5);
  trimCenterOnClip();
  updateTrimBar();
}
function trimZoomOut(){
  _trimZoom=Math.max(1,_trimZoom/1.5);
  if(_trimZoom<=1.01){_trimZoom=1;_trimOffset=0}
  else trimCenterOnClip();
  updateTrimBar();
}
function trimZoomReset(){_trimZoom=1;_trimOffset=0;updateTrimBar()}
function trimScroll(delta){
  const visibleDur=_trimSrcDuration/_trimZoom;
  _trimOffset=Math.max(0,Math.min(_trimSrcDuration-visibleDur,_trimOffset+delta));
  updateTrimBar();
}
function trimCenterOnClip(){
  const c=CLIPS[cur];if(!c)return;
  const mid=(c.start+c.end)/2;
  const visibleDur=_trimSrcDuration/_trimZoom;
  _trimOffset=Math.max(0,Math.min(_trimSrcDuration-visibleDur,mid-visibleDur/2));
}

function updateTrimBar(){
  const c=CLIPS[cur];
  if(!c)return;
  const bar=document.getElementById('trimBar');
  const range=document.getElementById('trimRange');
  const phead=document.getElementById('trimPlayhead');
  
  // Get source video duration
  const vid=document.getElementById('vid');
  _trimSrcDuration=vid.duration||c.end+5;
  
  // Visible window
  const visibleDur=_trimSrcDuration/_trimZoom;
  const visStart=_trimOffset;
  const visEnd=visStart+visibleDur;
  
  const pct=x=>(((x-visStart)/visibleDur)*100).toFixed(2)+'%';
  const clampPct=x=>Math.max(-5,Math.min(105,((x-visStart)/visibleDur)*100)).toFixed(2)+'%';
  
  range.style.left=clampPct(c.start);
  range.style.width=(((Math.min(c.end,visEnd)-Math.max(c.start,visStart))/visibleDur)*100).toFixed(2)+'%';
  if(c.end<visStart||c.start>visEnd){range.style.display='none'}else{range.style.display=''}
  
  // Playhead
  const ct=vid.currentTime||c.start;
  phead.style.left=clampPct(ct);
  
  // Labels
  const sl=document.getElementById('trimStartLabel');
  const el=document.getElementById('trimEndLabel');
  const zi=document.getElementById('trimZoomInfo');
  if(sl)sl.textContent=formatTrimTime(visStart);
  if(el)el.textContent=formatTrimTime(visEnd);
  if(zi)zi.textContent=_trimZoom<=1.01?'1x':_trimZoom.toFixed(1)+'x';
  
  // Minimap
  const mm=document.getElementById('trimMinimap');
  if(mm){
    mm.style.display=_trimZoom>1.05?'block':'none';
    if(_trimZoom>1.05){
      const mr=document.getElementById('trimMiniRange');
      const mw=document.getElementById('trimMiniWindow');
      mr.style.left=((c.start/_trimSrcDuration)*100)+'%';
      mr.style.width=((Math.min(c.end-c.start,_trimSrcDuration)/_trimSrcDuration)*100)+'%';
      mw.style.left=((visStart/_trimSrcDuration)*100)+'%';
      mw.style.width=((visibleDur/_trimSrcDuration)*100)+'%';
    }
  }
}

function formatTrimTime(s){
  const m=Math.floor(s/60);
  const sec=Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

(function initTrimBar(){
  const bar=document.getElementById('trimBar');
  if(!bar)return;
  
  // Wheel scroll on trimBar
  bar.addEventListener('wheel',e=>{
    if(_trimZoom<=1.01)return;
    e.preventDefault();
    const step=(_trimSrcDuration/_trimZoom)*0.15;
    trimScroll(e.deltaY>0?step:-step);
  },{passive:false});
  
  // Minimap click/drag to scroll
  const mm=document.getElementById('trimMinimap');
  if(mm){
    let mmDrag=false;
    const mmSeek=e=>{
      const rect=mm.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
      const visibleDur=_trimSrcDuration/_trimZoom;
      _trimOffset=Math.max(0,Math.min(_trimSrcDuration-visibleDur,x*_trimSrcDuration-visibleDur/2));
      updateTrimBar();
    };
    mm.addEventListener('mousedown',e=>{e.preventDefault();mmDrag=true;mmSeek(e)});
    document.addEventListener('mousemove',e=>{if(mmDrag)mmSeek(e)});
    document.addEventListener('mouseup',()=>{mmDrag=false});
  }
  
  function getTimeFromX(e){
    const rect=bar.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    const visibleDur=_trimSrcDuration/_trimZoom;
    return _trimOffset+x*visibleDur;
  }
  
  function hitTest(e){
    const rect=bar.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width;
    const c=CLIPS[cur];
    if(!c||!_trimSrcDuration)return'seek';
    const visibleDur=_trimSrcDuration/_trimZoom;
    const startPct=(c.start-_trimOffset)/visibleDur;
    const endPct=(c.end-_trimOffset)/visibleDur;
    const threshold=8/rect.width;
    if(Math.abs(x-startPct)<threshold)return'start';
    if(Math.abs(x-endPct)<threshold)return'end';
    if(x>startPct&&x<endPct)return'range';
    return'seek';
  }
  
  let dragOrigin=null;
  
  bar.addEventListener('mousedown',e=>{
    e.preventDefault();
    const type=hitTest(e);
    _trimDragging=type;
    const c=CLIPS[cur];
    if(!c)return;
    
    if(type==='seek'){
      // Click outside range: move playhead
      const t=getTimeFromX(e);
      document.getElementById('vid').currentTime=t;
      updateTrimBar();
      _trimDragging=null;
      return;
    }
    
    save();
    dragOrigin={start:c.start,end:c.end,mouseT:getTimeFromX(e)};
    
    const onMove=ev=>{
      const t=getTimeFromX(ev);
      const dt=t-dragOrigin.mouseT;
      
      if(_trimDragging==='start'){
        c.start=Math.max(0,Math.round((dragOrigin.start+dt)*10)/10);
        if(c.start>=c.end-0.3)c.start=c.end-0.3;
        document.getElementById('vid').currentTime=c.start;
      }else if(_trimDragging==='end'){
        c.end=Math.round((dragOrigin.end+dt)*10)/10;
        if(c.end<=c.start+0.3)c.end=c.start+0.3;
        if(c.end>_trimSrcDuration)c.end=Math.round(_trimSrcDuration*10)/10;
        document.getElementById('vid').currentTime=c.end-0.5;
      }else if(_trimDragging==='range'){
        const dur=dragOrigin.end-dragOrigin.start;
        let newStart=Math.round((dragOrigin.start+dt)*10)/10;
        if(newStart<0)newStart=0;
        if(newStart+dur>_trimSrcDuration)newStart=Math.round((_trimSrcDuration-dur)*10)/10;
        c.start=newStart;
        c.end=Math.round((newStart+dur)*10)/10;
        document.getElementById('vid').currentTime=c.start;
      }
      
      document.getElementById('dStart').value=c.start.toFixed(1);
      document.getElementById('dEnd').value=c.end.toFixed(1);
      recalc();renderTL();updateTrimBar();updateDetail();
    };
    
    const onUp=()=>{
      _trimDragging=null;
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
    };
    
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
  
  // Cursor style
  bar.addEventListener('mousemove',e=>{
    if(_trimDragging)return;
    const type=hitTest(e);
    bar.style.cursor=type==='start'||type==='end'?'ew-resize':type==='range'?'grab':'crosshair';
  });
})();

