(function () {

  // ---------- клавиатура ----------
  document.addEventListener('keydown', e => {
    const t = e.target; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'range') return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      if (k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? FP.redo() : FP.undo(); }
      else if (k.toLowerCase() === 'y') { e.preventDefault(); FP.redo(); }
      else if (k.toLowerCase() === 's') { e.preventDefault(); FP.ui.download(); }
      else if (k.toLowerCase() === 'd' && FP.view === '2d') { e.preventDefault(); FP.duplicate(); }
      return;
    }
    if (FP.view === '3d') return;
    const key = k.toLowerCase(), map = { v: 'select', r: 'room', p: 'poly', w: 'wall', d: 'door', n: 'window', g: 'gap', m: 'measure', h: 'pan' };
    if (map[key] && !e.altKey) { FP.v2.setTool(map[key]); return; }
    if (key === 'f') FP.v2.fit();
    else if (k === ']') FP.rotateSel(e.shiftKey ? 90 : 15);
    else if (k === '[') FP.rotateSel(e.shiftKey ? -90 : -15);
    else if (k === 'Enter' && FP.v2.tool === 'poly') FP.v2.finishPoly();
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); FP.removeSel(); }
    else if (k === 'Escape') { if (FP.v2.tool !== 'select') FP.v2.setTool('select'); else FP.select(null); FP.v2.cancel(); }

    else if (k.startsWith('Arrow') && FP.selObj()) {                 // есть выбор: двигаем объект
      e.preventDefault();
      const st = e.shiftKey ? .01 : FP.settings().snap;
      FP.nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
    }
    else if (k.startsWith('Arrow')) {                                // нет выбора: двигаем холст
      e.preventDefault();
      const st = e.shiftKey ? 200 : 60;
      FP.v2.panBy(k === 'ArrowLeft' ? st : k === 'ArrowRight' ? -st : 0, k === 'ArrowUp' ? st : k === 'ArrowDown' ? -st : 0);
    }

  });

})();
