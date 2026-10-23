/*
 * Visual-only card expansion; the caller owns navigation, inert state and focus.
 *
 * const fromRect = card.getBoundingClientRect();
 * const fromSnapshot = demoMotion.capture(card, { surface: 'card' });
 * // Set the real destination state and finish its scroll positioning first.
 * const toSnapshot = demoMotion.capture(noteSurfaces, { surface: 'phone' });
 * const animation = demoMotion.transition({
 *   fromRect, toRect: phone.getBoundingClientRect(), fromSnapshot, toSnapshot,
 *   onFinish() { ... }
 * });
 *
 * capture() returns an inert, aria-hidden DOM snapshot. It is not mounted until
 * transition(), when all nested scroll offsets are restored. Snapshot rects and
 * the rect arguments use viewport CSS pixels, including the desktop phone zoom.
 * surface:'phone' captures the phone canvas; card/conversation use element bounds.
 * Optional clipRect (viewport coordinates) crops a partially visible source. Use
 * the same rect as fromRect so its contents keep the correct size and position.
 * cancel(), or the returned animation.cancel(), cleans up without onFinish().
 */
(() => {
  const snapshots = new WeakMap();
  let active = null;

  function phoneMetrics() {
    const phone = document.querySelector('.phone');
    const rect = phone.getBoundingClientRect();
    return { phone, rect, zoom: rect.width / phone.offsetWidth || 1 };
  }

  function copyRect(rect) {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function unionRect(elements) {
    const rects = elements.map(element => element.getBoundingClientRect());
    const left = Math.min(...rects.map(rect => rect.left));
    const top = Math.min(...rects.map(rect => rect.top));
    return {
      left, top,
      width: Math.max(...rects.map(rect => rect.right)) - left,
      height: Math.max(...rects.map(rect => rect.bottom)) - top
    };
  }

  function capture(input, { surface = 'card', clipRect } = {}) {
    const elements = Array.isArray(input) ? input : [input];
    if (!elements.length || elements.some(element => !(element instanceof Element))) {
      throw new TypeError('demoMotion.capture requires an Element or a non-empty Element array.');
    }
    const { phone, rect: phoneRect, zoom } = phoneMetrics();
    const rect = clipRect ? copyRect(clipRect) : surface === 'phone' ? copyRect(phoneRect) : unionRect(elements);
    const width = rect.width / zoom;
    const height = rect.height / zoom;
    const snapshot = document.createElement('div');
    snapshot.inert = true;
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:hidden;box-sizing:border-box;transform-origin:0 0;';
    snapshot.style.width = `${width}px`;
    snapshot.style.height = `${height}px`;
    const background = getComputedStyle(surface === 'phone' ? phone : elements[0]).backgroundColor;
    snapshot.style.backgroundColor = background;
    const scrolls = [];

    elements.forEach(original => {
      const clone = original.cloneNode(true);
      const originalNodes = [original, ...original.querySelectorAll('*')];
      const clonedNodes = [clone, ...clone.querySelectorAll('*')];
      clonedNodes.forEach((node, index) => {
        node.removeAttribute('id');
        node.removeAttribute('tabindex');
        node.removeAttribute('autofocus');
        node.removeAttribute('aria-labelledby');
        node.removeAttribute('aria-describedby');
        node.removeAttribute('aria-controls');
        node.removeAttribute('aria-owns');
        if (node.hasAttribute('contenteditable')) node.setAttribute('contenteditable', 'false');
        const source = originalNodes[index];
        // Preserve hidden state after removing ID-based display:none selectors.
        if (source.hasAttribute('hidden')) node.style.display = 'none';
        if (source.scrollTop || source.scrollLeft) {
          scrolls.push({ node, top: source.scrollTop, left: source.scrollLeft });
        }
        // cloneNode does not preserve the edited value of a textarea/select.
        if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
          node.value = source.value;
        }
      });

      // Freeze root styles: destination roots can depend on .phone > selectors.
      // Descendant classes and their normal layout remain intact inside each root.
      const computed = getComputedStyle(original);
      for (const property of computed) clone.style.setProperty(property, computed.getPropertyValue(property));
      // Keep inherited text fill tied to each descendant's own color. Freezing
      // currentColor as the root's RGB value makes light labels flash dark.
      if (computed.getPropertyValue('-webkit-text-fill-color') === computed.color) {
        clone.style.setProperty('-webkit-text-fill-color', 'currentColor');
      }
      const rootRect = original.getBoundingClientRect();
      Object.assign(clone.style, {
        position: 'absolute', left: `${(rootRect.left - rect.left) / zoom}px`,
        top: `${(rootRect.top - rect.top) / zoom}px`, right: 'auto', bottom: 'auto',
        width: `${rootRect.width / zoom}px`, height: `${rootRect.height / zoom}px`,
        minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none',
        margin: '0', flex: 'none', transform: 'none', transition: 'none',
        animation: 'none', zoom: '1', pointerEvents: 'none', boxSizing: 'border-box',
        visibility: 'visible'
      });
      snapshot.append(clone);
    });

    snapshots.set(snapshot, { rect, width, height, background, scrolls, surface });
    return snapshot;
  }

  function cleanup(run) {
    if (!run || run.done) return;
    run.done = true;
    run.animations.forEach(animation => animation.cancel());
    run.layer?.remove();
    if (active === run) active = null;
  }

  function cancel() { cleanup(active); }

  function transition({ fromRect, toRect, fromSnapshot, toSnapshot, duration = 300, onFinish } = {}) {
    cancel();
    const run = { layer: null, animations: [], done: false };
    const handle = { cancel: () => cleanup(run) };
    active = run;
    const finish = () => {
      if (run.done || active !== run) return;
      cleanup(run);
      onFinish?.();
    };
    const from = snapshots.get(fromSnapshot);
    const to = snapshots.get(toSnapshot);
    if (!from || !to) {
      cleanup(run);
      throw new TypeError('demoMotion.transition requires snapshots created by capture().');
    }
    fromRect = copyRect(fromRect || from.rect);
    toRect = copyRect(toRect || to.rect);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || duration <= 0 ||
        !fromRect.width || !fromRect.height || !toRect.width || !toRect.height) {
      finish();
      return handle;
    }

    const { phone, rect: phoneRect, zoom } = phoneMetrics();
    const local = rect => ({
      left: (rect.left - phoneRect.left) / zoom,
      top: (rect.top - phoneRect.top) / zoom,
      width: rect.width / zoom, height: rect.height / zoom
    });
    const first = local(fromRect), last = local(toRect);
    const scale = first.width / last.width;
    // A uniform scale keeps glyphs/images proportional. The changing clip height
    // reveals the rest of the full page instead of stretching a short card.
    const firstHeight = first.height / scale;
    const canvasHeight = Math.max(firstHeight, last.height);
    const radius = parseFloat(getComputedStyle(phone).borderTopLeftRadius) || 0;
    const expanding = last.width * last.height >= first.width * first.height;
    const firstRadius = expanding ? 12 : radius;
    const lastRadius = expanding ? radius : 12;
    const layer = document.createElement('div');
    layer.inert = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.className = 'demo-motion-layer';
    layer.style.cssText = 'position:absolute;inset:0;z-index:60;pointer-events:none;overflow:hidden;isolation:isolate;';
    const canvas = document.createElement('div');
    canvas.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;overflow:hidden;will-change:transform,clip-path;';
    canvas.style.width = `${last.width}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.backgroundColor = to.background === 'rgba(0, 0, 0, 0)' ? '#fff' : to.background;
    canvas.append(fromSnapshot, toSnapshot);
    fromSnapshot.style.transform = `scale(${last.width / from.width})`;
    toSnapshot.style.transform = `scale(${last.width / to.width})`;
    layer.append(canvas);
    phone.append(layer);
    run.layer = layer;

    // Layout must exist before applying scroll offsets to cloned overflow boxes.
    canvas.getBoundingClientRect();
    [...from.scrolls, ...to.scrolls].forEach(({ node, top, left }) => {
      node.scrollTop = top;
      node.scrollLeft = left;
    });
    const options = { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' };
    run.animations.push(canvas.animate([
      { transform: `translate(${first.left}px,${first.top}px) scale(${scale})`, clipPath: `inset(0px 0px ${canvasHeight - firstHeight}px 0px round ${firstRadius / scale}px)` },
      { transform: `translate(${last.left}px,${last.top}px) scale(1)`, clipPath: `inset(0px 0px ${canvasHeight - last.height}px 0px round ${lastRadius}px)` }
    ], options));
    run.animations.push(layer.animate(expanding ? [
      { backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.25)' }
    ] : [
      { backgroundColor: 'rgba(0,0,0,.25)' }, { backgroundColor: 'rgba(0,0,0,0)' }
    ], options));
    run.animations.push(fromSnapshot.animate([
      { opacity: 1, offset: 0 }, { opacity: 0, offset: .72 }, { opacity: 0, offset: 1 }
    ], { duration, easing: 'linear', fill: 'both' }));
    run.animations.push(toSnapshot.animate([
      { opacity: 0, offset: 0 }, { opacity: 1, offset: .58 }, { opacity: 1, offset: 1 }
    ], { duration, easing: 'linear', fill: 'both' }));
    // Cancelled .finished promises reject; cancellation never runs an old finish.
    Promise.all(run.animations.map(animation => animation.finished)).then(finish, () => {});
    return handle;
  }

  // Note → reader keeps the text at its reading anchor. Only the note chrome
  // withdraws; the centre is never scaled like a feed thumbnail.
  function revealConversation({ noteSnapshot, readerSnapshot, top, bottom, reverse = false, duration = 360, onFinish }) {
    cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onFinish?.(); return { cancel() {} }; }
    const { phone, rect, zoom } = phoneMetrics();
    const height = rect.height / zoom;
    top = Math.max(0, Math.min(height, (top - rect.top) / zoom));
    bottom = Math.max(top, Math.min(height, (bottom - rect.top) / zoom));
    const run = { layer: null, animations: [], done: false };
    active = run;
    const layer = document.createElement('div');
    layer.className = 'demo-motion-layer conversation-reveal';
    layer.inert = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;inset:0;z-index:60;overflow:hidden;pointer-events:none;background:#f5f5f5;';
    run.layer = layer;
    const restore = [];
    function duplicate(snapshot) {
      const clone = snapshot.cloneNode(true), metadata = snapshots.get(snapshot);
      const originals = [snapshot, ...snapshot.querySelectorAll('*')];
      const copies = [clone, ...clone.querySelectorAll('*')];
      metadata.scrolls.forEach(({ node, left, top }) => restore.push({ node: copies[originals.indexOf(node)], left, top }));
      return clone;
    }
    function frame(snapshot, clip) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
      wrapper.style.clipPath = clip;
      wrapper.append(duplicate(snapshot)); layer.append(wrapper);
      return wrapper;
    }
    const centre = frame(noteSnapshot, `inset(${top}px 0 ${height - bottom}px)`);
    const reader = frame(readerSnapshot, 'inset(0)');
    const upper = frame(noteSnapshot, `inset(0 0 ${height - top}px)`);
    const lower = frame(noteSnapshot, `inset(${bottom}px 0 0)`);
    upper.style.transformOrigin = 'center top';
    lower.style.transformOrigin = 'center bottom';
    phone.append(layer);
    layer.getBoundingClientRect();
    restore.forEach(({node, top, left}) => { node.scrollTop = top; node.scrollLeft = left; });
    const options = { duration, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both', direction: reverse ? 'reverse' : 'normal' };
    const animate = (element, frames) => run.animations.push(element.animate(frames, options));
    animate(upper, [{ transform: 'translateY(0) scaleY(1)', opacity: 1 }, { transform: `translateY(${-top}px) scaleY(.86)`, opacity: 0 }]);
    animate(lower, [{ transform: 'translateY(0) scaleY(1)', opacity: 1 }, { transform: `translateY(${height - bottom}px) scaleY(.92)`, opacity: 0 }]);
    animate(centre, [{ opacity: 1 }, { opacity: 0 }]);
    animate(reader, [{ clipPath: `inset(${top}px 0 ${height - bottom}px)`, opacity: 0 }, { clipPath: 'inset(0px 0 0px)', opacity: 1 }]);
    Promise.all(run.animations.map(animation => animation.finished)).then(() => {
      if (run.done || active !== run) return;
      cleanup(run); onFinish?.();
    }, () => {});
    return { cancel: () => cleanup(run) };
  }

  // Personal conversation opens as the next page, retaining the shared answer
  // while the new-topic section and composer arrive from below.
  function continueConversation({ fromSnapshot, toSnapshot, duration = 340, onFinish }) {
    cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onFinish?.(); return { cancel() {} }; }
    const { phone } = phoneMetrics();
    const run = { layer: null, animations: [], done: false }; active = run;
    const layer = document.createElement('div');
    layer.className = 'demo-motion-layer personal-conversation-transition';
    layer.inert = true; layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;inset:0;z-index:60;overflow:hidden;pointer-events:none;background:#f5f5f5;';
    layer.append(fromSnapshot, toSnapshot); phone.append(layer); run.layer = layer;
    layer.getBoundingClientRect();
    [fromSnapshot, toSnapshot].forEach(snapshot => snapshots.get(snapshot).scrolls.forEach(({node,top,left}) => {node.scrollTop=top;node.scrollLeft=left}));
    const options = {duration, easing:'cubic-bezier(.22,.75,.2,1)', fill:'both'};
    run.animations.push(fromSnapshot.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX(-18%)',opacity:.4}],options));
    run.animations.push(toSnapshot.animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],options));
    Promise.all(run.animations.map(animation=>animation.finished)).then(()=>{
      if(run.done||active!==run)return;
      cleanup(run);onFinish?.();
    },()=>{});
    return {cancel:()=>cleanup(run)};
  }

  window.demoMotion = Object.freeze({ capture, transition, revealConversation, continueConversation, cancel });
})();
