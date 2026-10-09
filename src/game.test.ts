import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { BACKGROUND, game, type StateView } from "./game";
import * as C from "./constants";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
});
async function setup(step = 10) {
  const events = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    layout: C.LAYOUT,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  cleanup.push(() => engine.destroy());
  await engine.initialize();
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    device = "mouse",
    id = 1,
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const d = engine.debug;
  const pose = (fn: (s: StateView) => StateView) => engine.apply(fn);
  const flight = (x: number, y: number, vx: number, vy: number, spin = 0) => {
    pose((s) => d.clearWorld(s));
    pose((s) => d.spawnBall(s));
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setMode(s, "versus"));
    pose((s) => d.setBallPosition(s, x, y));
    pose((s) => d.setBallVelocity(s, vx, vy));
    pose((s) => d.setBallSpin(s, spin));
    pose((s) => d.setBallHeld(s, false));
  };
  const cues: string[] = [];
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  return { engine, key, tap, pointer, d, pose, flight, cues };
}

describe("menus and engine integration", () => {
  it("initializes the entire world and pure diagnostics", async () => {
    const { engine, d } = await setup();
    const snapshot = d.snapshot(engine.state);
    expect(snapshot).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      mode: "solo",
      score: { p1: 0, p2: 0 },
      ball: { held: true, speed: 0, holdTimer: C.HOLD_TIME },
      simTime: 0,
    });
    expect(snapshot.obstacles).toHaveLength(2);
    const before = JSON.stringify(engine.state);
    expect(engine.diagnostics().every((r) => r.error === undefined)).toBe(true);
    expect(JSON.stringify(d.reconcile(engine.state))).toBe(before);
    expect(JSON.stringify(engine.state)).toBe(before);
    expect(d.menuItemRect(engine.state, -1)).toBeNull();
  });
  it("wraps menus and gives up priority over down and confirm", async () => {
    const { engine, key, tap } = await setup();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(2);
    expect(engine.state.screen).toBe("title");
    key("KeyW", false);
    key("KeyS", false);
    key("Enter", false);
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("ArrowUp");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
  });
  it("counts down, freezes on Escape, and resumes exactly once", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    expect(engine.state.screen).toBe("countdown");
    await tap("Escape");
    const ball = engine.state.ball;
    await engine.advance(3);
    expect(engine.state.ball).toEqual(ball);
    expect(engine.state.screen).toBe("paused");
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    await engine.advance(100);
    expect(engine.state.screen).toBe("playing");
  });
  it("requires matching pointer edges, including edges across frames", async () => {
    const { engine, pointer } = await setup();
    pointer("down", 150, 380);
    await engine.advance(1);
    pointer("up", 150, 455);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    pointer("down", 150, 455);
    await engine.advance(1);
    pointer("up", 150, 455);
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.titleIndex).toBe(1);
  });
  it("accepts a same-frame touch tap and keyboard confirm wins a simultaneous click", async () => {
    const { engine, pointer, key } = await setup();
    pointer("down", 150, 530, "touch");
    pointer("up", 150, 530, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
    pointer("down", 150, 610, "touch");
    pointer("up", 150, 610, "touch");
    await engine.advance(1);
    key("KeyS");
    await engine.advance(1);
    key("KeyS", false);
    pointer("down", 150, 455);
    pointer("up", 150, 455);
    key("Enter");
    await engine.advance(1);
    expect(engine.state.mode).toBe("solo");
  });
  it("restarts and quits through pause, preserving title selection", async () => {
    const { engine, tap, d, pose } = await setup();
    await tap("KeyS");
    await tap("Enter");
    pose((s) => d.setScore(s, 7, 6));
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.score.p1).toBe(0);
    expect(engine.state.mode).toBe("versus");
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.mode).toBe("solo");
  });
  it("mirrors mute poses and key toggles into the runtime cue bus", async () => {
    const { engine, d, pose, flight, tap } = await setup();
    pose((s) => d.setMuted(s, true));
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    const gains: number[] = [];
    engine.events.on("cue:played", (e) => gains.push(e.gain));
    flight(300, C.BALL_R + 1, 0, -500);
    await engine.advance(1);
    expect(gains).toEqual([0]);
    await tap("KeyM");
    expect(engine.state.muted).toBe(false);
  });
});

describe("simulation", () => {
  it("serves at the exact threshold without moving on the serve frame", async () => {
    const { engine, d, pose } = await setup();
    pose((s) => d.setScreen(s, "countdown"));
    pose((s) => d.setBallHoldTimer(s, 0.01));
    pose((s) => d.setBallServeSign(s, -1));
    await engine.advance(1);
    expect(engine.state.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: false,
      holdTimer: 0,
      serveSign: -1,
    });
    expect(engine.state.ball?.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(engine.state.ball?.trail).toHaveLength(1);
  });
  it("moves both players independently and clamps actual driven velocity", async () => {
    const { engine, key, pose, d } = await setup();
    pose((s) => d.setScreen(s, "countdown"));
    pose((s) => d.setMode(s, "versus"));
    key("KeyW");
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY - C.PADDLE_SPEED * 0.01,
    );
    expect(engine.state.paddles.right.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.01,
    );
    pose((s) => d.setPaddleCy(s, "left", C.PADDLE_MIN_CY + 2));
    pose((s) => d.setPaddleVy(s, "left", -400));
    pose((s) => d.setPaddleDriven(s, "left", true));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(-200);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(-400);
  });
  it("maps arrows to the human in Solo and gates AI faculties independently", async () => {
    const { engine, key, pose, d, flight } = await setup();
    flight(900, 600, 500, 0);
    pose((s) => d.setMode(s, "solo"));
    key("ArrowUp");
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(-C.PADDLE_SPEED);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s) => d.setAiMovement(s, true));
    pose((s) => d.setAiTracking(s, false));
    pose((s) => d.setPaddleCy(s, "right", 500));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
  it("adds spin from an integrated paddle hit and accelerates only on that hit", async () => {
    const { engine, flight, pose, d, cues } = await setup();
    flight(C.P1_X1 + C.BALL_R + 1, C.FIELD_CY + 1, -500, 0);
    pose((s) => d.setPaddleDriven(s, "left", true));
    pose((s) => d.setPaddleVy(s, "left", 100));
    await engine.advance(1);
    const b = engine.state.ball!;
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(500 * C.SPEED_MULT);
    expect(b.spin).toBeGreaterThan(80);
    expect(cues).toEqual([C.CUES.paddleHit]);
  });
  it("resolves paddle end caps without changing speed or adding spin", async () => {
    const { engine, flight, cues } = await setup();
    flight(
      (C.P1_X0 + C.P1_X1) / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      500,
    );
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBe(-500);
    expect(engine.state.ball?.spin).toBe(0);
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
  it.each([0, 1])("reflects from obstacle %i at cap speed", async (index) => {
    const { engine, flight, pose, d, cues } = await setup();
    const o = C.OBSTACLES[index];
    flight(o.x0 - C.BALL_R - 1, (o.y0 + o.y1) / 2, C.SPEED_CAP, 0);
    pose((s) => d.spawnObstacle(s, index));
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBe(-C.SPEED_CAP);
    expect(cues).toEqual([C.CUES.obstacleBounce]);
  });
  it("rotates without changing speed and halves spin in one half-life", async () => {
    const { engine, flight } = await setup();
    flight(400, 360, 200, 0, 200);
    await engine.advance(C.SPIN_HALFLIFE / 0.01);
    const b = engine.state.ball!;
    expect(b.spin).toBeCloseTo(100, 6);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(200, 6);
    expect(b.vy).toBeGreaterThan(0);
    expect(
      b.trail.every((p) => engine.state.simTime - p.t <= C.TRAIL_TIME),
    ).toBe(true);
  });
  it("scores only once fully past the goal, parks, and serves to the receiver", async () => {
    const { engine, flight, cues } = await setup();
    flight(C.FIELD_W + C.BALL_R - 1, 100, 200, 0);
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(1);
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.ball?.trail).toEqual([]);
    expect(cues).toEqual([C.CUES.score]);
    await engine.advance(100);
    expect(engine.state.ball?.vx).toBeGreaterThan(0);
  });
  it("requires a two-point lead and allows replay and menu after a win", async () => {
    const { engine, flight, pose, d, tap } = await setup();
    flight(C.FIELD_W + C.BALL_R, 100, 200, 0);
    pose((s) => d.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    flight(C.FIELD_W + C.BALL_R, 100, 200, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    expect(engine.state.score.p1).toBe(12);
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    flight(-C.BALL_R, 100, -200, 0);
    pose((s) => d.setScore(s, 0, 10));
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
  });
  it("agrees on spin and speed with 2 ms and 16 ms steps", async () => {
    const results = [];
    for (const step of [2, 16]) {
      const { engine, flight } = await setup(step);
      flight(600, 60, 600, -80, 400);
      await engine.advance(800 / step);
      results.push(engine.state.ball!);
    }
    expect(Math.hypot(results[0].vx, results[0].vy)).toBeCloseTo(
      Math.hypot(results[1].vx, results[1].vy),
      6,
    );
    expect(results[0].spin).toBeCloseTo(results[1].spin, 6);
    expect(Math.sign(results[0].vx)).toBe(Math.sign(results[1].vx));
    expect(Math.sign(results[0].vy)).toBe(Math.sign(results[1].vy));
  });
});

describe("debug contract", () => {
  it("poses fields independently and never mutates old state", async () => {
    const { engine, pose, d } = await setup();
    const old = d.snapshot(engine.state);
    pose((s) => d.setPaddleDriven(s, "right", true));
    pose((s) => d.setPaddleVy(s, "right", 123));
    pose((s) => d.setPaddleCy(s, "right", 99));
    pose((s) => d.setWinner(s, "right"));
    pose((s) => d.setTitleIndex(s, 2));
    pose((s) => d.setMenuIndex(s, 1));
    pose((s) => d.setResumeScreen(s, "countdown"));
    pose((s) => d.setReceiver(s, "right"));
    const result = d.snapshot(engine.state);
    expect(result.paddles.right).toEqual({
      cy: 99,
      vy: 0,
      driven: true,
      drivenVy: 123,
    });
    expect(result.titleIndex).toBe(2);
    expect(old.paddles.right.cy).toBe(C.FIELD_CY);
    pose((s) => d.reset(s));
    expect(d.snapshot(engine.state)).toMatchObject({
      simTime: 0,
      winner: null,
      titleIndex: 0,
      paddles: { right: { driven: false, drivenVy: 0 } },
    });
  });
  it("handles absent entities, validates obstacle indices, and draws fresh serve signs", async () => {
    const { engine, pose, d } = await setup();
    pose((s) => d.clearWorld(s));
    pose((s) => d.setScreen(s, "playing"));
    await engine.advance(1);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    expect(() => d.setBallVelocity(engine.state, 1, 2)).toThrow(/absent/);
    expect(() => d.spawnObstacle(engine.state, 2)).toThrow(/index/);
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
    pose((s) => d.spawnObstacle(s, 1));
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.spawnObstacle(s, 1));
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    pose((s) => d.spawnBall(s));
    const signs = new Set<number>();
    for (let i = 0; i < 100; i++) {
      pose((s) => d.drawBallServeSign(s));
      signs.add(engine.state.ball!.serveSign);
    }
    expect(signs.size).toBe(2);
  });
});
