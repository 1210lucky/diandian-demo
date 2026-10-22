// Keep the existing detail surfaces mounted so back navigation preserves reading positions.
const feedPage=$('#feedPage'),feedScroll=$('#feedScroll'),feedTarget=$('#feedTarget');
const detailSurfaces=[...$('.phone').children].filter(el=>el!==feedPage);
let feedTransition,feedTransitionToken=0,activeFeedCard=feedTarget;
history.replaceState({...history.state,demoView:'feed'},'');

function captureNoteSurface(){
  return demoMotion.capture(detailSurfaces.filter(el=>el.matches('.note-header,.note-scroll,.engage-bar')),{surface:'phone'});
}
function setFeedVisible(show,animate=true){
  if(show)resetPagedReader();
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
  $('.demo-jumps').hidden=show||isPagedNote||posterExperience.active;
  $('#guideIntro').innerHTML=show?'方案1上下滑动，方案2左右翻页。<br>右列苏州封面是新增的方案3。':posterExperience.active?'整屏阅读苏州图文对话，<br>上下操作栏保持显示。':isPagedNote?'左右滑动阅读分页对话，<br>查看完整对话后继续追问。':'保留问题、回复和图文内容。<br>在卡片内部上下滑动，或按住拖动。';
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
  const mode=activeFeedCard.id==='feedPosterTarget'?'poster':activeFeedCard.id==='feedPagedTarget'?'paged':'scroll';
  setFeedNoteMode(mode);
  history.pushState({...history.state,demoView:'note',noteMode:mode},'');
  setFeedVisible(false);
}
function setFeedNoteMode(mode){
  posterExperience.setActive(false);
  setNotePagination(mode==='paged');
  posterExperience.setActive(mode==='poster');
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
  if(event.state?.demoView==='note'){setFeedNoteMode(event.state.noteMode);activeFeedCard=posterExperience.active?$('#feedPosterTarget'):isPagedNote?$('#feedPagedTarget'):feedTarget}
  setFeedVisible(event.state?.demoView!=='note');
});
feedTarget.addEventListener('click',openFeedNote);
$('#feedPagedTarget').addEventListener('click',openFeedNote);
$('#feedPosterTarget').addEventListener('click',openFeedNote);
$('#feedHome').addEventListener('click',()=>feedScroll.scrollTo({top:0,behavior:smooth}));
setFeedVisible(true,false);
