# TRSYP 3.0 — Game screens

Live match screens for the TRSYP 3.0 robotics competition. Built screen by screen, merged later.

## Screen 1 — Polygame

A fixed 1920×1080 stage that scales to the window. Two teams, each with:

- **Camera placeholder** — the live video is laid over it when screen sharing.
- **Shapes board** — 25 pieces in a flat top view (5 columns × green triangle, red/blue triangle, red/blue cube). Click a piece → Grey / Remove / Restore. Removed pieces leave a dashed outline.
- **5×5 grid** — click a square: white → red → blue → white.
- **Timer** (counts up) and **current total** (manual).

State is saved in the browser, so a refresh mid-match keeps everything.

### Keyboard

| Action | Team 1 | Team 2 |
| --- | --- | --- |
| Start / pause timer | `Q` | `P` |
| Reset timer | `A` | `L` |
| Points +1 (Shift = +5) | `W` | `O` |
| Points −1 (Shift = −5) | `S` | `K` |

- `Space` — start / pause both timers
- `Shift+X` twice within 2 s — reset everything
- `H` — show / hide the controls panel
- Double-click a team name to rename it

## Run

```bash
npm install
npm run dev
```
