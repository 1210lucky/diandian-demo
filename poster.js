// A third, isolated entry: Figma cover → full Dots reader → existing query flow.
(() => {
  const phone=$('.phone'),coverTemplate=$('#posterCoverTemplate'),messagesTemplate=$('#posterMessagesTemplate');
  const shared=$('#sharedMessages'),originalMessages=[...shared.childNodes];
  const queryButtons=[...$('#recommendedQueries').querySelectorAll('button')];
  const originalQueries=queryButtons.map(button=>button.dataset.query);
  const suzhouQueries=['还有什么小众玩法？','帮我安排一条苏州美食路线','带爸妈去苏州，怎么安排更轻松？'];
  let active=false;

  // Keep one source for the cover excerpt and its full conversation.
  document.querySelectorAll('[data-poster-cover]').forEach(frame=>{
    frame.append(coverTemplate.content.cloneNode(true));
    frame.querySelector('.suzhou-preview').append(messagesTemplate.content.cloneNode(true));
  });
  function layoutCover(frame){
    const width=frame.clientWidth,height=frame.clientHeight;
    if(!width||!height)return;
    const art=frame.querySelector('.suzhou-art'),scale=width/393;
    art.style.transform=`scale(${scale})`;
    // Feed stays exactly 3:4. Detail keeps the cover's geometry while revealing
    // more of the same phone/conversation on taller screens, without stretching text.
    art.style.height=`${height/scale}px`;
  }
  const observer=new ResizeObserver(entries=>entries.forEach(({target})=>layoutCover(target)));
  document.querySelectorAll('[data-poster-cover]').forEach(frame=>observer.observe(frame));

  function setActive(enabled){
    if(active===enabled)return;
    active=enabled;phone.classList.toggle('poster-mode',enabled);$('#posterNote').hidden=!enabled;
    if(enabled){
      shared.replaceChildren(messagesTemplate.content.cloneNode(true));
      shared.querySelector('.dots-response').append(answer.querySelector('.answer-actions').cloneNode(true));
    }else shared.replaceChildren(...originalMessages);
    queryButtons.forEach((button,index)=>{
      const text=(enabled?suzhouQueries:originalQueries)[index];
      button.dataset.query=text;button.firstElementChild.textContent=text;
    });
    $('#conversationScroll').scrollTop=0;
    if(enabled)layoutCover($('#posterDetailCover'));
  }
  function source(){
    const element=$('#posterDetailCover'),frame=element.getBoundingClientRect();
    const device=element.querySelector('.suzhou-device').getBoundingClientRect();
    const rect={left:device.left,top:device.top,width:device.width,height:Math.min(frame.bottom,device.bottom)-device.top};
    // Grow the phone shown on the cover into the reader; preserve the cover's
    // scaled canvas in the snapshot so its text does not jump during the morph.
    return {element,rect,snapshot:demoMotion.capture(element,{surface:'card',clipRect:rect})};
  }
  $('#posterViewConversation').addEventListener('click',()=>{
    $('#conversationScroll').scrollTop=0;
    openAsk(true,{reading:true});
  });
  window.posterExperience={get active(){return active},setActive,source};
})();
