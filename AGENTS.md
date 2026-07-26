# Working on nitro-js-bridge

This library is loaded into **other people's websites**. Every rule below follows
from that.

## Code style

- **Always brace control flow.** No single-line or brace-less `if`, `else`,
  `for` or `while` — not even for an early return.

  ```js
  // no
  if (!box) return false;

  // yes
  if (!box) {
    return false;
  }
  ```

- Comments explain *why*, not *what*. Skip the ones that restate the code.
- Keep tuning knobs (timings, sizes, colours) in one named constant object at the
  top of the module instead of sprinkling literals through the logic.

## Never break the host site

The bridge is a guest. A change is only acceptable if all of this still holds:

- **Never mutate the host element** — no inline styles, classes, attributes,
  listeners or child nodes on anything the site owns. Overlays are separate nodes
  we own, positioned over the target.
- Keep our DOM out of the way: our own tag name, inside a shadow root, mounted on
  `<html>` — not `<body>`, so `body > :last-child` still matches what the site's
  CSS expects — with `position: fixed` and a zero-size box so layout, scroll
  height and scrollbars are untouched.
- `pointer-events: none` on anything decorative, so hovers, clicks and cursors
  reach the site as usual.
- Listeners are `{ passive: true }` and read-only: no `preventDefault()` or
  `stopPropagation()` on the site's events. Our own nodes' events are ours to
  cancel.
- Everything must be fully removable: `cleanup()` leaves no nodes, listeners,
  timers or observers behind.
- Do nothing at all outside the editor iframe — guard on `isEmbedded()`.

## Browsers

Current Chrome, Firefox, Safari (desktop + iOS) and Edge. No IE, no legacy Edge.
Feature-detect anything newer than that baseline (`attachShadow`, constructable
`CSSStyleSheet`, …) and degrade instead of throwing.

Do not read the `overflow`, `background` or other shorthands from
`getComputedStyle` — browsers serialise them differently. Read the longhands
(`overflowX`/`overflowY`, …).

## Tests

- `npm test` runs vitest in **node, without jsdom**. DOM-touching code needs its
  fakes built in the test file — see `src/highlightAndClick.test.ts`.
- Cross-browser behaviour is covered by the playwright suite in `e2e/`, which
  drives the real `demo/` pages with a real mouse in Chromium, Firefox and
  WebKit: `npm run test:e2e`, after `npx playwright install chromium firefox
  webkit` once. It runs as its own `browser-tests` job in CI, not as part of
  `npm test`.
  - It serves the demo itself, and reuses your `npm run dev` server if one is
    already on 5174. If that port is busy with something else, use
    `PLAYWRIGHT_PORT=5188 npm run test:e2e`.

## Package manager

**npm only.** `package-lock.json` is the one lockfile; there is no `yarn.lock`
and none should be added — a second lockfile drifts from the first and npm 7+
silently rewrites a yarn lockfile it finds. CI installs with `npm ci`, so the
lockfile has to be in the commit whenever `package.json` dependencies change.

When adding a devDependency, check `git diff package-lock.json` and keep it to
the entries you meant to add.

Node is a **build-time** concern only — what ships is browser code — so the CI
matrix (node 20 and 22) exists to check the toolchain, not to constrain
integrators. Do not add an `engines` field to `package.json`: it would push a
node requirement onto every site that installs the bridge.
- Anything about not disturbing the site needs a test that asserts the *absence*
  of an effect (host untouched, event not cancelled, node count unchanged).
