// Vertical notes retain their compact card. A tap enters the existing Dots reader.
// Reading gestures consume the answer first, then continue into the note and comments.
const verticalPhone=$('.phone'),readerScroll=$('#conversationScroll');
let verticalGesture=null,readerGesture=null,verticalClickUntil=0;
const verticalScale=()=>verticalPhone.getBoundingClientRect().width/verticalPhone.offsetWidth||1;
const scrollLimit=el=>Math.max(0,el.scrollHeight-el.clientHeight);
const interactiveReadingTarget=target=>target.closest('button:not(:disabled),a,input,textarea');
const conversationReaderOpen=()=>!askOverlay.hidden&&askSheet.matches('.reading-mode');

function consumeVerticalScroll(delta,inCard){
  if(inCard&&note.scrollTop<=.5){
    const before=answer.scrollTop;
    answer.scrollTop=Math.max(0,Math.min(scrollLimit(answer),before+delta));
    delta-=answer.scrollTop-before;
  }
  note.scrollTop=Math.max(0,Math.min(scrollLimit(note),note.scrollTop+delta));
}
note.addEventListener('pointerdown',event=>{
  if(isPagedNote||verticalPhone.dataset.view!=='note'||!askOverlay.hidden||event.button!==0||!event.isPrimary||interactiveReadingTarget(event.target))return;
  verticalGesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastY:event.clientY,time:performance.now(),velocity:0,moved:false,card:!!event.target.closest('.media-area')};
});
note.addEventListener('pointermove',event=>{
  const g=verticalGesture;if(!g||event.pointerId!==g.id)return;
  if(!g.moved){
    const dx=Math.abs(event.clientX-g.x),dy=Math.abs(event.clientY-g.y);
    if(Math.max(dx,dy)<7)return;
    g.horizontal=dx>dy*1.5;
    g.moved=true;note.setPointerCapture(event.pointerId);answer.classList.add('dragging');
  }
  event.preventDefault();
  if(g.horizontal)return;
  const now=performance.now(),delta=(g.lastY-event.clientY)/verticalScale();
  g.velocity=delta/Math.max(1,now-g.time);g.time=now;g.lastY=event.clientY;
  consumeVerticalScroll(delta,g.card);
},{passive:false});
function finishVerticalNoteGesture(event,cancelled=false){
  const g=verticalGesture;if(!g||g.id!==event.pointerId)return;
  verticalGesture=null;answer.classList.remove('dragging');
  if(note.hasPointerCapture(event.pointerId))note.releasePointerCapture(event.pointerId);
  if(!g.moved)return;
  verticalClickUntil=performance.now()+350;
  const velocity=cancelled||performance.now()-g.time>100?0:g.velocity;
  // Keep mouse/touch drags usable without launching another gesture on pointerup.
  consumeVerticalScroll(Math.max(-180,Math.min(180,velocity*90)),g.card);
}
note.addEventListener('pointerup',event=>finishVerticalNoteGesture(event));
note.addEventListener('pointercancel',event=>finishVerticalNoteGesture(event,true));
note.addEventListener('wheel',event=>{
  if(isPagedNote||!askOverlay.hidden||!event.target.closest('.media-area')||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  event.preventDefault();
  const unit=event.deltaMode===1?16:event.deltaMode===2?answer.clientHeight:1;
  consumeVerticalScroll(event.deltaY*unit,true);
},{passive:false});
note.addEventListener('click',event=>{
  if(isPagedNote||!askOverlay.hidden||interactiveReadingTarget(event.target))return;
  if(performance.now()<verticalClickUntil){event.preventDefault();event.stopPropagation();return}
  if(!event.target.closest('.media-area'))return;
  // A partially exposed card settles back to its full position before the zoom.
  note.scrollTop=0;
  openAsk(true,{...captureReadingPosition(),reading:true});
},true);
answer.addEventListener('keydown',event=>{
  if(isPagedNote||!['Enter',' '].includes(event.key))return;
  event.preventDefault();note.scrollTop=0;openAsk(true,{...captureReadingPosition(),reading:true});
});

// Full Dots conversation is a separate reading page: scrolling never reveals the note.
readerScroll.addEventListener('pointerdown',event=>{
  if(!conversationReaderOpen()||event.pointerType!=='mouse'||event.button!==0||interactiveReadingTarget(event.target))return;
  event.preventDefault();
  readerGesture={id:event.pointerId,y:event.clientY,top:readerScroll.scrollTop,moved:false};
});
readerScroll.addEventListener('pointermove',event=>{
  const g=readerGesture;if(!g||g.id!==event.pointerId)return;
  const delta=(g.y-event.clientY)/verticalScale();
  if(!g.moved){if(Math.abs(delta)<7)return;g.moved=true;readerScroll.setPointerCapture(event.pointerId)}
  event.preventDefault();readerScroll.scrollTop=g.top+delta;
});
function finishReaderGesture(event){
  if(!readerGesture||readerGesture.id!==event.pointerId)return;
  readerGesture=null;
  if(readerScroll.hasPointerCapture(event.pointerId))readerScroll.releasePointerCapture(event.pointerId);
}
readerScroll.addEventListener('pointerup',finishReaderGesture);
readerScroll.addEventListener('pointercancel',finishReaderGesture);
