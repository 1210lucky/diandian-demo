// Swipe within the compact note card; tap to continue in the full Dots conversation.
const pagedPhone=$('.phone');
let pagedGesture=null,pagedWheelTimer=0,ignorePagedClickUntil=0;
const reducedPagedMotion=matchMedia('(prefers-reduced-motion: reduce)');

function openPagedConversation(){
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||!askOverlay.hidden)return;
  openAsk(true,{...capturePagedPosition(),reading:true});
}
function resetPagedReader(){
  clearTimeout(pagedWheelTimer);
  if(pagedGesture&&note.hasPointerCapture(pagedGesture.id))note.releasePointerCapture(pagedGesture.id);
  pagedGesture=null;ignorePagedClickUntil=0;
  pagedPhone.classList.remove('paged-dragging');
  pageTrack.classList.remove('dragging');pageTrack.style.translate='';
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
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||!askOverlay.hidden||event.button!==0||!event.isPrimary||pagedInteractive(event.target))return;
  clearTimeout(pagedWheelTimer);
  // Freeze an interrupted native smooth snap before beginning a new gesture.
  pageTrack.scrollTo({left:pageTrack.scrollLeft,behavior:'instant'});
  pagedGesture={id:event.pointerId,x:event.clientX,y:event.clientY,scale:pagedScale(),axis:null,
    card:!!event.target.closest('.media-area'),left:pageTrack.scrollLeft,
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
  }else note.scrollTop=Math.max(0,g.top-dy);
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
  }else{
    // Mouse and touch both retain a short, bounded glide after a normal vertical flick.
    const velocity=cancelled||stale?0:g.vy;
    const target=Math.max(0,Math.min(note.scrollHeight-note.clientHeight,note.scrollTop+Math.max(-260,Math.min(260,velocity*160))));
    note.scrollTo({top:target,behavior:smooth});
  }
}
note.addEventListener('pointerup',event=>finishPagedGesture(event));
note.addEventListener('pointercancel',event=>finishPagedGesture(event,true));
note.addEventListener('click',event=>{
  if(!isPagedNote||!askOverlay.hidden)return;
  if(performance.now()<ignorePagedClickUntil){event.preventDefault();event.stopPropagation();return}
  if(event.target.closest('.media-area')&&!pagedInteractive(event.target))openPagedConversation();
},true);
note.addEventListener('wheel',event=>{
  if(!isPagedNote||pagedPhone.dataset.view!=='note'||!askOverlay.hidden)return;
  const unit=event.deltaMode===1?16:event.deltaMode===2?note.clientHeight:1;
  const dx=event.deltaX*unit,dy=event.deltaY*unit;
  if(Math.abs(dx)>Math.abs(dy)&&event.target.closest('.media-area')){
    event.preventDefault();ignorePagedClickUntil=performance.now()+350;
    pageTrack.classList.add('dragging');pageTrack.scrollLeft+=dx;
    clearTimeout(pagedWheelTimer);
    pagedWheelTimer=setTimeout(()=>{pageTrack.classList.remove('dragging');selectAnswerPage(Math.round(pageTrack.scrollLeft/pageTrack.clientWidth))},120);
  }
},{passive:false});
