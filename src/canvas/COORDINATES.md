# The 3D scene

`Scene.tsx` renders a `@react-three/fiber` `<Canvas>`: a perspective camera looking at four
sculptural "studies" (`studies.tsx`), each a board with a form lifted above it. Everything about
panning, zooming, clicking, and placing comment pins comes down to one coordinate system, defined
in `coordinates.ts`.

## The coordinate system

Standard Three.js right-handed axes, used as:

- **X** — left/right across the review plane.
- **Y** — up/down across the review plane.
- **Z** — depth, toward the camera. `z = 0` is the *review plane*: the ground the boards sit on.
  Positive Z lifts a form off its board (`lift` in `studies.tsx`); the camera sits further out
  along Z, starting at `[0, 0, 22]` (`Scene.tsx`).

Each study's board is centered at `[x, y]` on the review plane (`study.at`), with its form
raised `study.lift` units above it in Z. The four boards are just laid out at fixed X/Y
positions — no grid or layout system, they're hand-placed.

## World space vs. screen space

Two coordinate spaces are in play, and most of `coordinates.ts` is translation between them:

- **World space** — the actual Vector3 positions of the camera, boards, and forms.
- **Screen space** — CSS pixels in the browser viewport, used for pointer input and for
  positioning HTML overlays (comment pins, badges) on top of the canvas.

Key conversions:

- `pointerRay` turns a pointer position (CSS pixels) into a camera ray (world space), used for
  both clicking on forms and panning.
- `projectPoint` does the reverse: a world point → CSS pixel position, via NDC (normalized
  device coordinates, the `-1..1` cube Three.js projects into). This is how comment pins and
  study badges track their 3D anchors while staying HTML elements.
- `pointOnPlane` intersects a ray with a Z-plane, giving pan/zoom gestures on empty space an
  unambiguous depth to land on (they use the review plane, `z = 0`, unless a dragged pin has
  its own captured depth).

## Anchors: forms carry their own local space

Forms are the only things that move (a form's board could in principle be repositioned).
So a clicked point isn't stored in world space — it's stored in the *local* space of the form
it landed on (`anchorAt` finds the hit form by walking up to a node named `form-*`; `toAnchor`
converts the world hit point into that form's local coordinates via `worldToLocal`). Comments
placed on empty space just keep a world-space anchor with no form.

To read an anchor back (`anchorWorld`), the stored form name is looked up in whichever scene
graph is currently rendering it — the canvas and the study inspector each have their own copy
of the same form, found by name — and the local point is converted back to world space via
`localToWorld`.

## Camera movement

The camera only ever moves along X/Y (pan) and Z (dolly/zoom) — it never orbits or rotates.

- **Pan** (`panCamera`) moves the camera in X/Y, scaled by how many world units one pixel covers
  at a given depth (`unitsPerPixel`), so a drag tracks the pointer regardless of zoom level.
- **Dolly/zoom** (`dollyAt`) moves the camera in Z, clamped to `DollyLimits`, then corrects X/Y
  so the world point under the pointer stays under the pointer after the zoom.
- **Zoom percentage** and **zoom stops** (`nextZoomStop`, `zoomStepFactor`) are just a way of
  expressing camera Z as a friendlier "100%"-style number, stepped in fixed 10% increments.

## The background grid

`SceneGrid.tsx` draws a plain CSS background-grid `<div>` over the canvas, not 3D geometry. It's
positioned and scaled from `reviewPlaneView`, which projects the world origin `(0,0,0)` to
screen pixels and computes `pixelsPerUnit` at the review plane's depth — so the grid pans and
zooms in lockstep with the 3D scene without being part of it.
