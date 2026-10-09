import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, PaddleState, Side, StateView } from "./game";
import { readInput } from "./menus";
import { advanceBall } from "./physics";
import { clamp, parkedBall } from "./world";

function movePaddle(
  s: StateView,
  side: Side,
  api: UpdateApi,
  dt: number,
): PaddleState {
  const p = s.paddles[side];
  let vy = 0;
  if (p.driven) vy = p.drivenVy;
  else if (side === "right" && s.mode === "solo") {
    if (s.ai.movement) {
      const defending =
        s.ai.tracking &&
        s.screen === "playing" &&
        s.ball !== null &&
        s.ball.vx > 0;
      const target =
        defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
      const diff = target - p.cy;
      if (Math.abs(diff) > (defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE))
        vy =
          Math.sign(diff) *
          Math.min(C.AI_SPEED, dt > 0 ? Math.abs(diff) / dt : C.AI_SPEED);
    }
  } else {
    const prefix = side === "left" ? "p1" : "p2";
    const up =
      api.input.value(`${prefix}-up`) > 0 ||
      (s.mode === "solo" && api.input.value("p2-up") > 0);
    const down =
      api.input.value(`${prefix}-down`) > 0 ||
      (s.mode === "solo" && api.input.value("p2-down") > 0);
    vy = (Number(down) - Number(up)) * C.PADDLE_SPEED;
  }
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (cy !== raw && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}
export function update(
  state: StateView,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt, muted: api.audio.muted() };
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  s = {
    ...s,
    paddles: {
      left: movePaddle(s, "left", api, dt),
      right: movePaddle(s, "right", api, dt),
    },
  };
  const cues = new Set<C.CueName>();
  if (s.ball && s.screen === "countdown") {
    const holdTimer = Math.max(0, s.ball.holdTimer - dt);
    const served = holdTimer <= 0;
    s = {
      ...s,
      screen: served ? "playing" : "countdown",
      ball: {
        ...s.ball,
        holdTimer,
        ...(served
          ? {
              held: false,
              trail: [],
              vx:
                (s.receiver === "left" ? -1 : 1) *
                C.SERVE_SPEED *
                Math.cos(C.SERVE_ANGLE),
              vy: s.ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
            }
          : {}),
      },
    };
  } else if (s.screen === "playing")
    s = { ...s, ball: advanceBall(s, dt, cues) };
  if (s.ball) {
    s = {
      ...s,
      ball: {
        ...s.ball,
        trail: [
          ...s.ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
          { x: s.ball.x, y: s.ball.y, t: s.simTime },
        ],
      },
    };
    const b = s.ball;
    if (b && !b.held && (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)) {
      const scorer: Side = b.x > C.FIELD_W ? "left" : "right";
      const score = {
        p1: s.score.p1 + Number(scorer === "left"),
        p2: s.score.p2 + Number(scorer === "right"),
      };
      const won =
        Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
        Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
      s = won
        ? {
            ...s,
            score,
            winner: scorer,
            screen: "matchover",
            menuIndex: 0,
            menuPresses: {},
          }
        : {
            ...s,
            score,
            receiver: scorer === "left" ? "right" : "left",
            screen: "countdown",
            ball: parkedBall(),
          };
      cues.add(C.CUES.score);
    }
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
