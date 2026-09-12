// Input and motion values shared by the canvas and the inspector. They live together because both
// surfaces are the same interaction at different scales: a gesture that feels right in one and wrong
// in the other is a bug, and two copies of a number is how that starts.

/** Past this the drag has committed to navigating and can no longer become a comment. */
export const DRAG_SLOP_PX = 5;
/** A single wheel event never counts for more than this, however the device reports it. */
export const WHEEL_DELTA_LIMIT = 500;
/** Long enough to read as travel rather than a jump, short enough not to feel like waiting. */
export const RESET_DURATION_MS = 300;
