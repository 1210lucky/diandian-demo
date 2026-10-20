// A second note entry shares the conversation, but paginates its content into cards.
// Text flows across pages; images and other non-text components remain intact.
const pageTrack=$('#answerPages'),pageDots=$('#answerPageDots'),pageCount=$('#answerPageCount');
let isPagedNote=false,answerPageIndex=0,pageBuildSize='';
const noteCopy=$('.note-body>p'),originalNoteCopy=noteCopy.textContent;
const commentCopy=$('#comments .comment p'),originalCommentCopy=commentCopy.textContent;
function pageClone(source){
  const clone=source.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  return clone;
}
function textFragment(element,from,to){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];let n,offset=0;
  while(n=walker.nextNode()){nodes.push({n,start:offset,end:offset+n.length});offset+=n.length}
  const a=nodes.find(x=>x.end>from),b=nodes.find(x=>x.end>=to),range=document.createRange();
  range.setStart(a.n,from-a.start);range.setEnd(b.n,to-b.start);return range.cloneContents();
}
function selectAnswerPage(index,animate=true){
  answerPageIndex=Math.max(0,Math.min(pageTrack.children.length-1,index));
  pageTrack.scrollTo({left:answerPageIndex*pageTrack.clientWidth,behavior:animate?smooth:'instant'});
  refreshAnswerPage();
}
function refreshAnswerPage(){
  const total=pageTrack.children.length;
  pageCount.textContent=(answerPageIndex+1)+'/'+total;
  $('#cleanPageCount').textContent=(answerPageIndex+1)+' / '+total;
  const start=Math.max(0,Math.min(answerPageIndex-2,total-5));
  [...pageDots.children].forEach((button,slot)=>{
    const index=start+slot;
    button.dataset.page=String(index);
    button.setAttribute('aria-label','查看第 '+(index+1)+' 页');
    button.setAttribute('aria-current',String(index===answerPageIndex));
    button.classList.toggle('edge-dot',(slot===0&&start>0)||(slot===4&&index<total-1));
  });
  [...pageTrack.children].forEach((page,i)=>page.inert=i!==answerPageIndex);
  if(isPagedNote&&$('.phone').dataset.view!=='feed')$('#guideState').textContent='左右翻页 · '+(answerPageIndex+1)+' / '+total;
}
function capturePagedPosition(){
  const block=pageTrack.children[answerPageIndex]?.querySelector('[data-reading-anchor]');
  return {anchor:block?.dataset.readingAnchor||'0',textIndex:Number(block?.dataset.textStart||0),lineOffset:0,offset:0,ratio:0};
}
function buildAnswerPages(){
  const width=pageTrack.clientWidth,height=pageTrack.clientHeight;
  if(!width||!height)return;
  const size=width+':'+height;if(pageBuildSize===size&&pageTrack.children.length)return;
  pageBuildSize=size;const previous=answerPageIndex;pageTrack.replaceChildren();pageDots.replaceChildren();
  let page,body,response;
  const newPage=()=>{
    page=document.createElement('section');page.className='answer-page';
    body=document.createElement('div');body.className='answer-page-body';page.append(body);pageTrack.append(page);response=null;
  };
  // Measure rendered boxes, including padding, so desktop CSS zoom cannot shift the cut.
  const fits=()=>{
    const limit=body.getBoundingClientRect().bottom;
    return [...body.children].every(child=>child.getBoundingClientRect().bottom<=limit+.25);
  };
  const responseShell=()=>{
    response=document.createElement('div');response.className='dots-response page-response dots-markdown';body.append(response);return response;
  };
  newPage();body.append(pageClone(answer.querySelector('.ai-header')));
  for(const original of answer.querySelectorAll(':scope>.dots-message')){
    let copy=pageClone(original);body.append(copy);
    if(fits())continue;
    const text=original.querySelector('p').textContent;let start=0;
    while(start<text.length){
      const paragraph=copy.querySelector('p');let low=start,high=text.length;
      while(low<high){const mid=Math.ceil((low+high)/2);paragraph.textContent=text.slice(start,mid);if(fits())low=mid;else high=mid-1}
      if(low===start){copy.remove();newPage();body.append(copy);continue}
      paragraph.textContent=text.slice(start,low);paragraph.dataset.textStart=String(start);
      if(low===text.length)break;
      copy.classList.add('text-continues');start=low;newPage();copy=pageClone(original);copy.classList.add('text-continuation');body.append(copy);
    }
  }
  const originals=[...answer.querySelectorAll('.response-status,.dots-markdown h4,.dots-markdown p,.dots-media-image')];
  // Keep a title/status with the beginning of its paragraph, not the entire paragraph.
  const groups=[];
  for(let i=0;i<originals.length;i++){
    const group=[originals[i]];
    if((originals[i].matches('h4')||originals[i].classList.contains('response-status'))&&originals[i+1]?.matches('p'))group.push(originals[++i]);
    groups.push(group);
  }
  for(const group of groups){
    if(!response)responseShell();
    const wrapper=document.createElement('div');wrapper.className='page-block';group.forEach(el=>wrapper.append(pageClone(el)));response.append(wrapper);
    if(fits())continue;
    // Keep the image group intact. If it only just misses the cut, fit three square
    // thumbnails into the remaining space rather than leaving a large empty tail.
    const images=wrapper.querySelector('.dots-media-image');
    if(images){
      const scale=page.getBoundingClientRect().width/page.offsetWidth||1;
      const overflow=(response.getBoundingClientRect().bottom-body.getBoundingClientRect().bottom)/scale;
      const tile=(images.clientWidth-12)/3-overflow-1;
      if(tile>=72){images.style.width=(tile*3+12)+'px';images.style.marginInline='auto';if(fits())continue;images.style.width='';images.style.marginInline=''}
    }
    if(wrapper.querySelector('p'))flowParagraph(wrapper);
    else moveBlock(wrapper);
  }
  function moveBlock(wrapper){
    wrapper.remove();if(!response.children.length)response.remove();
    else response.classList.add('continues');
    newPage();responseShell();response.classList.add('continuation');response.append(wrapper);
  }
  function flowParagraph(wrapper){
    let paragraph=wrapper.querySelector('p');if(!paragraph)return;
    const original=paragraph.cloneNode(true),base=Number(paragraph.dataset.textStart||0);let start=0;
    const textLength=original.textContent.length;
    const fragment=(from,to)=>textFragment(original,from,to);
    while(start<textLength){
      let low=start,high=textLength;
      while(low<high){const mid=Math.ceil((low+high)/2);paragraph.replaceChildren(fragment(start,mid));if(fits())low=mid;else high=mid-1}
      // If even one complete line cannot fit, carry its heading/status to the next page.
      if(low===start){paragraph.replaceChildren(fragment(start,textLength));moveBlock(wrapper);continue}
      const end=low;
      paragraph.replaceChildren(fragment(start,end));paragraph.dataset.textStart=String(base+start);
      if(end===textLength)break;
      response.classList.add('continues');newPage();responseShell();response.classList.add('continuation');
      wrapper=document.createElement('div');wrapper.className='page-block';response.append(wrapper);
      const next=paragraph.cloneNode(false);wrapper.append(next);paragraph=next;
      start=end;
    }
  }
  const responsePages=[...pageTrack.querySelectorAll('.page-response')];
  responsePages.forEach((el,i)=>{
    el.classList.toggle('continuation',i>0);
    el.classList.toggle('continues',i<responsePages.length-1);
  });
  responsePages.at(-1)?.classList.add('last-response');
  [...pageTrack.children].forEach((slide,i)=>{
    slide.setAttribute('aria-label','对话第 '+(i+1)+' 页');
    if(i<5){
      const dot=document.createElement('button');dot.type='button';
      dot.addEventListener('click',()=>selectAnswerPage(Number(dot.dataset.page)));pageDots.append(dot);
    }
  });
  selectAnswerPage(previous,false);
}
function setNotePagination(enabled){
  resetPagedReader();
  isPagedNote=enabled;$('.ai-card').classList.toggle('paged-note',enabled);
  $('.phone').classList.toggle('paged-mode',enabled);
  if(enabled){measurePagedReader();setPagedCleanState(false)}
  answer.hidden=enabled;pageTrack.hidden=!enabled;pageDots.hidden=!enabled;pageCount.hidden=!enabled;
  noteCopy.textContent=enabled?'和朋友的暑假伊犁环线计划，点点帮我们整理好了，左右滑动上面的卡片查看完整攻略。':originalNoteCopy;
  commentCopy.textContent=enabled?'左右翻页看攻略，好方便！':originalCommentCopy;
  note.scrollTop=0;
  window.pagedReadingPosition=enabled?capturePagedPosition:null;
  if(enabled)buildAnswerPages();
}
pageTrack.addEventListener('scroll',()=>{
  if(!isPagedNote)return;
  answerPageIndex=Math.round(pageTrack.scrollLeft/pageTrack.clientWidth);refreshAnswerPage();
},{passive:true});
pageTrack.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectAnswerPage(e.key==='Home'?0:e.key==='End'?pageTrack.children.length-1:answerPageIndex+(e.key==='ArrowRight'?1:-1))}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();togglePagedReader()}
});
new ResizeObserver(()=>{if(isPagedNote)buildAnswerPages()}).observe(pageTrack);
