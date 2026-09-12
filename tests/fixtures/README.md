# Recorded gesture traces

Drop real trackpad recordings here as `pan-*.json` and `pinch-*.json`.

Record them with `npm run dev`, then open
<http://127.0.0.1:5173/tools/record-gesture.html> on the target machine.

`tests/trackpad.spec.ts` picks up whatever it finds and derives its expectations from each
recording, so no test needs editing when a trace is added. With this directory empty, those
tests skip rather than pass, because a suite that reports green while asserting nothing about
trackpad feel is worse than one that admits the gap.
