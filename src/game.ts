import "./style.css";
import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { initialState } from "./world";
import { createDebug } from "./debug";
import { update } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;
  /** Transient input bookkeeping, cleared whenever the screen changes. */
  readonly menuPresses?: Readonly<Record<number, number>>;
}

export type StateView = DeepReadonly<CaromState>;
export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Snapshot = Omit<CaromState, "ball" | "menuPresses"> & {
  version: number;
  ball: (BallState & { speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(state: StateView): CaromState;
  spawnBall(state: StateView): CaromState;
  spawnObstacle(state: StateView, index: number): CaromState;
  reset(state: StateView): CaromState;
  reconcile(state: StateView): CaromState;
  setScreen(state: StateView, screen: Screen): CaromState;
  setMode(state: StateView, mode: Mode): CaromState;
  setMenuIndex(state: StateView, index: number): CaromState;
  setTitleIndex(state: StateView, index: number): CaromState;
  setResumeScreen(
    state: StateView,
    screen: "countdown" | "playing",
  ): CaromState;
  setScore(state: StateView, p1: number, p2: number): CaromState;
  setWinner(state: StateView, side: Side | null): CaromState;
  setReceiver(state: StateView, side: Side): CaromState;
  setPaddleCy(state: StateView, side: Side, cy: number): CaromState;
  setPaddleVy(state: StateView, side: Side, vy: number): CaromState;
  setPaddleDriven(state: StateView, side: Side, driven: boolean): CaromState;
  setBallPosition(state: StateView, x: number, y: number): CaromState;
  setBallVelocity(state: StateView, vx: number, vy: number): CaromState;
  setBallSpin(state: StateView, spin: number): CaromState;
  setBallHeld(state: StateView, held: boolean): CaromState;
  setBallHoldTimer(state: StateView, seconds: number): CaromState;
  setBallServeSign(state: StateView, sign: 1 | -1): CaromState;
  drawBallServeSign(state: StateView): CaromState;
  setAiTracking(state: StateView, enabled: boolean): CaromState;
  setAiMovement(state: StateView, enabled: boolean): CaromState;
  setMuted(state: StateView, muted: boolean): CaromState;
  snapshot(state: StateView): Snapshot;
  menuItemRect(state: StateView, index: number): MenuRect | null;
}

export const BACKGROUND = "#090f18";

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const tones = [620, 280, 860, 420];
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        wave: i === 2 ? "triangle" : "sine",
        freq: tones[i],
        freqTo: tones[i] * (i === 3 ? 1.8 : 0.6),
        gain: 0.14,
        durationMs: i === 3 ? 180 : 65,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1", (s) => s.score.p1);
    api.diagnostics.register("p2", (s) => s.score.p2);
    api.diagnostics.register("ball.position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball.velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    api.diagnostics.register("ball.spin", (s) => s.ball?.spin ?? "none");
    for (const side of ["left", "right"] as const) {
      api.diagnostics.register(`${side}.cy`, (s) => s.paddles[side].cy);
      api.diagnostics.register(`${side}.vy`, (s) => s.paddles[side].vy);
    }
    return [initialState(false), createDebug()];
  },
  update,
  render,
};
