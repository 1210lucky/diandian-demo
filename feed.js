// Keep the existing detail surfaces mounted so back navigation preserves reading positions.
const feedPage=$('#feedPage'),feedScroll=$('#feedScroll'),feedTarget=$('#feedTarget');
const detailSurfaces=[...$('.phone').children].filter(el=>el!==feedPage);
let feedTransition,feedTransitionToken=0,activeFeedCard=feedTarget;
history.replaceState({...history.state,demoView:'feed'},'');

function captureNoteSurface(){
  return demoMotion.capture(detailSurfaces.filter(el=>el.matches('.note-header,.note-scroll,.engage-bar')),{surface:'phone'});
}
function setFeedVisible(show,animate=true){
  const token=++feedTransitionToken;
  feedTransition?.cancel();
  // Keep the feed stationary behind the expanding or collapsing note snapshot.
  feedPage.hidden=false;
  const cardRect=activeFeedCard.getBoundingClientRect(),phoneRect=$('.phone').getBoundingClientRect();
  const cardSnapshot=animate?demoMotion.capture(activeFeedCard,{surface:'card'}):null;
  const noteSnapshot=animate?captureNoteSurface():null;
  $('.phone').dataset.view=show?'feed':'note';
  feedPage.inert=animate||!show;
  detailSurfaces.forEach(el=>el.inert=animate||show);
  $('.demo-jumps').hidden=show||isPagedNote;
  $('#guideIntro').innerHTML=show?'左列体验上下滑动，<br>右上角体验左右翻页。':isPagedNote?'左右滑动阅读分页对话，<br>查看完整对话后继续追问。':'保留问题、回复和图文内容。<br>在卡片内部上下滑动，或按住拖动。';
  $('.guide-items>div:last-child p').innerHTML='<b>随时继续追问</b>'+(show?'上下滑动方案点「问点点」直接追问，左右滑动方案可先查看完整对话。':isPagedNote?'查看完整对话，再点「问点点」继续聊。':'点右下角「问点点」，选择推荐问题继续聊。');
  updateProgress();
  const finish=()=>{if(token!==feedTransitionToken)return;feedPage.hidden=!show;feedPage.inert=!show;detailSurfaces.forEach(el=>el.inert=show);if(animate)(show?activeFeedCard:$('#back')).focus({preventScroll:true})};
  if(animate){
    feedTransition=demoMotion.transition({
      fromRect:show?phoneRect:cardRect,toRect:show?cardRect:phoneRect,
      fromSnapshot:show?noteSnapshot:cardSnapshot,toSnapshot:show?cardSnapshot:noteSnapshot,
      onFinish:finish
    });
  }else finish();
}
function openFeedNote(event){
  if($('.phone').dataset.view!=='feed')return;
  activeFeedCard=event.currentTarget;
  setNotePagination(activeFeedCard.id==='feedPagedTarget');
  history.pushState({...history.state,demoView:'note',noteMode:isPagedNote?'paged':'scroll'},'');
  setFeedVisible(false);
}
function returnToFeed(){
  if(history.state?.demoView==='note')history.back();
  else setFeedVisible(true);
}
function resetExperience(){
  feedScroll.scrollTop=0;answer.scrollTop=0;note.scrollTop=0;
  returnToFeed();
}
window.addEventListener('popstate',event=>{
  // Browser back may arrive while the conversation or source-note overlay is open.
  clearTimeout(closeTimer);cancelConversationTransition();demoMotion.cancel();sourceAnimation?.cancel();
  document.activeElement?.blur();
  if($('#commentDialog').open)$('#commentDialog').close();
  askOverlay.hidden=true;askOverlay.classList.remove('is-open');setConversationMode(false);
  sourceNote.hidden=true;questionInput.blur();inertElements=[];sourceBackground=[];
  $('.workspace-header').inert=false;$('.demo-guide').inert=false;
  if(event.state?.demoView==='note'){setNotePagination(event.state.noteMode==='paged');activeFeedCard=isPagedNote?$('#feedPagedTarget'):feedTarget}
  setFeedVisible(event.state?.demoView!=='note');
});
feedTarget.addEventListener('click',openFeedNote);
$('#feedPagedTarget').addEventListener('click',openFeedNote);
$('#feedHome').addEventListener('click',()=>feedScroll.scrollTo({top:0,behavior:smooth}));
setFeedVisible(true,false);
