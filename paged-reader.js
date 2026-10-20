// Normal and clean reading share the same page canvas and content cuts.
const pagedPhone=$('.phone'),pagedMedia=$('.media-area'),pagedHeader=$('.phone>.note-header'),pagedEngage=$('.phone>.engage-bar');
let pagedClean=false,cleanProgress=0,pagedFrame=0,pagedGesture=null,pagedWheelTimer=0;
let ignorePagedClickUntil=0,ignorePagedWheelUntil=0,pagedBaseHeight=524;
const reducedPagedMotion=matchMedia('(prefers-reduced-motion: reduce)');

function measurePagedReader(){
  const phoneHeight=pagedPhone.clientHeight;
  pagedBaseHeight=phoneHeight-pagedHeader.offsetHeight-pagedEngage.offsetHeight;
  const pageHeight=Math.max(240,pagedBaseHeight-56);
  pagedPhone.style.setProperty('--paged-header',pagedHeader.offsetHeight+'px');
  pagedPhone.style.setProperty('--paged-bottom',pagedEngage.offsetHeight+'px');
  pagedPhone.style.setProperty('--paged-base-height',pagedBaseHeight+'px');
  pagedPhone.style.setProperty('--paged-page-height',pageHeight+'px');
  pagedPhone.style.setProperty('--paged-growth',(phoneHeight-pagedBaseHeight)+'px');
  pagedPhone.style.setProperty('--paged-center',Math.max(12,(phoneHeight-pageHeight-24)/2)+'px');
}
function paintPagedReader(progress){
  cleanProgress=progress;
  pagedPhone.style.setProperty('--clean-progress',String(progress));
}
function stopPagedAnimation(){
  if(!pagedFrame)return;
  cancelAnimationFrame(pagedFrame);pagedFrame=0;
  // A new gesture must not freeze the controls halfway through their entrance/exit.
  paintPagedReader(pagedClean?1:0);
  if(pagedClean)note.scrollTop=0;
}
function setPagedCleanState(clean){
  pagedClean=clean;
  pagedPhone.dataset.readingMode=clean?'clean':'normal';
  pagedPhone.classList.toggle('paged-clean',clean);
  pagedHeader.inert=clean;pagedEngage.inert=clean;
  $('.paged-note .ai-footer').inert=clean;pageDots.inert=clean;
  pageCount.setAttribute('aria-hidden',String(clean));
  pageTrack.setAttribute('aria-label',clean?'清屏阅读：左右翻页，轻点恢复操作栏，上滑查看笔记与评论':'左右滑动阅读新疆旅行对话，轻点进入清屏');
}
function animatePagedReader(clean,scrollTop=0){
  cancelAnimationFrame(pagedFrame);clearTimeout(pagedWheelTimer);
  const startProgress=cleanProgress,startScroll=note.scrollTop,start=performance.now();
  const duration=reducedPagedMotion.matches?0:340;
  setPagedCleanState(clean);
  function step(now){
    const fraction=duration?Math.min(1,(now-start)/duration):1;
    const eased=1-Math.pow(1-fraction,3);
    paintPagedReader(startProgress+((clean?1:0)-startProgress)*eased);
    note.scrollTop=startScroll+(scrollTop-startScroll)*eased;
    if(fraction<1)pagedFrame=requestAnimationFrame(step);
    else{pagedFrame=0;pageTrack.classList.remove('dragging');refreshAnswerPage()}
  }
  pagedFrame=requestAnimationFrame(step);
}
function togglePagedReader(){
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||!askOverlay.hidden)return;
  animatePagedReader(!pagedClean);
}
function revealPagedDetails(){
  ignorePagedWheelUntil=performance.now()+400;
  // Aim for a narrow card strip; native scroll bounds avoid blank space after short comments.
  animatePagedReader(false,pagedBaseHeight-24);
}
function resetPagedReader(){
  cancelAnimationFrame(pagedFrame);clearTimeout(pagedWheelTimer);
  pagedFrame=0;pagedGesture=null;pagedClean=false;ignorePagedClickUntil=0;ignorePagedWheelUntil=0;
  paintPagedReader(0);
  pagedPhone.classList.remove('paged-clean','paged-dragging');
  delete pagedPhone.dataset.readingMode;
  pageTrack.classList.remove('dragging');pageTrack.style.translate='';
  pagedHeader.inert=false;pagedEngage.inert=false;pageDots.inert=false;
  $('.ai-footer').inert=false;
}
function pagedScale(){return pagedPhone.getBoundingClientRect().width/pagedPhone.offsetWidth||1}
function pagedInteractive(target){return target.closest('button:not(:disabled),a,input,textarea')}
function pageBoundaryReturn(){
  const from=pageTrack.style.translate;
  pageTrack.style.translate='';
  if(from&&!reducedPagedMotion.matches)pageTrack.animate([{translate:from},{translate:'0px 0px'}],{duration:220,easing:'ease-out'});
}
function releasePagedPointer(event){
  if(note.hasPointerCapture(event.pointerId))note.releasePointerCapture(event.pointerId);
  pagedPhone.classList.remove('paged-dragging');
}

note.addEventListener('pointerdown',event=>{
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||event.button!==0||!event.isPrimary||pagedInteractive(event.target))return;
  stopPagedAnimation();clearTimeout(pagedWheelTimer);
  // Freeze an interrupted native smooth snap before beginning a new gesture.
  pageTrack.scrollTo({left:pageTrack.scrollLeft,behavior:'instant'});
  pagedGesture={id:event.pointerId,x:event.clientX,y:event.clientY,scale:pagedScale(),axis:null,
    card:!!event.target.closest('.media-area'),clean:pagedClean,left:pageTrack.scrollLeft,
    top:note.scrollTop,index:answerPageIndex,lastX:event.clientX,lastY:event.clientY,
    lastTime:performance.now(),vx:0,vy:0};
});
note.addEventListener('pointermove',event=>{
  const g=pagedGesture;if(!g||event.pointerId!==g.id)return;
  const dx=(event.clientX-g.x)/g.scale,dy=(event.clientY-g.y)/g.scale;
  if(!g.axis){
    if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
    if(g.card&&Math.abs(dx)>Math.abs(dy)*1.15)g.axis='x';
    else if(Math.abs(dy)>Math.abs(dx)*1.15)g.axis='y';
    else return;
    note.setPointerCapture(event.pointerId);pagedPhone.classList.add('paged-dragging');
    if(g.axis==='x')pageTrack.classList.add('dragging');
  }
  event.preventDefault();
  const now=performance.now(),elapsed=Math.max(1,now-g.lastTime);
  g.vx=(event.clientX-g.lastX)/g.scale/elapsed;
  g.vy=(g.lastY-event.clientY)/g.scale/elapsed;
  g.lastX=event.clientX;g.lastY=event.clientY;g.lastTime=now;
  if(g.axis==='x'){
    const max=pageTrack.scrollWidth-pageTrack.clientWidth,wanted=g.left-dx;
    pageTrack.scrollLeft=Math.max(0,Math.min(max,wanted));
    pageTrack.style.translate=(wanted<0?Math.min(28,-wanted*.25):wanted>max?-Math.min(28,(wanted-max)*.25):0)+'px 0px';
  }else{
    note.scrollTop=Math.max(0,g.top-dy);
    // A deliberate fast upward swipe commits immediately; slow drags stay clean until release.
    if(g.clean&&-dy>32&&g.vy>.65){
      ignorePagedClickUntil=now+350;pagedGesture=null;releasePagedPointer(event);revealPagedDetails();
    }
  }
},{passive:false});
function finishPagedGesture(event,cancelled=false){
  const g=pagedGesture;if(!g||event.pointerId!==g.id)return;
  pagedGesture=null;releasePagedPointer(event);
  if(!g.axis)return;
  ignorePagedClickUntil=performance.now()+350;
  const stale=performance.now()-g.lastTime>100;
  if(g.axis==='x'){
    const dx=(event.clientX-g.x)/g.scale,vx=stale?0:g.vx;
    pageBoundaryReturn();pageTrack.classList.remove('dragging');
    const move=!cancelled&&(Math.abs(dx)>pageTrack.clientWidth*.12||(Math.abs(dx)>12&&Math.abs(vx)>.45));
    selectAnswerPage(g.index+(move?(dx<0?1:-1):0));
  }else if(g.clean){
    if(!cancelled&&note.scrollTop>pagedPhone.clientHeight*.2)revealPagedDetails();
    else animatePagedReader(true,0);
  }else{
    // Mouse and touch both retain a short, bounded glide after a normal vertical flick.
    const velocity=cancelled||stale?0:g.vy;
    const target=Math.max(0,Math.min(note.scrollHeight-note.clientHeight,note.scrollTop+Math.max(-260,Math.min(260,velocity*160))));
    animatePagedReader(false,target);
  }
}
note.addEventListener('pointerup',event=>finishPagedGesture(event));
note.addEventListener('pointercancel',event=>finishPagedGesture(event,true));
note.addEventListener('click',event=>{
  if(!isPagedNote)return;
  if(performance.now()<ignorePagedClickUntil){event.preventDefault();event.stopPropagation();return}
  if(event.target.closest('.media-area')&&!pagedInteractive(event.target))togglePagedReader();
},true);
note.addEventListener('wheel',event=>{
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||!askOverlay.hidden)return;
  if(performance.now()<ignorePagedWheelUntil){event.preventDefault();return}
  const unit=event.deltaMode===1?16:event.deltaMode===2?note.clientHeight:1;
  const dx=event.deltaX*unit,dy=event.deltaY*unit;
  if(Math.abs(dx)>Math.abs(dy)&&event.target.closest('.media-area')){
    event.preventDefault();stopPagedAnimation();
    pageTrack.classList.add('dragging');pageTrack.scrollLeft+=dx;
    clearTimeout(pagedWheelTimer);
    pagedWheelTimer=setTimeout(()=>{pageTrack.classList.remove('dragging');selectAnswerPage(Math.round(pageTrack.scrollLeft/pageTrack.clientWidth))},120);
  }else if(pagedClean){
    event.preventDefault();stopPagedAnimation();
    note.scrollTop=Math.max(0,note.scrollTop+dy);
    clearTimeout(pagedWheelTimer);
    if(dy>45&&note.scrollTop>32)revealPagedDetails();
    else pagedWheelTimer=setTimeout(()=>note.scrollTop>pagedPhone.clientHeight*.2?revealPagedDetails():animatePagedReader(true),140);
  }
},{passive:false});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&isPagedNote&&pagedClean&&askOverlay.hidden){event.preventDefault();animatePagedReader(false)}
});
window.addEventListener('resize',()=>{
  if(!isPagedNote)return;
  cancelAnimationFrame(pagedFrame);pagedFrame=0;measurePagedReader();paintPagedReader(pagedClean?1:0);
});
