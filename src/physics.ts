import * as C from "./constants";
import type { BallState, StateView } from "./game";
import { clamp } from "./world";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
type Face = "left" | "right" | "top" | "bottom";

/** Expanded-AABB contact. Stable face order makes corner ties deterministic. */
function contact(
  b: MovingBall,
  r: C.Rect,
): { face: Face; reflected: boolean } | null {
  const depths = [
    b.x - (r.x0 - C.BALL_R),
    r.x1 + C.BALL_R - b.x,
    b.y - (r.y0 - C.BALL_R),
    r.y1 + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return null;
  const i = depths.indexOf(Math.min(...depths));
  const face = (["left", "right", "top", "bottom"] as const)[i];
  let reflected: boolean;
  if (face === "left" || face === "right") {
    b.x = face === "left" ? r.x0 - C.BALL_R : r.x1 + C.BALL_R;
    reflected = face === "left" ? b.vx > 0 : b.vx < 0;
    if (reflected) b.vx = -b.vx;
  } else {
    b.y = face === "top" ? r.y0 - C.BALL_R : r.y1 + C.BALL_R;
    reflected = face === "top" ? b.vy > 0 : b.vy < 0;
    if (reflected) b.vy = -b.vy;
  }
  return { face, reflected };
}
export function advanceBall(
  s: StateView,
  dt: number,
  cues: Set<C.CueName>,
): BallState | null {
  if (!s.ball || s.ball.held) return s.ball;
  // Mutate only this private next-frame value, never the engine's state.
  const b: MovingBall = { ...s.ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let step = 0; step < n; step++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx * cos - b.vy * sin;
      b.vy = b.vx * sin + b.vy * cos;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side];
      const left = side === "left";
      const result = contact(b, {
        x0: left ? C.P1_X0 : C.P2_X0,
        x1: left ? C.P1_X1 : C.P2_X1,
        y0: p.cy - C.PADDLE_HALF,
        y1: p.cy + C.PADDLE_HALF,
      });
      if (!result) continue;
      if (result.face === "left" || result.face === "right") {
        const theta =
          clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
        const nextSpeed = Math.min(
          Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
          C.SPEED_CAP,
        );
        b.vx = (left ? 1 : -1) * nextSpeed * Math.cos(theta);
        b.vy = nextSpeed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else if (result.reflected) cues.add(C.CUES.wallBounce);
    }
    for (const obstacle of s.obstacles) {
      const result = contact(b, C.OBSTACLES[obstacle.index]);
      if (result?.reflected) cues.add(C.CUES.obstacleBounce);
    }
  }
  return b;
}
