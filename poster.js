// Scheme 3: the feed cover opens a full-height static conversation preview, then the Dots reader.
(() => {
  const phone=$('.phone'),coverTemplate=$('#posterCoverTemplate'),coverMessages=$('#posterMessagesTemplate');
  const threadTemplate=$('#suzhouConversationTemplate'),detail=$('#posterDetailPreview');
  const shared=$('#sharedMessages'),originalMessages=[...shared.childNodes];
  const queryButtons=[...$('#recommendedQueries').querySelectorAll('button')];
  const originalQueries=queryButtons.map(button=>button.dataset.query);
  const suzhouQueries=['还有什么小众玩法？','帮我安排一条苏州美食路线','带爸妈去苏州，怎么安排更轻松？'];
  const noteText=[[$('.note-body h2'),'苏州三日游旅行攻略'],[$('.note-body>p'),'点点帮我整理了苏州三天两晚的旅行攻略，路线、景点、美食和住宿都在上面的对话里。'],[$('.note-body .hashtags'),'#有问题问点点 #点点AI #苏州旅游'],[$('#comments .comment p'),'这份苏州行程很实用！'],[$('#comments .comment:nth-of-type(2) p'),'准备收藏，去苏州时用']].map(([element,text])=>({element,text,original:element.textContent}));
  let active=false,gesture=null;

  // All three covers share the scheme 3 layout; their excerpts come from each note.
  const coverCopy={
    xinjiang:{title:['新疆十日游','旅行攻略'],tags:['每日路线','必玩景点','包车建议','预算参考']},
    yili:{title:['伊犁大环线','行程规划'],tags:['环线规划','沿途景点','出行建议','实用提醒']}
  };
  document.querySelectorAll('[data-poster-cover]').forEach(frame=>{
    frame.append(coverTemplate.content.cloneNode(true));
    const variant=frame.dataset.posterCover,copy=coverCopy[variant],preview=frame.querySelector('.suzhou-preview');
    if(!copy){preview.append(coverMessages.content.cloneNode(true));return}
    frame.querySelector('.suzhou-title').replaceChildren(copy.title[0],document.createElement('br'),copy.title[1]);
    const subtitle=frame.querySelector('.suzhou-subtitle'),divider=subtitle.querySelector('img').cloneNode(true);
    subtitle.replaceChildren();
    copy.tags.forEach((text,index)=>{if(index)subtitle.append(divider.cloneNode(true));const tag=document.createElement('span');tag.textContent=text;subtitle.append(tag)});
    if(variant==='xinjiang'){
      const question=answer.querySelector('.user-message').cloneNode(true);
      const intro=document.createElement('div');intro.className='dots-response dots-markdown';
      intro.append(answer.querySelector('.dots-intro p').cloneNode(true));
      preview.append(question,intro);
    }else{
      const response=document.createElement('div');response.className='dots-response';
      const status=answer.querySelector('.response-status').cloneNode(true);
      const markdown=document.createElement('div');markdown.className='dots-markdown';
      const photos=document.createElement('div');photos.className='dots-media-image';
      answer.querySelectorAll('.dots-media-image img').forEach(image=>{const tile=document.createElement('span');tile.className='source-thumbnail';tile.append(image.cloneNode(true));photos.append(tile)});
      markdown.append(answer.querySelector('.dots-markdown>p').cloneNode(true),photos);
      response.append(status,markdown);preview.append(response);
    }
    preview.querySelectorAll('[id],[data-reading-anchor],[data-reading-title]').forEach(el=>{el.removeAttribute('id');el.removeAttribute('data-reading-anchor');el.removeAttribute('data-reading-title')});
  });
  const observer=new ResizeObserver(entries=>entries.forEach(({target:frame})=>{
    if(!frame.clientWidth)return;
    frame.querySelector('.suzhou-art').style.transform=`scale(${frame.clientWidth/393})`;
  }));
  document.querySelectorAll('[data-poster-cover]').forEach(frame=>observer.observe(frame));

  // The clipped preview and full reader share content and reading anchors.
  [...threadTemplate.content.querySelectorAll('p,h4,h5,[data-su-block],.su-actions')].forEach((el,index)=>el.dataset.readingAnchor='suzhou-'+index);
  detail.append(threadTemplate.content.cloneNode(true));
  detail.firstElementChild.setAttribute('aria-hidden','true');
  function setActive(enabled){
    if(active===enabled)return;
    active=enabled;gesture=null;phone.classList.toggle('poster-mode',enabled);$('#posterNote').hidden=!enabled;
    shared.replaceChildren(...(enabled?[threadTemplate.content.cloneNode(true)]:originalMessages));
    noteText.forEach(({element,text,original})=>element.textContent=enabled?text:original);
    queryButtons.forEach((button,index)=>{
      const text=(enabled?suzhouQueries:originalQueries)[index];
      button.dataset.query=text;button.firstElementChild.textContent=text;
    });
    $('#conversationScroll').scrollTop=0;
  }
  function capturePosition(){
    const viewport=detail.getBoundingClientRect(),outer=note.getBoundingClientRect();
    const scale=viewport.width/detail.offsetWidth||1,top=Math.max(viewport.top,outer.top);
    const blocks=[...detail.querySelectorAll('[data-reading-anchor]')];
    const element=blocks.find(el=>el.getBoundingClientRect().bottom>top+1)||blocks.at(-1);
    const rect=element.getBoundingClientRect(),text=element.matches('p,h4,h5')?textPointAtTop(element,top):null;
    return {anchor:element.dataset.readingAnchor,textIndex:text?.index,lineOffset:text?(top-text.top)/scale:0,offset:(top-rect.top)/scale,ratio:Math.max(0,Math.min(1,(top-rect.top)/rect.height))};
  }
  function source(){
    const element=$('#posterNote'),frame=element.getBoundingClientRect(),viewport=note.getBoundingClientRect();
    const top=Math.max(frame.top,viewport.top),bottom=Math.min(frame.bottom,viewport.bottom);
    const rect={left:frame.left,top,width:frame.width,height:Math.max(1,bottom-top)};
    return {element,rect,snapshot:demoMotion.capture(element,{surface:'card',clipRect:rect})};
  }
  $('#posterViewConversation').addEventListener('click',()=>openAsk(true,{...capturePosition(),reading:true}));

  // Touch and wheel use the outer note's native scroll. Mouse dragging does the same.
  note.addEventListener('pointerdown',event=>{
    if(!active||!askOverlay.hidden||event.pointerType!=='mouse'||event.button!==0||event.target.closest('button,a,input'))return;
    gesture={id:event.pointerId,y:event.clientY,moved:false};
  });
  note.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const scale=phone.getBoundingClientRect().width/phone.offsetWidth||1;
    const delta=(gesture.y-event.clientY)/scale;
    if(!gesture.moved){if(Math.abs(delta)<7)return;gesture.moved=true;note.setPointerCapture(event.pointerId)}
    event.preventDefault();gesture.y=event.clientY;
    note.scrollTop+=delta;
  },{passive:false});
  function endGesture(event){
    if(!gesture||gesture.id!==event.pointerId)return;
    gesture=null;if(note.hasPointerCapture(event.pointerId))note.releasePointerCapture(event.pointerId);
  }
  note.addEventListener('pointerup',endGesture);note.addEventListener('pointercancel',endGesture);
  window.posterExperience={get active(){return active},setActive,source};
})();
