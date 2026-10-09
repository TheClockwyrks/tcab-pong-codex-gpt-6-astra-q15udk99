# Carom

Carom is a browser paddle duel built with TypeScript and the Simple 2D engine.
Slide into a return to curve the ball with spin, bank shots off two amber
obstacles, and score behind your opponent. Play Solo against the computer or
Versus with a friend on the same keyboard. First to 11, with a two-point lead,
wins.

All graphics are drawn on canvas and all sounds are synthesized. The game needs
no server, account, runtime downloads, or external assets.

## Run locally

Use a current Node.js version supported by Vite (22.12+ recommended).

```sh
npm ci
npm run dev
```

Open the local address printed by Vite.

## Production

```sh
npm run build
npm run preview
```

The build writes the complete site to `dist/`. Serve that directory at the root
of any static web host. Preview serves the production build locally on port 4173.

## Controls

| Action | Controls |
| --- | --- |
| Solo paddle | W / S or Up / Down arrows |
| Versus left paddle | W / S |
| Versus right paddle | Up / Down arrows |
| Select menu item | W / S, arrows, mouse, or touch |
| Confirm | Enter, Space, click, or tap |
| Pause / resume | P or Escape |
| Back | Escape |
| Toggle sound | M |
| Engine diagnostics | Backtick |

On touchscreens, the engine supplies vertical paddle sliders and menu controls.
The how-to screen explains spin and bank shots. Pause offers resume, restart,
and return to menu.

## Development and checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the real engine with a canvas and a controlled clock in Node. They
cover menu and pointer behavior, serves, physics, scoring, AI, audio events,
and the debug contract. Coverage and test reports are written to `coverage/`.

`src/game.ts` exports the immutable state contract and game entry point. The
simulation, collision resolution, menus, debug poses, and rendering live in
separate modules beside it. The engine owns input, time, sound, viewport fitting,
and recording. A small CSS override preserves viewport sizing when the engine
writes an inline canvas size.

The `showcase/` directory contains the player description, carousel manifest,
three browser screenshots, and a five-second recording made with the engine's
drawing recorder. The replay is JSON compressed with gzip.
