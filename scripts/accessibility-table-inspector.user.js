// ==UserScript==
// @name         Accessibility Table Inspector
// @namespace    https://github.com/Sidhe-is-me/a11y-userscripts
// @version      1.1.0
// @description  Highlight tables, cells, and ARIA table roles, and flag data tables missing a caption. Non-destructive.
// @author       Sidhe-is-me
// @license      MIT
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==UserScript==

(function () {
  'use strict';

  /* ---- shared accessible UI kit (inlined; userscripts can't share modules) ---- */
  const KIT_CSS = `
  .a11yk-launch{position:fixed;z-index:2147483646;right:16px;font:600 13px/1.2 system-ui,-apple-system,sans-serif;
    background:#1b1b1f;color:#fff;border:2px solid #fff;border-radius:8px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)}
  .a11yk-launch[aria-pressed="true"]{background:#0a6a3f;border-color:#0a6a3f}
  .a11yk-launch:focus-visible{outline:3px solid #54a3ff;outline-offset:2px}
  .a11yk-panel{position:fixed;z-index:2147483647;top:16px;right:16px;width:300px;max-height:80vh;overflow:auto;
    background:#1b1b1f;color:#fff;font:13px/1.45 system-ui,-apple-system,sans-serif;border:2px solid #fff;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.55)}
  .a11yk-panel h2{font-size:14px;margin:0;padding:10px 12px;border-bottom:1px solid #444;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .a11yk-x{background:none;border:1px solid #888;color:#fff;border-radius:6px;cursor:pointer;font:600 12px/1 system-ui,sans-serif;padding:4px 8px}
  .a11yk-x:focus-visible{outline:3px solid #54a3ff;outline-offset:1px}
  .a11yk-body{padding:10px 12px}
  .a11yk-row{display:flex;align-items:center;gap:8px;padding:4px 0}
  .a11yk-row label{cursor:pointer}
  .a11yk-note{color:#bbb;font-size:12px;margin:8px 0 0}
  .a11yk-list{margin:6px 0 0;padding-left:18px}
  .a11yk-list li{padding:2px 0}
  .a11yk-tag{display:inline-block;font:600 11px/1 system-ui,sans-serif;padding:2px 6px;border-radius:10px;margin-left:6px}
  .a11yk-tag.ok{background:#0a6a3f;color:#fff}.a11yk-tag.warn{background:#ffe119;color:#000}.a11yk-tag.fail{background:#e6194b;color:#fff}
  .a11yk-badge{position:absolute;font:600 10px/1 system-ui,sans-serif;padding:2px 4px;color:#000;z-index:2147483645;pointer-events:none;border-radius:2px}
  `;
  function injectStyles() {
    if (document.getElementById('a11yk-css')) return;
    const s = document.createElement('style');
    s.id = 'a11yk-css';
    s.textContent = KIT_CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function makeLauncher(label, onToggle) {
    injectStyles();
    const index = document.querySelectorAll('.a11yk-launch').length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'a11yk-launch';
    btn.style.bottom = (16 + index * 46) + 'px';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = '⚑ ' + label;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!on));
      onToggle(!on, btn);
    });
    document.body.appendChild(btn);
    return btn;
  }
  function makePanel(title, onClose) {
    const panel = document.createElement('div');
    panel.className = 'a11yk-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', title);
    panel.tabIndex = -1;
    const h = document.createElement('h2');
    h.textContent = title;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'a11yk-x';
    x.textContent = 'Close';
    x.addEventListener('click', onClose);
    h.appendChild(x);
    panel.appendChild(h);
    const body = document.createElement('div');
    body.className = 'a11yk-body';
    panel.appendChild(body);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); });
    document.body.appendChild(panel);
    panel.focus();
    return { panel, body };
  }
  /* ---- end kit ---- */


  const TARGETS = [
    { sel: 'table', color: '#e6194b', label: 'table' },
    { sel: 'caption', color: '#46f0f0', label: 'caption' },
    { sel: 'th', color: '#4363d8', label: 'th' },
    { sel: 'td', color: '#3cb44b', label: 'td' },
    { sel: '[role="table"]', color: '#e6194b', label: 'ARIA table' },
    { sel: '[role="row"]', color: '#f58231', label: 'ARIA row' },
    { sel: '[role="columnheader"]', color: '#4363d8', label: 'ARIA columnheader' },
    { sel: '[role="rowheader"]', color: '#911eb4', label: 'ARIA rowheader' },
    { sel: '[role="cell"], [role="gridcell"]', color: '#3cb44b', label: 'ARIA cell' }
  ];
  const marked = new Map();
  let panelRef = null, launcher = null;

  function setTarget(t, on) {
    if (on) {
      const list = [];
      document.querySelectorAll(t.sel).forEach((el) => {
        const prevOutline = el.style.outline, prevPosition = el.style.position;
        el.style.outline = '2px solid ' + t.color;
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const badge = document.createElement('span');
        badge.className = 'a11yk-badge';
        badge.style.cssText = 'top:0;left:0;color:#fff;background:' + t.color;
        badge.textContent = t.label;
        el.appendChild(badge);
        list.push({ el, prevOutline, prevPosition, badge });
      });
      marked.set(t.sel, list);
    } else {
      (marked.get(t.sel) || []).forEach(({ el, prevOutline, prevPosition, badge }) => {
        el.style.outline = prevOutline; el.style.position = prevPosition;
        if (badge.parentNode) badge.remove();
      });
      marked.delete(t.sel);
    }
  }
  function clearAll() {
    TARGETS.forEach((t) => { if (marked.has(t.sel)) setTarget(t, false); });
    if (panelRef) panelRef.body.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; });
  }
  function captionAudit() {
    const tables = Array.from(document.querySelectorAll('table'));
    const missing = tables.filter((tb) => !tb.querySelector(':scope > caption'));
    return { total: tables.length, missing };
  }
  function openPanel() {
    panelRef = makePanel('Table inspector', closeTool);
    TARGETS.forEach((t) => {
      const row = document.createElement('div'); row.className = 'a11yk-row';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'a11yk-t-' + t.label.replace(/\W+/g, '');
      cb.addEventListener('change', () => setTarget(t, cb.checked));
      const label = document.createElement('label'); label.htmlFor = cb.id;
      label.textContent = t.label + ' (' + document.querySelectorAll(t.sel).length + ')';
      row.append(cb, label); panelRef.body.appendChild(row);
    });
    const { total, missing } = captionAudit();
    const audit = document.createElement('p'); audit.className = 'a11yk-note';
    if (total === 0) { audit.textContent = 'No <table> elements found.'; }
    else if (missing.length === 0) { audit.innerHTML = total + ' table(s); all have a &lt;caption&gt; <span class="a11yk-tag ok">ok</span>'; }
    else { audit.innerHTML = missing.length + ' of ' + total + ' table(s) missing a &lt;caption&gt; <span class="a11yk-tag fail">check</span>'; }
    panelRef.body.appendChild(audit);
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'a11yk-x';
    clear.style.marginTop = '8px'; clear.textContent = 'Clear all';
    clear.addEventListener('click', clearAll); panelRef.body.appendChild(clear);
    const note = document.createElement('p'); note.className = 'a11yk-note';
    note.textContent = 'Highlights are non-destructive and removed when you close the tool.';
    panelRef.body.appendChild(note);
  }
  function closeTool() {
    clearAll();
    if (panelRef && panelRef.panel.parentNode) panelRef.panel.remove();
    panelRef = null;
    if (launcher) { launcher.setAttribute('aria-pressed', 'false'); launcher.focus(); }
  }
  launcher = makeLauncher('Tables', (on) => { on ? openPanel() : closeTool(); });
})();
