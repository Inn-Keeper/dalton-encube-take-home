# Decisions

## Scene and rendering

- **React Three Fiber:** declarative scene ownership and on-demand rendering without a custom render loop.
- **Fixed 35° perspective camera:** depth remains readable while stable orientation keeps comment projection predictable.
- **Separate inspector:** forms rotate without moving anchors on the main canvas. Both views share the same geometry and thread data.
- **DPR capped at 2:** Retina sharpness without the mobile GPU cost of 3x rendering. Browser tests assert both canvases at DPR 2 and 3.
- **World-space grid:** the grid pans and zooms with the scene; a 1-2-5 scale makes its size meaningful.

## Anchoring

- **Form-local anchors:** comments stay attached while a form rotates and resolve correctly in both views.
- **World anchors for boards and empty space:** these objects do not move, so local coordinates add no value.
- **Inspector clicks belong to the inspected form:** notes placed beside the mesh still remain meaningful in the main view.
- **CSS-sized pins:** pins stay readable at every zoom, clamp to the viewport, and dim instead of disappearing when occluded.

## Navigation

- **Custom controls:** wheel pan, trackpad and touch pinch, pointer-anchored zoom, keyboard input, and fixed camera orientation do not match OrbitControls defaults.
- **Target-based zoom:** quick inputs compose correctly while the camera eases toward the result.
- **Native trackpad momentum:** wheel streams already contain inertia; adding another layer would duplicate it.
- **Scoped input:** view shortcuts act only on the focused view; fullscreen remains workspace-wide.
- **Reduced motion:** camera, inspector, and panel animations stop when the user requests it.

## Conversations

- **Local React state with validated `localStorage`:** sufficient for a small client-only demo; no database abstraction is needed.
- **Individual removal:** replies are deleted; the root becomes a tombstone so replies and the pin remain.
- **Explicit conversation deletion:** only Delete removes the full thread and pin.
- **Shared confirmation dialog:** discard and delete flows reuse one accessible focus-managed primitive.
- **Mounted sidebar:** collapse preserves filters and drafts; selecting or placing a comment reopens it.
- **Independent panel scrolling:** `overflow-y: auto`, contained overscroll, and a stable scrollbar keep the workspace fixed.

## Accessibility and layout

- **HTML controls over 3D text:** native focus, labels, forms, IME, and screen-reader behavior.
- **Single responsive component tree:** desktop and mobile layouts do not duplicate behavior.
- **Stable focus and announcements:** actions restore focus and report state changes through a polite live region.
- **Self-hosted Inter and shared tokens:** predictable typography and alignment across platforms.

## Deliberate scope

Not included: backend collaboration, undo/redo, minimap, and bulk actions. Add them only when product requirements justify their state and interaction cost.
