// ==UserScript==
// @name         WCAG 1.1.1 Non-text Content Checker
// @namespace    https://github.com/Sidhe-is-me/a11y-userscripts
// @version      1.1.0
// @description  Scan a page for non-text content (images, SVG, media) missing text alternatives, per WCAG SC 1.1.1.
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

  function scan() {
    const findings = [];
    const imgs = Array.from(document.querySelectorAll('img'));
    const noAlt = imgs.filter((i) => !i.hasAttribute('alt'));
    const emptyAlt = imgs.filter((i) => i.getAttribute('alt') === '');
    findings.push({
      label: 'img missing alt attribute', items: noAlt,
      status: noAlt.length ? 'fail' : 'ok',
      help: 'Every <img> needs an alt attribute. Use alt="" only for decorative images.'
    });
    findings.push({
      label: 'img with empty alt (decorative)', items: emptyAlt, status: emptyAlt.length ? 'warn' : 'ok',
      help: 'Confirm these images are truly decorative; otherwise they need descriptive text.'
    });
    const inputImg = Array.from(document.querySelectorAll('input[type="image"]')).filter((i) => !i.getAttribute('alt'));
    findings.push({ label: 'input[type=image] missing alt', items: inputImg, status: inputImg.length ? 'fail' : 'ok',
      help: 'Image buttons must have alt text describing their action.' });
    const areas = Array.from(document.querySelectorAll('area[href]')).filter((a) => !a.getAttribute('alt'));
    findings.push({ label: 'area (image map) missing alt', items: areas, status: areas.length ? 'fail' : 'ok',
      help: 'Each <area> in an image map needs alt text.' });
    const svgs = Array.from(document.querySelectorAll('svg')).filter((s) => {
      const labelled = s.getAttribute('aria-label') || s.getAttribute('aria-labelledby') || s.querySelector('title');
      const hidden = s.getAttribute('aria-hidden') === 'true' || s.getAttribute('role') === 'presentation';
      return !labelled && !hidden;
    });
    findings.push({ label: 'svg without name or aria-hidden', items: svgs, status: svgs.length ? 'warn' : 'ok',
      help: 'Meaningful SVGs need a <title>/aria-label; decorative ones need aria-hidden="true".' });
    const media = Array.from(document.querySelectorAll('object, embed')).filter((o) => !(o.getAttribute('aria-label') || o.getAttribute('title') || o.textContent.trim()));
    findings.push({ label: 'object/embed without text alternative', items: media, status: media.length ? 'warn' : 'ok',
      help: 'Embedded objects need a text alternative for non-visual users.' });
    return findings;
  }
  function render(body) {
    body.innerHTML = '';
    const findings = scan();
    const fails = findings.filter((f) => f.status === 'fail').reduce((n, f) => n + f.items.length, 0);
    const head = document.createElement('p'); head.className = 'a11yk-note'; head.style.color = '#fff';
    head.textContent = fails ? fails + ' likely failure(s) found — review below.' : 'No automatic failures found. Manual review still required.';
    body.appendChild(head);
    const list = document.createElement('ul'); list.className = 'a11yk-list';
    findings.forEach((f) => {
      const li = document.createElement('li');
      li.innerHTML = f.label + ' <span class="a11yk-tag ' + f.status + '">' + (f.status === 'ok' ? 'ok' : f.items.length) + '</span>';
      li.title = f.help;
      list.appendChild(li);
    });
    body.appendChild(list);
    const rescan = document.createElement('button'); rescan.type = 'button'; rescan.className = 'a11yk-x';
    rescan.style.marginTop = '8px'; rescan.textContent = 'Re-scan';
    rescan.addEventListener('click', () => render(body));
    body.appendChild(rescan);
    const note = document.createElement('p'); note.className = 'a11yk-note';
    note.textContent = 'Automated checks for WCAG 2.x SC 1.1.1. [AUTO] findings flag missing alternatives; [MANUAL] judgement is still needed on whether existing text is meaningful.';
    body.appendChild(note);
  }
  function openPanel() { panelRef = makePanel('Non-text content (SC 1.1.1)', closeTool); render(panelRef.body); }
  function closeTool() {
    if (panelRef && panelRef.panel.parentNode) panelRef.panel.remove();
    panelRef = null;
    if (launcher) { launcher.setAttribute('aria-pressed', 'false'); launcher.focus(); }
  }
  launcher = makeLauncher('SC 1.1.1', (on) => { on ? openPanel() : closeTool(); });
})();
