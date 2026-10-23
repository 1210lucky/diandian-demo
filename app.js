const $=s=>document.querySelector(s);
const imageNoteNavigationEnabled=window.demoFeatures?.imageNoteNavigation===true;
// Apply before cloning the answer into the full-screen conversation.
document.querySelectorAll('[data-source-note]').forEach(button=>{
  button.disabled=!imageNoteNavigationEnabled;
  if(!imageNoteNavigationEnabled)button.setAttribute('aria-label',button.querySelector('img').alt);
});
// Track the actual input method: programmatic focus on iOS can match :focus-visible after a tap.
function usePointerFocus(){document.documentElement.dataset.inputModality='pointer'}
document.addEventListener('pointerdown',usePointerFocus,{capture:true,passive:true});
document.addEventListener('touchstart',usePointerFocus,{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(!e.metaKey&&!e.ctrlKey&&!e.altKey)document.documentElement.dataset.inputModality='keyboard'},true);
const answer=$('#answerScroll'),note=$('#noteScroll'),sections=[...document.querySelectorAll('[data-reading-title]')];
const smooth=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
let currentSection=0,toastTimer,comments=2;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2300)}
function updateProgress(){if($('.phone').dataset.view==='feed'){$('#guideState').textContent='点击对应封面，开始体验';return}if(window.posterExperience?.active){$('#guideState').textContent='方案3 · 全屏对话';return}if(window.pagedReadingPosition){$('#guideState').textContent='左右翻页 · '+$('#answerPageCount').textContent;return}const max=answer.scrollHeight-answer.clientHeight;const progress=max>0?Math.min(100,Math.max(0,Math.round(answer.scrollTop/max*100))):100;let title='原问题';const top=answer.getBoundingClientRect().top;sections.forEach(s=>{if(s.getBoundingClientRect().top<=top+75)title=s.dataset.readingTitle});$('#guideState').textContent=progress===0?'等待开始阅读':progress>=99?'已读完 · 100%':'正在阅读 · '+title+' · '+progress+'%'}
answer.addEventListener('scroll',updateProgress,{passive:true});new ResizeObserver(updateProgress).observe(answer);
function jumpTo(el){const scale=answer.getBoundingClientRect().height/answer.offsetHeight;answer.scrollTo({top:answer.scrollTop+(el.getBoundingClientRect().top-answer.getBoundingClientRect().top)/scale,behavior:smooth})}
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>jumpTo(document.getElementById(b.dataset.jump))));
$('#reset').addEventListener('click',()=>resetExperience());
$('#back').addEventListener('click',()=>returnToFeed());
$('#follow').addEventListener('click',e=>{const on=e.currentTarget.classList.toggle('followed');e.currentTarget.textContent=on?'已关注':'关注';toast(on?'已关注（演示）':'已取消关注（演示）')});
for(const [id,base] of [['like',65],['collect',46]])$('#'+id).addEventListener('click',e=>{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.querySelector('span').textContent=base+Number(on)});
function scrollNoteTo(el){note.scrollTo({top:el.offsetTop-note.offsetTop,behavior:smooth})}
$('#commentLink').addEventListener('click',()=>scrollNoteTo($('#comments')));
$('#share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('原型链接已复制')}catch{toast('可复制浏览器地址分享这个原型')}});
const askOverlay=$('#askOverlay'),askSheet=$('#askSheet'),questionInput=$('#questionInput');
const demoKeyboardMedia=matchMedia('(any-pointer: coarse), (max-width: 480px)');
function configureDemoInput(){questionInput.readOnly=demoKeyboardMedia.matches;questionInput.inputMode=demoKeyboardMedia.matches?'none':'text'}
configureDemoInput();demoKeyboardMedia.addEventListener('change',configureDemoInput);
const suggestions=[
 ['6个人怎么包车','我们6个人暑假走这条伊犁环线，包车还是自驾更合适？车型、行李空间和费用怎么安排？'],
 ['人均5000怎么安排','沿用这份10天伊犁环线计划，如果人均预算控制在5000元，交通、住宿、餐饮和门票分别怎么分配？'],
 ['10天会不会太赶','这条伊犁环线安排10天会不会太赶？帮我们6个人拆成每天的行程，尽量少赶路。'],
 ['每晚住哪更顺路','按这条伊犁环线，10天里每晚住在哪个城市或景区附近更顺路？我们6个人怎么订房合适？'],
 ['独库没开怎么绕行','如果出发时独库公路没有开放，这份10天伊犁环线应该怎么改，才能顺路返回乌鲁木齐？']
];
function syncQuestion(){ const hasText=!!questionInput.value.trim();$('#sendAsk').disabled=!hasText;askSheet.classList.toggle('has-draft',hasText);$('#askFeedback').textContent=''; }
for(const [label] of suggestions){const button=document.createElement('button');button.type='button';button.className='sheet-suggestion';button.disabled=true;button.append(document.createTextNode(label));const icon=document.createElement('img');icon.src='assets/sheet-sug-arrow.svg';icon.alt='';button.append(icon);$('#askSuggestions').append(button)}
let previousFocus,inertElements=[],closeTimer,conversationMode=false;
// Match content anchors rather than scroll percentages, which change when text reflows.
const readingBlocks=[...answer.querySelectorAll('.user-message p,.dots-intro p,.response-status,.dots-markdown h4,.dots-markdown p,.dots-media-image,.answer-actions')];
readingBlocks.forEach((el,index)=>el.dataset.readingAnchor=String(index));
function textPointAtTop(element,top){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,total=0;
  while(node=walker.nextNode()){
    if(!node.length)continue;
    const range=document.createRange();range.selectNodeContents(node);
    if(range.getBoundingClientRect().bottom<=top+1){total+=node.length;continue}
    let low=0,high=node.length-1;
    while(low<high){const mid=Math.floor((low+high)/2);range.setStart(node,mid);range.setEnd(node,mid+1);if(range.getBoundingClientRect().bottom>top+1)high=mid;else low=mid+1}
    range.setStart(node,low);range.setEnd(node,low+1);
    return {index:total+low,top:range.getBoundingClientRect().top};
  }
  return null;
}
function textPointAtIndex(element,index){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){if(index>=node.length){index-=node.length;continue}const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+1);return range.getBoundingClientRect()}
  return null;
}
function captureReadingPosition(){
  if(window.pagedReadingPosition)return window.pagedReadingPosition();
  const viewport=answer.getBoundingClientRect(),noteViewport=note.getBoundingClientRect();
  const scale=viewport.height/answer.offsetHeight||1;
  const clippedTop=Math.max(viewport.top,noteViewport.top);
  const top=clippedTop<Math.min(viewport.bottom-76*scale,noteViewport.bottom)?clippedTop:viewport.top;
  const element=readingBlocks.find(el=>el.getBoundingClientRect().bottom>top+1)||readingBlocks.at(-1);
  const rect=element.getBoundingClientRect();
  const text=element.matches('p,h4')?textPointAtTop(element,top):null;
  return {anchor:element.dataset.readingAnchor,textIndex:text?.index,lineOffset:text?(top-text.top)/scale:0,offset:(top-rect.top)/scale,ratio:Math.max(0,Math.min(1,(top-rect.top)/rect.height))};
}
function restoreReadingPosition(position){
  const scroller=$('#conversationScroll'),element=$('#sharedMessages [data-reading-anchor="'+position.anchor+'"]');if(!element)return;
  const viewport=scroller.getBoundingClientRect(),scale=viewport.height/scroller.offsetHeight||1;
  const rect=element.getBoundingClientRect();
  const text=position.textIndex!==undefined?textPointAtIndex(element,position.textIndex):null;
  const offset=text?(text.top-viewport.top)/scale+position.lineOffset:(rect.top-viewport.top)/scale+(position.offset<0?position.offset:position.ratio*rect.height/scale);
  const target=scroller.scrollTop+offset;
  scroller.scrollTop=target;
}
// Copy only the publicly shared question and answer; keep the note itself in place.
for(const original of [...answer.children].filter(el=>!el.matches('.ai-header,.card-caption'))){const copy=original.cloneNode(true);copy.removeAttribute('id');copy.removeAttribute('data-reading-title');copy.querySelectorAll('[id],[data-reading-title]').forEach(el=>{el.removeAttribute('id');el.removeAttribute('data-reading-title')});if(copy.classList.contains('user-message')){copy.id='sharedQuery';copy.tabIndex=-1}$('#sharedMessages').append(copy)}
let conversationPositionToken=0;
function setConversationMode(full,position='bottom'){
  const token=++conversationPositionToken;
  askSheet.classList.remove('recommendation-mode','query-mode');$('#recommendedQueries').hidden=true;$('#followupMessages').replaceChildren();
  const reading=full&&typeof position==='object'&&position.reading===true;
  conversationMode=full;askSheet.classList.toggle('conversation-mode',full);askSheet.classList.toggle('reading-mode',reading);askSheet.classList.remove('keyboard-open');
  askSheet.classList.toggle('vertical-reading',reading&&!window.pagedReadingPosition);
  $('#sharedConversation').hidden=!full&&!reading;$('#newTopic').hidden=!full||position!=='bottom';$('#expandAsk').hidden=full||reading;$('#readerFooter').hidden=!reading;
  $('#closeAsk').setAttribute('aria-label',reading?'关闭完整对话':full?'返回小红书笔记':'关闭问点点');
  const closeIcon=$('#closeAsk img'),titleIcon=$('#sheetTitle img');
  closeIcon.src=reading?'assets/reader-close.svg':full?'assets/back.svg':'assets/sheet-close.svg';closeIcon.width=closeIcon.height=reading?20:22;
  titleIcon.src='assets/sheet-logo.svg';titleIcon.width=titleIcon.height=24;
  $('#askFeedback').textContent='';$('#conversationScroll').style.paddingBottom='';
  const place=()=>{if(token!==conversationPositionToken)return;const scroller=$('#conversationScroll');if(full&&typeof position==='object')restoreReadingPosition(position);else scroller.scrollTop=full&&position==='bottom'?scroller.scrollHeight:0};
  place();if(full)requestAnimationFrame(place);
}
let conversationEntryAnimation,conversationEntryToken=0,personalScrollFrame=0;
function captureNoteChrome(){
  const phone=$('.phone'),frame=phone.getBoundingClientRect();
  const card=window.posterExperience?.active?$('#posterNote'):$('.ai-card');
  const cardRect=card.getBoundingClientRect(),viewport=note.getBoundingClientRect();
  const footer=card.querySelector('footer').getBoundingClientRect();
  return {noteSnapshot:demoMotion.capture([phone.querySelector(':scope > .note-header'),note,phone.querySelector(':scope > .engage-bar')],{surface:'phone'}),top:Math.max(frame.top,viewport.top,cardRect.top),bottom:Math.max(viewport.top,Math.min(footer.top,viewport.bottom))};
}
function cancelConversationTransition(){
  ++conversationEntryToken;++conversationPositionToken;cancelAnimationFrame(personalScrollFrame);
  conversationEntryAnimation?.cancel();conversationEntryAnimation=null;
  askOverlay.style.visibility='';
}
function enterFullConversation(position='bottom',origin){
  const chrome=origin||captureNoteChrome();
  cancelConversationTransition();const token=conversationEntryToken;
  questionInput.blur();askOverlay.style.visibility='hidden';
  setConversationMode(true,position);askOverlay.classList.add('is-open');
  // The position callback queued by setConversationMode runs first, at the final layout size.
  requestAnimationFrame(()=>{
    if(token!==conversationEntryToken||askOverlay.hidden)return;
    conversationEntryAnimation=demoMotion.revealConversation({
      ...chrome,readerSnapshot:demoMotion.capture(askSheet,{surface:'conversation'}),
      onFinish:()=>{if(token!==conversationEntryToken)return;askOverlay.style.visibility='';$('#closeAsk').focus({preventScroll:true})}
    });
  });
}
function openAsk(full=false,position='bottom'){
  clearTimeout(closeTimer);previousFocus=document.activeElement;
  const origin=full?captureNoteChrome():null;
  askOverlay.hidden=false;
  inertElements=[...$('.phone').children].filter(el=>el!==askOverlay&&!el.inert);
  inertElements.push($('.workspace-header'),$('.demo-guide'));inertElements.forEach(el=>el.inert=true);
  if(full){enterFullConversation(position,origin);return}
  cancelConversationTransition();setConversationMode(false,position);const token=conversationEntryToken;
  requestAnimationFrame(()=>{if(token!==conversationEntryToken||askOverlay.hidden)return;askOverlay.classList.add('is-open');$('#closeAsk').focus({preventScroll:true})});
}
function closeAsk(){
  if(askSheet.classList.contains('recommendation-mode')||askSheet.classList.contains('query-mode')){returnToReader();return}
  clearTimeout(closeTimer);cancelConversationTransition();const token=conversationEntryToken;
  questionInput.blur();
  const finish=()=>{
    if(token!==conversationEntryToken)return;
    finishAskClose();
  };
  if(conversationMode){
    const chrome=captureNoteChrome(),readerSnapshot=demoMotion.capture(askSheet,{surface:'conversation'});
    askOverlay.style.visibility='hidden';
    conversationEntryAnimation=demoMotion.revealConversation({...chrome,readerSnapshot,reverse:true,onFinish:finish});
  }else{askOverlay.classList.remove('is-open');closeTimer=setTimeout(finish,smooth==='auto'?0:240)}
}
function finishAskClose(){
  askOverlay.hidden=true;askOverlay.style.visibility='';askOverlay.classList.remove('is-open');setConversationMode(false);
  inertElements.forEach(el=>el.inert=false);inertElements=[];previousFocus?.focus({preventScroll:true});
}
$('#viewConversation').addEventListener('click',()=>openAsk(true,{...captureReadingPosition(),reading:true}));
let readerReturnScroll=0;
function returnToReader(){
  cancelConversationTransition();
  questionInput.blur();setConversationMode(true,{reading:true});
  $('#conversationScroll').scrollTop=readerReturnScroll;
  $('#askAlso').focus({preventScroll:true});
}
function openRecommendedQueries(){
  readerReturnScroll=$('#conversationScroll').scrollTop;
  const fromSnapshot=demoMotion.capture(askSheet,{surface:'conversation'});
  cancelConversationTransition();const token=conversationEntryToken;
  questionInput.blur();askOverlay.style.visibility='hidden';
  askSheet.classList.remove('reading-mode','query-mode','keyboard-open');
  askSheet.classList.add('recommendation-mode');
  $('#readerFooter').hidden=true;$('#recommendedQueries').hidden=false;$('#newTopic').hidden=false;
  $('#closeAsk').setAttribute('aria-label','返回完整对话');
  $('#closeAsk img').src='assets/back.svg';
  questionInput.value='';syncQuestion();
  const scroller=$('#conversationScroll');
  const target=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
  const start=Math.max(0,target-100);
  scroller.scrollTop=start;
  conversationEntryAnimation=demoMotion.continueConversation({fromSnapshot,toSnapshot:demoMotion.capture(askSheet,{surface:'conversation'}),onFinish:()=>{
    if(token!==conversationEntryToken)return;
    askOverlay.style.visibility='';$('#closeAsk').focus({preventScroll:true});
    if(smooth==='auto'){scroller.scrollTop=target;return}
    const began=performance.now();
    const settle=now=>{
      if(token!==conversationEntryToken)return;
      const progress=Math.min(1,(now-began)/420);
      scroller.scrollTop=start+(target-start)*(1-Math.pow(1-progress,3));
      if(progress<1)personalScrollFrame=requestAnimationFrame(settle);
    };
    personalScrollFrame=requestAnimationFrame(settle);
  }});
}
function chooseRecommendedQuery(text){
  cancelConversationTransition();
  askSheet.classList.remove('recommendation-mode','keyboard-open');askSheet.classList.add('query-mode');
  $('#recommendedQueries').hidden=true;$('#sharedConversation').hidden=true;$('#newTopic').hidden=true;
  $('#closeAsk img').src='assets/query-back.svg';$('#closeAsk img').width=$('#closeAsk img').height=24;
  $('#sheetTitle img').src='assets/query-logo.svg';
  const bubble=document.createElement('div');bubble.className='dots-message user-message';
  const paragraph=document.createElement('p');paragraph.textContent=text;bubble.append(paragraph);
  $('#followupMessages').replaceChildren(bubble);$('#conversationScroll').scrollTop=0;
  questionInput.value='';syncQuestion();questionInput.blur();
}
$('#recommendedQueries').addEventListener('click',event=>{const button=event.target.closest('button');if(button)chooseRecommendedQuery(button.dataset.query)});
$('#askAlso').addEventListener('click',openRecommendedQueries);
$('#closeAsk').addEventListener('click',closeAsk);$('#askScrim').addEventListener('click',closeAsk);
$('#expandAsk').addEventListener('click',()=>enterFullConversation('bottom'));
questionInput.addEventListener('focus',()=>{
  if(!conversationMode)return;
  const scroller=$('#conversationScroll'),atBottom=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<2;
  askSheet.classList.add('keyboard-open');
  if(atBottom)scroller.scrollTo({top:scroller.scrollHeight,behavior:smooth});
});
$('#conversationScroll').addEventListener('pointerdown',()=>{cancelAnimationFrame(personalScrollFrame);if(conversationMode){questionInput.blur();askSheet.classList.remove('keyboard-open')}});
questionInput.addEventListener('input',syncQuestion);
$('#askForm').addEventListener('submit',e=>{e.preventDefault();if(askSheet.classList.contains('recommendation-mode')&&questionInput.value.trim()){chooseRecommendedQuery(questionInput.value.trim());return}$('#askFeedback').textContent=questionInput.value.trim()?'当前为交互演示，尚未接入 AI。问题已保留，可以继续修改。':'先写下你想问的问题。';if(conversationMode){questionInput.blur();askSheet.classList.remove('keyboard-open');$('#askFeedback').scrollIntoView({block:'nearest',behavior:smooth})}});
for(const id of ['askVoice','askCamera','askAdd'])$('#'+id).addEventListener('click',()=>{$('#askFeedback').textContent='当前演示支持文字追问，可以点选上方推荐问题。'});
askSheet.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeAsk()}if(e.key==='Tab'){const focusable=[...askSheet.querySelectorAll('button:not(:disabled),input')].filter(el=>el.getClientRects().length&&el.tabIndex>=0&&!el.closest('[inert]'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
// The demo keyboard also handles touch input without opening the system keyboard.
let shifted=false,numberMode=false,emojiMode=false;
function typeKey(key){questionInput.focus({preventScroll:true});let start=questionInput.selectionStart,end=questionInput.selectionEnd;if(key==='backspace'){if(start===end){const before=[...questionInput.value.slice(0,start)];start-=before.at(-1)?.length||0}questionInput.setRangeText('',start,end,'end')}else if(key==='send'){$('#askForm').requestSubmit();return}else if(key==='shift'){shifted=!shifted;renderKeyboard();return}else if(key==='mode'){numberMode=emojiMode?false:!numberMode;emojiMode=false;renderKeyboard();return}else{const value=key==='space'?' ':shifted&&!numberMode&&!emojiMode?key.toUpperCase():key;if(questionInput.value.length-(end-start)+value.length<=200)questionInput.setRangeText(value,start,end,'end')}syncQuestion()}
function makeKey(key,label=key,extra=''){const b=document.createElement('button');b.type='button';b.tabIndex=-1;b.className='keyboard-key '+extra;b.textContent=label;b.setAttribute('aria-label',key==='backspace'?'删除':key==='shift'?'切换大小写':key==='space'?'空格':key==='send'?'键盘发送追问':key==='mode'?(numberMode||emojiMode?'切换字母键盘':'切换数字键盘'):label);if(key==='shift')b.setAttribute('aria-pressed',String(shifted));b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>typeKey(key));return b}
function renderKeyboard(){const root=$('#keyboardKeys');root.replaceChildren();const rows=emojiMode?[['😊','😂','🥰','😎','🤔','👍','❤️','✨','🎉','🙌'],['🏔️','🌿','🌞','🌧️','🌈','🚗','✈️','📷','🏕️'],['🍉','☕','🧳','📍','💚','👏','🙏']]:numberMode?['1234567890'.split(''),['-','/',':',';','(',')','¥','&','@'],['.',',','?','!','"',"'",'%']]:['qwertyuiop','asdfghjkl','zxcvbnm'].map(row=>[...row]);rows.forEach((keys,i)=>{const row=document.createElement('div');row.className='keyboard-row '+(['','middle','lower'][i]);let target=row;if(i===2){row.append(makeKey('shift','⇧','special'));target=document.createElement('div');target.className='keyboard-letter-group';row.append(target)}keys.forEach(key=>target.append(makeKey(key,shifted&&!numberMode&&!emojiMode?key.toUpperCase():key)));if(i===2)row.append(makeKey('backspace','⌫','special'));root.append(row)});const actions=document.createElement('div');actions.className='keyboard-row actions';actions.append(makeKey('mode',numberMode||emojiMode?'ABC':'123','mode'),makeKey('space','空格','space'),makeKey('send','发送','send'));root.append(actions)}
[...'我你这不是小那好'].forEach(key=>{const b=makeKey(key);b.className='';$('#keyboardCandidates').append(b)});
const more=document.createElement('button');more.type='button';more.tabIndex=-1;more.className='keyboard-more';more.setAttribute('aria-label','切换候选词');more.innerHTML='<img src="assets/keyboard-chevron.svg" alt="" width="18" height="18">';more.addEventListener('click',()=>{const choices=more.dataset.more?[...'我你这不是小那好']:[...'的了在有和就都吗'];more.dataset.more=more.dataset.more?'':'1';$('#keyboardCandidates').querySelectorAll('button:not(.keyboard-more)').forEach((b,i)=>{b.replaceWith(Object.assign(makeKey(choices[i]),{className:''}))})});$('#keyboardCandidates').append(more);
$('#keyboardEmoji').addEventListener('click',()=>{emojiMode=!emojiMode;numberMode=false;shifted=false;renderKeyboard()});$('#keyboardMic').addEventListener('click',()=>{$('#askFeedback').textContent='当前演示支持文字追问，可以点选上方推荐问题。'});renderKeyboard();
const sourceNotes=sourceNoteData.map(note=>({...note,liked:false,collected:false,followed:false,comments:[]}));
const sourceNote=$('#sourceNote');let activeSource=0,sourceImageIndex=0,sourceReturnFocus,sourceBackground=[],sourceWasInert=false,sourceAnimation,sourceToastTimer;
function showSourceToast(text){$('#sourceToast').textContent=text;$('#sourceToast').classList.add('visible');clearTimeout(sourceToastTimer);sourceToastTimer=setTimeout(()=>$('#sourceToast').classList.remove('visible'),2000)}
function renderSourceActions(){const data=sourceNotes[activeSource];for(const [id,key] of [['sourceLike','liked'],['sourceCollect','collected']]){const button=$('#'+id);button.setAttribute('aria-pressed',String(data[key]));button.querySelector('span').textContent=data.stats[key==='liked'?0:1]+Number(data[key])}$('#sourceFollow').textContent=data.followed?'已关注':'关注';$('#sourceFollow').classList.toggle('followed',data.followed);$('#sourceCommentCount').textContent=data.stats[2]+data.comments.length;$('#sourceCommentTotal').textContent=data.stats[2]+data.comments.length;$('#sourceCommentList').replaceChildren();for(const text of data.comments){const el=document.createElement('div');el.className='comment';const avatar=document.createElement('span');avatar.className='letter-avatar';avatar.textContent='我';const body=document.createElement('div');const name=document.createElement('span');name.textContent='我';const paragraph=document.createElement('p');paragraph.textContent=text;body.append(name,paragraph);el.append(avatar,body);$('#sourceCommentList').append(el)}}
function openSourceNote(index,trigger){if(!imageNoteNavigationEnabled)return;const data=sourceNotes[index];if(!data)return;activeSource=index;sourceReturnFocus=trigger;sourceWasInert=sourceNote.inert;sourceNote.inert=false;sourceBackground=[...$('.phone').children,$('.workspace-header'),$('.demo-guide')].filter(el=>el!==sourceNote&&!el.inert);sourceBackground.forEach(el=>el.inert=true);sourceImageIndex=0;renderSourceImage();$('#sourceAvatar').src=data.avatar;$('#sourceAuthor').textContent=data.author;$('#sourceDate').textContent=data.date;$('#sourceOriginal').href=data.url;$('#sourceCommentsOriginal').href=data.url;$('#sourceTitle').textContent=data.title;$('#sourceDescription').textContent=data.description;$('#sourceTags').textContent=data.tags;$('#sourceCommentForm').hidden=true;$('#sourceCommentInput').value='';$('#sourceToast').classList.remove('visible');renderSourceActions();sourceNote.hidden=false;$('#sourceScroll').scrollTop=0;sourceAnimation?.cancel();if(smooth!=='auto')sourceAnimation=sourceNote.animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});$('#sourceBack').focus({preventScroll:true})}
function closeSourceNote(){sourceAnimation?.cancel();const finish=()=>{sourceNote.hidden=true;sourceBackground.forEach(el=>el.inert=false);sourceBackground=[];sourceNote.inert=sourceWasInert;sourceReturnFocus?.focus({preventScroll:true})};if(smooth==='auto'){finish();return}sourceAnimation=sourceNote.animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:240,easing:'cubic-bezier(.4,0,.8,.2)',fill:'forwards'});sourceAnimation.onfinish=finish}
document.addEventListener('click',e=>{const trigger=e.target.closest('[data-source-note]');if(trigger)openSourceNote(Number(trigger.dataset.sourceNote),trigger)});
function renderSourceImage(){const data=sourceNotes[activeSource];$('#sourceImage').src=data.images[sourceImageIndex];$('#sourceImage').alt=data.title+' · 第'+(sourceImageIndex+1)+'张';$('#sourceImageCount').textContent=(sourceImageIndex+1)+'/'+data.images.length;$('#sourceImagePrev').disabled=sourceImageIndex===0;$('#sourceImageNext').disabled=sourceImageIndex===data.images.length-1;$('#sourceDots').replaceChildren();data.images.forEach((_,i)=>{const dot=document.createElement('i');dot.className=i===sourceImageIndex?'active':'';$('#sourceDots').append(dot)})}
function moveSourceImage(delta){sourceImageIndex=Math.max(0,Math.min(sourceNotes[activeSource].images.length-1,sourceImageIndex+delta));renderSourceImage()}
$('#sourceImagePrev').addEventListener('click',()=>moveSourceImage(-1));$('#sourceImageNext').addEventListener('click',()=>moveSourceImage(1));
let galleryPointer=null;$('#sourceGallery').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;galleryPointer={x:e.clientX,y:e.clientY};$('#sourceGallery').setPointerCapture(e.pointerId)});$('#sourceGallery').addEventListener('pointerup',e=>{if(!galleryPointer)return;const dx=e.clientX-galleryPointer.x,dy=e.clientY-galleryPointer.y;galleryPointer=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))moveSourceImage(dx<0?1:-1)});$('#sourceGallery').addEventListener('pointercancel',()=>galleryPointer=null);$('#sourceGallery').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();moveSourceImage(e.key==='ArrowRight'?1:-1)}});
$('#sourceBack').addEventListener('click',closeSourceNote);
sourceNote.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSourceNote()}if(e.key==='Tab'){const controls=[...sourceNote.querySelectorAll('button,input,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
for(const [id,key] of [['sourceLike','liked'],['sourceCollect','collected'],['sourceFollow','followed']])$('#'+id).addEventListener('click',()=>{sourceNotes[activeSource][key]=!sourceNotes[activeSource][key];renderSourceActions()});
function showSourceComments(edit=false){$('#sourceCommentForm').hidden=!edit;$('#sourceComments').scrollIntoView({block:'start',behavior:smooth});if(edit)$('#sourceCommentInput').focus({preventScroll:true})}
$('#sourceCommentEntry').addEventListener('click',()=>showSourceComments(true));$('#sourceCommentLink').addEventListener('click',()=>showSourceComments(false));
$('#sourceCommentForm').addEventListener('submit',e=>{e.preventDefault();const text=$('#sourceCommentInput').value.trim();if(!text)return;sourceNotes[activeSource].comments.push(text);$('#sourceCommentInput').value='';renderSourceActions();showSourceToast('评论已添加到本次演示')});
$('#sourceShare').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sourceNotes[activeSource].url);showSourceToast('原笔记链接已复制')}catch{showSourceToast('可通过页面里的原笔记入口分享')}});
$('#commentEntry').addEventListener('click',()=>$('#commentDialog').showModal());
$('#commentForm').addEventListener('submit',e=>{e.preventDefault();const text=$('#commentInput').value.trim();if(!text)return;const c=document.createElement('div');c.className='comment';c.innerHTML='<span class="letter-avatar">我</span><div><span>我</span><p></p><small>刚刚 · 本次演示</small></div>';c.querySelector('p').textContent=text;$('#newComments').append(c);comments++;$('#commentCount').textContent=comments;$('#commentNumber').textContent=comments;$('#commentInput').value='';$('#commentDialog').close();scrollNoteTo($('#comments'));toast('评论已添加到本次演示')});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
updateProgress();
