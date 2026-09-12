export type Point3 = [number, number, number];
/** Canvas size in CSS pixels. Grouped because the maths below takes width and height together, and
 *  four loose numbers in a signature are four numbers that can be passed in the wrong order. */
export type Viewport = { width: number; height: number };
/** How near and far the camera may sit from the review plane. */
export type DollyLimits = { min: number; max: number };
export type Mode = 'pan' | 'comment';
export type Filter = 'all' | 'open' | 'resolved';
export type Message = { id: string; author: string; createdAt: string; text: string; deleted?: boolean };
/** Where a comment is pinned. With `on`, `anchor` is local to that form, so the pin stays on the
 *  surface while the form turns in the inspector, and one stored point serves both views. Without
 *  `on` it is a world point, which is where boards and empty space land. */
export type Draft = { anchor: Point3; on?: string };
export type Thread = Draft & { id: string; resolved: boolean; messages: Message[] };
export type CameraAction = { id: number; kind: 'in' | 'out' | 'reset' | 'reveal'; anchor?: Draft };
/** `visible` means inside the frame. `occluded` means the surface it marks is facing away, which
 *  dims the pin rather than removing it: a comment you cannot see at all reads as a lost comment. */
export type PinPosition = { id: string; x: number; y: number; visible: boolean; occluded: boolean };
/** The review plane's origin on screen and the size of a world unit there, for the grid and scale. */
export type PlaneView = { x: number; y: number; pixelsPerUnit: number };
