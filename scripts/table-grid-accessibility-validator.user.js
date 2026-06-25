// ==UserScript==
// @name         Table & Grid Accessibility Validator
// @namespace    https://github.com/Sidhe-is-me/a11y-userscripts
// @version      1.1.0
// @description  Validate HTML tables and ARIA grids for captions, headers, scope, and required roles.
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


  let panelRef = null, launcher = null;

  function check() {
    const out = [];
    const tables = Array.from(document.querySelectorAll('table'));
    const layoutLike = tables.filter((t) => t.getAttribute('role') === 'presentation' || t.getAttribute('role') === 'none');
    const dataTables = tables.filter((t) => !layoutLike.includes(t));

    out.push({ label: 'Data <table> elements', status: 'info', count: dataTables.length, help: 'Tables not marked role="presentation".' });

    const noCaption = dataTables.filter((t) => !t.querySelector(':scope > caption'));
    out.push({ label: 'Data tables missing <caption>', status: noCaption.length ? 'warn' : 'ok', count: noCaption.length,
      help: 'A <caption> gives the table an accessible name.' });

    const noTh = dataTables.filter((t) => !t.querySelector('th'));
    out.push({ label: 'Data tables with no <th> headers', status: noTh.length ? 'fail' : 'ok', count: noTh.length,
      help: 'Data tables need header cells so screen readers can associate data with headers.' });

    const ths = Array.from(document.querySelectorAll('table th'));
    const thNoScope = ths.filter((th) => !th.getAttribute('scope') && !th.getAttribute('id'));
    out.push({ label: 'th without scope or id', status: thNoScope.length ? 'warn' : 'ok', count: thNoScope.length,
      help: 'Use scope="col"/"row" (or headers/id) so associations are explicit, especially in complex tables.' });

    const grids = Array.from(document.querySelectorAll('[role="grid"], [role="table"], [role="treegrid"]'));
    out.push({ label: 'ARIA grid/table containers', status: 'info', count: grids.length, help: 'Elements using ARIA table semantics.' });

    const gridNoRows = grids.filter((g) => !g.querySelector('[role="row"]'));
    out.push({ label: 'ARIA grids missing role="row"', status: gridNoRows.length ? 'fail' : 'ok', count: gridNoRows.length,
      help: 'ARIA tables/grids must contain rows; otherwise structure is lost to assistive tech.' });

    const gridNoHeaders = grids.filter((g) => g.querySelector('[role="row"]') && !g.querySelector('[role="columnheader"], [role="rowheader"]'));
    out.push({ label: 'ARIA grids with no header cells', status: gridNoHeaders.length ? 'warn' : 'ok', count: gridNoHeaders.length,
      help: 'Grids generally need columnheader/rowheader cells for orientation.' });

    return out;
  }
  function render(body) {
    body.innerHTML = '';
    const rows = check();
    const problems = rows.filter((r) => r.status === 'fail' || r.status === 'warn').reduce((n, r) => n + r.count, 0);
    const head = document.createElement('p'); head.className = 'a11yk-note'; head.style.color = '#fff';
    head.textContent = problems ? problems + ' item(s) to review.' : 'No structural issues detected. Manual review still advised.';
    body.appendChild(head);
    const list = document.createElement('ul'); list.className = 'a11yk-list';
    rows.forEach((r) => {
      const li = document.createElement('li');
      const tag = r.status === 'info' ? '' : ' <span class="a11yk-tag ' + r.status + '">' + (r.status === 'ok' ? 'ok' : r.count) + '</span>';
      li.innerHTML = r.label + ': ' + r.count + tag;
      li.title = r.help;
      list.appendChild(li);
    });
    body.appendChild(list);
    const rescan = document.createElement('button'); rescan.type = 'button'; rescan.className = 'a11yk-x';
    rescan.style.marginTop = '8px'; rescan.textContent = 'Re-scan';
    rescan.addEventListener('click', () => render(body));
    body.appendChild(rescan);
    const note = document.createElement('p'); note.className = 'a11yk-note';
    note.textContent = 'Structural checks only — they catch missing semantics, not whether headers are logically correct. Confirm complex tables manually.';
    body.appendChild(note);
  }
  function openPanel() { panelRef = makePanel('Table & grid validator', closeTool); render(panelRef.body); }
  function closeTool() {
    if (panelRef && panelRef.panel.parentNode) panelRef.panel.remove();
    panelRef = null;
    if (launcher) { launcher.setAttribute('aria-pressed', 'false'); launcher.focus(); }
  }
  launcher = makeLauncher('Tables/Grids', (on) => { on ? openPanel() : closeTool(); });
})();
