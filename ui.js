// Mejoras de interacción compartidas. No toca la lógica de stock: solo enriquece el DOM existente.
(() => {
  const P = {
    'layout-grid':'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    swap:'<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    down:'<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus:'<path d="M5 12h14"/><path d="M12 5v14"/>', minus:'<path d="M5 12h14"/>'
  };
  const ico = (n, s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
  const TAB_ICON = { stock:'layout-grid', movimiento:'swap', salida:'down', historial:'history', usuarios:'users' };

  // Tabs: íconos SVG, indicador deslizante y pestaña recordada en la URL (#hash)
  const tabs = document.querySelector('.tabs');
  if (tabs) {
    const ink = document.createElement('span'); ink.className = 'tab-ink'; tabs.appendChild(ink);
    tabs.querySelectorAll('.tab-btn').forEach(b => {
      b.innerHTML = ico(TAB_ICON[b.dataset.tab] || 'layout-grid') + '<span>' + b.textContent.replace(/^[^\p{L}]+/u, '').trim() + '</span>';
      b.addEventListener('click', () => history.replaceState(null, '', '#' + b.dataset.tab));
    });
    const mover = () => {
      const a = tabs.querySelector('.tab-btn.active'); if (!a) return;
      ink.style.setProperty('--x', a.offsetLeft + 'px'); ink.style.setProperty('--w', a.offsetWidth + 'px');
    };
    new MutationObserver(mover).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
    addEventListener('resize', mover);
    tabs.querySelector(`[data-tab="${location.hash.slice(1)}"]`)?.click();
    requestAnimationFrame(mover);
  }

  // Selects -> chips (el <select> sigue existiendo, así la lógica de cada página no cambia)
  function chips(sel, seg = false) {
    const wrap = document.createElement('div'); wrap.className = 'chips' + (seg ? ' seg' : '');
    sel.classList.add('sr-only'); sel.after(wrap);
    const dibujar = () => {
      const ops = [...sel.options].filter(o => o.value !== '' || !/^Selecci/.test(o.textContent));
      wrap.innerHTML = ops.length ? '' : '<span class="chips-hint">Elegí la opción anterior primero</span>';
      ops.forEach(o => {
        const c = document.createElement('button'); c.type = 'button';
        c.className = 'chip' + (o.value === sel.value ? ' on' : ''); c.textContent = o.textContent.replace(/^[↑↓]\s*/, '');
        c.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); dibujar(); };
        wrap.appendChild(c);
      });
    };
    new MutationObserver(dibujar).observe(sel, { childList: true });
    sel.addEventListener('change', dibujar); dibujar();
  }
  ['mov-marca', 'mov-linea', 'mov-producto', 'hist-filtro-marca', 'hist-filtro-tipo'].forEach(id => { const s = document.getElementById(id); if (s) chips(s); });
  const tipo = document.getElementById('mov-tipo'); if (tipo) chips(tipo, true);

  // Cantidad con botones − / +
  const q = document.getElementById('mov-cantidad');
  if (q) {
    const w = document.createElement('div'); w.className = 'stepper'; q.replaceWith(w);
    const b = (n, d) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'step-btn'; x.innerHTML = ico(n, 20); x.setAttribute('aria-label', d > 0 ? 'Sumar' : 'Restar');
      x.onclick = () => { q.value = Math.max(0, (Number(q.value) || 0) + d); q.dispatchEvent(new Event('input', { bubbles: true })); }; return x; };
    w.append(b('minus', -1), q, b('plus', 1));
  }

  // Números que "cuentan" hacia su valor la primera vez que aparecen
  const contar = el => {
    const fin = parseInt(el.textContent.replace(/[^\d-]/g, ''), 10); if (!Number.isFinite(fin) || fin === 0) return;
    const pre = /^[+-]/.test(el.textContent) ? el.textContent[0] : '', t0 = performance.now();
    (function paso(t) { const p = Math.min(1, (t - t0) / 700); el.textContent = pre + Math.round(Math.abs(fin) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(paso); })(t0);
  };
  ['stats-row', 'stock-tbody'].forEach(id => {
    const c = document.getElementById(id); if (!c) return;
    const o = new MutationObserver(() => { if (c.querySelector('.stat-value,.qty-number')) { o.disconnect(); c.querySelectorAll('.stat-value,.qty-number').forEach(contar); } });
    o.observe(c, { childList: true });
  });

  // Indicador de conexión en tiempo real
  if (typeof dbStock !== 'undefined') {
    const d = document.createElement('span'); d.className = 'conn'; d.title = 'Conexión en tiempo real';
    document.querySelector('.navbar-right')?.prepend(d);
    dbStock.ref('.info/connected').on('value', s => d.classList.toggle('on', !!s.val()));
  }

  // Atajo: "/" enfoca el buscador
  addEventListener('keydown', e => { const b = document.getElementById('stock-busqueda');
    if (e.key === '/' && b && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); b.focus(); } });
})();
