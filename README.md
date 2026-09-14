# Encube 3D commenting canvas

A client-side 3D design-review workspace built with React, TypeScript, Vite, Tailwind CSS, and React Three Fiber. No backend.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>.

## Features

### Canvas and inspector

- Four reviewable 3D forms on a fixed-orientation perspective canvas.
- Pan, pointer-anchored zoom, touch pinch, reset, fullscreen, grid, and scale readout.
- Smooth zoom and drag momentum, disabled by `prefers-reduced-motion`.
- A separate 360° inspector with shared geometry, comments, controls, and part details.
- On-demand rendering with device pixel ratio capped at 2.
- A usable comments panel when WebGL is unavailable.

### Conversations

- Surface-anchored comments on the canvas and inspector.
- Reply, edit, resolve, reopen, and filter conversations.
- Remove individual comments or replies with confirmation.
- Removing the root comment keeps its replies and pin; only Delete removes the whole conversation.
- Pins retain a constant CSS-pixel size, remain numbered consistently, and dim when occluded.
- Changes persist in validated `localStorage` data.

### Responsive and accessible

- Desktop, narrow-panel, and stacked mobile layouts use the same components.
- The conversation panel scrolls independently and contains overscroll.
- Keyboard navigation covers tools, canvas movement, zoom, reset, inspector rotation, fullscreen, and posting.
- Focus restoration, live-region announcements, discard guards, and accessible confirmation dialogs.
- Automated axe-core checks target WCAG 2.1 AA.

## Commands

```sh
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Unit tests cover conversation rules, coordinate maths, gestures, and storage validation. Playwright covers Chromium, Firefox, and WebKit, including comment deletion, inspector behavior, responsive layouts, accessibility, persistence, and DPR 2/3 rendering assertions for both canvases.

## Trackpad fixtures

`tools/record-gesture.html` records real wheel streams. Save recordings in `tests/fixtures/` as `pan-*.json` or `pinch-*.json`; `tests/trackpad.spec.ts` replays them at their original timing.

No recordings are included, so those tests remain skipped.

## Known gaps

- Subjective Retina quality and device latency require physical-device testing.
- The production build reports a large-chunk warning.
- React Three Fiber currently emits an upstream `Three.Clock` deprecation warning.

See [DECISIONS.md](DECISIONS.md) for the main trade-offs.
