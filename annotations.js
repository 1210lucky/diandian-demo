// Review annotations live outside the note cards and never intercept interactions.
(() => {
  const phone = document.querySelector('.phone');
  const feed = document.querySelector('#feedPage');
  const scroll = document.querySelector('#feedScroll');
  const layer = document.createElement('div');
  layer.className = 'scheme-annotations';
  layer.setAttribute('aria-hidden', 'true');
  const entries = ['feedTarget', 'feedPagedTarget', 'feedPosterTarget'].map((id, i) => {
    const item = document.createElement('div');
    item.className = 'scheme-annotation';
    item.innerHTML = `<svg><path/><circle r="2"/></svg><span class="scheme-callout">方案${i + 1}</span>`;
    layer.append(item);
    return {card: document.getElementById(id), item, label: item.querySelector('.scheme-callout'), path: item.querySelector('path'), dot: item.querySelector('circle')};
  });
  document.body.append(layer);
  let pending = false;
  function update() {
    pending = false;
    layer.hidden = phone.dataset.view !== 'feed' || feed.hidden;
    if (layer.hidden) return;
    const frame = phone.getBoundingClientRect();
    const clip = scroll.getBoundingClientRect();
    const outside = frame.left >= 82 && innerWidth - frame.right >= 82;
    layer.hidden = !outside;
    if (!outside) return;
    entries.forEach(({card, item, label, path, dot}, i) => {
      const r = card.querySelector('.feed-cover').getBoundingClientRect();
      const top = Math.max(r.top, clip.top, 0);
      const bottom = Math.min(r.bottom, clip.bottom, innerHeight);
      item.hidden = bottom - top < 64;
      if (item.hidden) return;
      const y = (top + bottom) / 2;
      const x = i ? frame.right + 11 : frame.left - 11;
      const lx = i ? frame.right + 34 : frame.left - 76;
      const ly = y - 9;
      label.style.left = `${lx}px`;
      label.style.top = `${ly}px`;
      const w = 42;
      const h = 18;
      const startX = i ? lx - 4 : lx + w + 4;
      const startY = ly + h / 2;
      path.setAttribute('d', `M ${startX} ${startY} H ${x} V ${y}`);
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
    });
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
  scroll.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(phone);
  new MutationObserver(schedule).observe(phone, {attributes:true,attributeFilter:['data-view']});
  update();
})();
