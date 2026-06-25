# a11y-userscripts

A small, consistent collection of browser **userscripts** for manual accessibility (a11y) testing. Each one is a single-purpose tool that overlays information on the page you're auditing — heading structure, table semantics, focusable elements, ARIA roles, keyboard focus order, and WCAG 1.1.1 non-text content checks.

They're built for accessibility testers and front-end developers who do hands-on WCAG 2.1 / Section 508 review and want lightweight, no-dependency helpers that run on any page.

**Design principles**

- **Read-only and non-destructive.** Tools highlight, annotate, and report. They never transmit data anywhere and make no network calls.
- **Nothing runs until you ask.** Each tool adds a small **launcher button** in the bottom-right corner. Click it to open the tool; click again (or use the panel's **Close** button / `Esc`) to remove it. Event-based tools (focus log, ARIA hover) stay off until activated and never hijack native keyboard navigation.
- **The tools are themselves accessible.** Each panel is a labelled ARIA dialog with real form labels, visible focus styles, keyboard support, and high-contrast colors.
- **Consistent.** All scripts share one UI pattern, versioning (1.1.0), and an MIT license.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Firefox/Safari) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open any `.user.js` file in the [`scripts/`](scripts) folder and click **Raw** — your userscript manager will offer to install it.
3. The script's launcher button appears in the bottom-right of any page. Multiple tools stack neatly.

No special permissions are requested (`@grant none`).

## The scripts

| Script | What it does | How to use |
|---|---|---|
| [`accessibility-heading-tool`](scripts/accessibility-heading-tool.user.js) | Color-coded outlines and level badges on `H1`–`H6` and `aria-level` headings, with per-level counts | Launcher → tick the levels to reveal |
| [`accessibility-table-inspector`](scripts/accessibility-table-inspector.user.js) | Highlights tables, cells, and ARIA table roles; audits data tables for a missing `<caption>` | Launcher → tick element types |
| [`table-grid-accessibility-validator`](scripts/table-grid-accessibility-validator.user.js) | Checks HTML tables and ARIA grids for captions, `<th>` headers, `scope`, and required roles, with pass/warn/fail tags | Launcher → read findings, re-scan |
| [`highlight-focusable-elements`](scripts/highlight-focusable-elements.user.js) | Outlines focusable elements and numbers them in source order to inspect keyboard reachability | Launcher → outlines + counts |
| [`keyboard-navigation-logger`](scripts/keyboard-navigation-logger.user.js) | Logs each element that receives focus as you Tab/arrow through the page (does **not** block native navigation) | Launcher → tab the page, watch the log |
| [`log-aria-roles-and-properties`](scripts/log-aria-roles-and-properties.user.js) | Shows the role and all `aria-*` properties of the element under the cursor | Launcher → hover any element |
| [`wcag-1.1.1-non-text-content-checker`](scripts/wcag-1.1.1-non-text-content-checker.user.js) | Scans for images, SVG, image inputs, and embedded media missing text alternatives (WCAG SC 1.1.1) | Launcher → read findings, re-scan |

## Notes & scope

- These are **manual-testing aids**, not a full automated audit. They surface things for a human to judge — they don't replace a tester or a conformance engine. Automated checks are labelled; manual judgement is still required.
- All changes to the page (outlines, badges, panels) are removed when you close a tool.
- Tested in Chromium-based browsers via Tampermonkey.

## Contributing

Issues and pull requests welcome — especially additional checks, better in-page reporting, and broader screen-reader coverage.

## License

[MIT](LICENSE)
