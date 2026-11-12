// Only scheme 2 uses this viewer. Opening a picture never opens the Dots reader.
(() => {
  const phone=$('.phone'),viewer=$('#noteImageViewer'),pages=$('#noteImagePages');
  const closeButton=$('#closeNoteImages'),count=$('#noteImageCount'),toolbar=$('.note-image-toolbar');
  let opened=false,closing=false,index=0,slides=[],background=[],returnFocus=null,returnTop=0;
  let drag=null,scrollFrame=0,entryAnimation=null;

  function updateCount(){
    count.textContent=(index+1)+'/'+slides.length;
    slides.forEach((slide,i)=>slide.element.setAttribute('aria-hidden',String(i!==index)));
    if(history.state?.noteImageViewer)history.replaceState({...history.state,noteImageIndex:index},'');
  }
  function selectPage(next,animate=false){
    index=Math.max(0,Math.min(slides.length-1,next));
    pages.scrollTo({left:index*pages.clientWidth,behavior:animate?smooth:'instant'});
    updateCount();
  }
  function layout(){
    if(!opened||!pages.clientWidth)return;
    const availableHeight=Math.max(1,viewer.clientHeight-2*(toolbar.offsetTop+toolbar.offsetHeight+12));
    slides.forEach(slide=>{
      const scale=Math.min(pages.clientWidth/slide.width,availableHeight/slide.height);
      slide.frame.style.width=slide.width*scale+'px';
      slide.frame.style.height=slide.height*scale+'px';
      slide.snapshot.style.transform='scale('+scale+')';
    });
    selectPage(index);
  }
  function makeSlide(source,i){
    const element=document.createElement('figure');element.className='note-image-slide';
    element.setAttribute('role','img');element.setAttribute('aria-label','笔记图片，第 '+(i+1)+' 张');
    const frame=document.createElement('div');frame.className='note-image-frame';
    const snapshot=demoMotion.capture(source,{surface:'card'});snapshot.classList.add('note-image-art');
    snapshot.style.backgroundColor='#f5f5f5';
    frame.append(snapshot);element.append(frame);pages.append(element);
    return {element,frame,snapshot,width:source.offsetWidth,height:source.offsetHeight};
  }
  function open({fromHistory=false,pageIndex=answerPageIndex}={}){
    if(opened||!isPagedNote||phone.dataset.view!=='note'||!askOverlay.hidden)return;
    resetPagedReader();
    returnFocus=document.activeElement;returnTop=note.scrollTop;
    pages.replaceChildren();slides=[...pageTrack.children].map(makeSlide);
    if(!slides.length)return;
    index=Math.max(0,Math.min(slides.length-1,pageIndex));
    opened=true;closing=false;viewer.hidden=false;viewer.inert=false;
    background=[...phone.children,$('.workspace-header'),$('.demo-guide')]
      .filter(element=>element!==viewer).map(element=>({element,inert:element.inert}));
    background.forEach(({element})=>element.inert=true);
    layout();
    if(!fromHistory)history.pushState({...history.state,noteImageViewer:true,noteImageIndex:index},'');
    if(smooth!=='auto')entryAnimation=viewer.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'});
    closeButton.focus({preventScroll:true});
  }
  function finishClose(){
    if(!opened)return;
    opened=false;closing=false;drag=null;cancelAnimationFrame(scrollFrame);entryAnimation?.cancel();
    viewer.hidden=true;pages.classList.remove('dragging');
    background.forEach(({element,inert})=>element.inert=inert);background=[];
    // Match Xiaohongshu's return path: keep the picture selected in the viewer.
    selectAnswerPage(index,false);note.scrollTop=returnTop;
    pages.replaceChildren();slides=[];
    if(returnFocus?.isConnected&&!returnFocus.closest('[inert]'))returnFocus.focus({preventScroll:true});
  }
  function close(){
    if(!opened||closing)return;
    closing=true;
    if(history.state?.noteImageViewer)history.back();else finishClose();
  }
  function handleHistory(state){
    if(state?.demoView==='note'&&state.noteMode==='paged'&&state.noteImageViewer){
      if(!opened)open({fromHistory:true,pageIndex:state.noteImageIndex??answerPageIndex});
      return opened;
    }
    if(opened){finishClose();return state?.demoView==='note'&&state.noteMode==='paged'}
    return false;
  }
  closeButton.addEventListener('click',close);
  pages.addEventListener('scroll',()=>{
    if(!opened||!pages.clientWidth)return;
    cancelAnimationFrame(scrollFrame);
    scrollFrame=requestAnimationFrame(()=>{
      index=Math.max(0,Math.min(slides.length-1,Math.round(pages.scrollLeft/pages.clientWidth)));updateCount();
    });
  },{passive:true});
  // Touch uses native horizontal snapping. Mouse dragging offers the same gesture.
  pages.addEventListener('pointerdown',event=>{
    if(!opened||event.pointerType!=='mouse'||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,left:pages.scrollLeft,index,scale:phone.getBoundingClientRect().width/phone.offsetWidth||1,moved:false};
  });
  pages.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const delta=(event.clientX-drag.x)/drag.scale;
    if(!drag.moved){if(Math.abs(delta)<7)return;drag.moved=true;pages.setPointerCapture(event.pointerId);pages.classList.add('dragging')}
    event.preventDefault();pages.scrollLeft=drag.left-delta;
  },{passive:false});
  function finishDrag(event,cancelled=false){
    const gesture=drag;if(!gesture||gesture.id!==event.pointerId)return;drag=null;
    if(pages.hasPointerCapture(event.pointerId))pages.releasePointerCapture(event.pointerId);
    pages.classList.remove('dragging');
    if(!gesture.moved)return;
    const delta=(event.clientX-gesture.x)/gesture.scale;
    const next=!cancelled&&Math.abs(delta)>pages.clientWidth*.12?gesture.index+(delta<0?1:-1):Math.round(pages.scrollLeft/pages.clientWidth);
    selectPage(next,true);
  }
  pages.addEventListener('pointerup',event=>finishDrag(event));
  pages.addEventListener('pointercancel',event=>finishDrag(event,true));
  viewer.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return}
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();selectPage(event.key==='Home'?0:event.key==='End'?slides.length-1:index+(event.key==='ArrowRight'?1:-1),true);
    }else if(event.key==='Tab'){
      event.preventDefault();(document.activeElement===closeButton?pages:closeButton).focus({preventScroll:true});
    }
  });
  new ResizeObserver(layout).observe(viewer);
  window.noteImageViewer=Object.freeze({open,close,handleHistory,get active(){return opened}});
})();
