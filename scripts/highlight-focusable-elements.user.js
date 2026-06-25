// ==UserScript==
// @name         Highlight Focusable Elements
// @namespace    https://github.com/Sidhe-is-me/a11y-userscripts
// @version      1.1.0
// @description  Outline focusable elements and number them in source order to inspect keyboard reachability and tab order.
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


  const SELECTOR = [
    'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[contenteditable=""]', '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]', '[role="combobox"]',
    '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="option"]',
    '[role="slider"]', '[role="spinbutton"]', '[role="tab"]', '[role="treeitem"]'
  ].join(',');
  const marked = [];
  let panelRef = null, launcher = null, showNumbers = true;

  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function apply() {
    clear();
    let n = 0;
    document.querySelectorAll(SELECTOR).forEach((el) => {
      if (!visible(el)) return;
      n++;
      const prevOutline = el.style.outline, prevPosition = el.style.position;
      el.style.outline = '3px dotted #e6194b';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      let badge = null;
      if (showNumbers) {
        badge = document.createElement('span');
        badge.className = 'a11yk-badge';
        badge.style.cssText = 'top:0;left:0;color:#fff;background:#e6194b';
        badge.textContent = String(n);
        el.appendChild(badge);
      }
      marked.push({ el, prevOutline, prevPosition, badge });
    });
    return n;
  }
  function clear() {
    while (marked.length) {
      const { el, prevOutline, prevPosition, badge } = marked.pop();
      el.style.outline = prevOutline; el.style.position = prevPosition;
      if (badge && badge.parentNode) badge.remove();
    }
  }
  function openPanel() {
    panelRef = makePanel('Focusable elements', closeTool);
    const count = apply();
    const summary = document.createElement('p'); summary.className = 'a11yk-note';
    summary.style.color = '#fff';
    summary.textContent = count + ' focusable element(s) outlined in source order.';
    panelRef.body.appendChild(summary);
    const row = document.createElement('div'); row.className = 'a11yk-row';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'a11yk-f-nums'; cb.checked = true;
    cb.addEventListener('change', () => { showNumbers = cb.checked; apply(); });
    const label = document.createElement('label'); label.htmlFor = cb.id; label.textContent = 'Show order numbers';
    row.append(cb, label); panelRef.body.appendChild(row);
    const note = document.createElement('p'); note.className = 'a11yk-note';
    note.textContent = 'Source order is not always the actual tab order — positive tabindex values can reorder it. Verify by tabbing.';
    panelRef.body.appendChild(note);
  }
  function closeTool() {
    clear();
    if (panelRef && panelRef.panel.parentNode) panelRef.panel.remove();
    panelRef = null;
    if (launcher) { launcher.setAttribute('aria-pressed', 'false'); launcher.focus(); }
  }
  launcher = makeLauncher('Focusable', (on) => { on ? openPanel() : closeTool(); });
})();
