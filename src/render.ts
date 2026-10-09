import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { StateView } from "./game";
import { menuItemRect, menuItems } from "./menus";

const INK = "#eff7f5",
  MUTED = "#80939e",
  CYAN = "#6bf5d5",
  CORAL = "#ff817a",
  AMBER = "#efbd69";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  label: string,
  x: number,
  y: number,
  size = 16,
  color = INK,
  weight = 500,
  align: CanvasTextAlign = "left",
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size >= 40 ? '"Arial Black", Arial' : "Arial"}, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(label, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function bar(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  glow = true,
): void {
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 8));
  ctx.fill();
  ctx.restore();
}
function orb(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function backdrop(ctx: Context): void {
  const wash = ctx.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    40,
    C.FIELD_CX,
    C.FIELD_CY,
    720,
  );
  wash.addColorStop(0, "#142530");
  wash.addColorStop(1, "#090f18");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.fillStyle = "#23333c";
  for (let x = 32; x < C.FIELD_W; x += 32)
    for (let y = 32; y < C.FIELD_H; y += 32) ctx.fillRect(x, y, 1, 1);
  line(ctx, 32, 24, C.FIELD_W - 32, 24, "#293b46");
  line(ctx, 32, C.FIELD_H - 24, C.FIELD_W - 32, C.FIELD_H - 24, "#293b46");
}
function furniture(s: StateView, ctx: Context): void {
  ctx.save();
  ctx.setLineDash([6, 13]);
  line(ctx, C.NET_X, 112, C.NET_X, C.FIELD_H - 70, "#30414b", 2);
  ctx.restore();
  ctx.strokeStyle = "#263a43";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 72, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    bar(
      ctx,
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      AMBER,
    );
    text(ctx, `0${o.index + 1}`, o.cx + 23, o.cy + 5, 11, "#907956");
  }
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CYAN,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CORAL,
  );
  const b = s.ball;
  if (b) {
    const points = b.trail;
    for (let i = 1; i < points.length; i++) {
      const alpha = i / points.length;
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineCap = "round";
      line(
        ctx,
        points[i - 1].x,
        points[i - 1].y,
        points[i].x,
        points[i].y,
        CYAN,
        C.BALL_R * 1.7 * alpha,
      );
      ctx.restore();
    }
    orb(ctx, b.x, b.y, C.BALL_R, INK);
    if (Math.abs(b.spin) > 30 && !b.held) {
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        C.BALL_R + 6,
        s.simTime * 5,
        s.simTime * 5 + Math.PI * 1.3,
      );
      ctx.stroke();
    }
  }
}
function hud(s: StateView, ctx: Context): void {
  text(ctx, C.TITLE_TEXT, 40, 64, 20, INK, 900);
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN VS MACHINE" : "VERSUS / LOCAL DUEL",
    C.FIELD_CX,
    49,
    11,
    MUTED,
    600,
    "center",
  );
  text(ctx, "PLAYER 01", 490, 55, 11, CYAN, 700, "center");
  text(
    ctx,
    s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
    790,
    55,
    11,
    CORAL,
    700,
    "center",
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    490,
    110,
    48,
    INK,
    900,
    "center",
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    790,
    110,
    48,
    INK,
    900,
    "center",
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    677,
    11,
    MUTED,
    600,
    "center",
  );
  text(ctx, "W / S", 42, 678, 12, CYAN, 700);
  text(
    ctx,
    s.mode === "solo" ? "AI" : "↑ / ↓",
    1238,
    678,
    12,
    CORAL,
    700,
    "right",
  );
  text(ctx, "P  PAUSE", 1240, 57, 11, MUTED, 500, "right");
}
function menus(s: StateView, ctx: Context): void {
  const descriptions = [
    "One player. One worthy opponent.",
    "Two players. One keyboard.",
    "Learn the angles. Find your edge.",
  ];
  menuItems(s).forEach((label, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = i === s.menuIndex;
    ctx.fillStyle = selected ? CYAN : "#12212b";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.strokeStyle = selected ? CYAN : "#2c3e47";
    ctx.lineWidth = 1;
    ctx.stroke();
    text(
      ctx,
      label,
      r.x + 22,
      r.y + (s.screen === "title" ? 25 : 37),
      17,
      selected ? "#0a2826" : INK,
      800,
    );
    if (s.screen === "title")
      text(
        ctx,
        descriptions[i],
        r.x + 22,
        r.y + 45,
        12,
        selected ? "#28584f" : MUTED,
      );
    text(
      ctx,
      selected ? "↗" : "→",
      r.x + r.w - 24,
      r.y + 37,
      24,
      selected ? "#0a2826" : MUTED,
      500,
      "right",
    );
  });
}
function titleArt(ctx: Context): void {
  ctx.save();
  ctx.strokeStyle = "#2c414b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(608, 163, 560, 404, 18);
  ctx.stroke();
  ctx.setLineDash([4, 10]);
  line(ctx, 888, 188, 888, 540, "#30454e");
  ctx.setLineDash([]);
  bar(ctx, 637, 347, 12, 90, CYAN);
  bar(ctx, 1129, 259, 12, 90, CORAL);
  bar(ctx, 815, 232, 16, 104, AMBER);
  bar(ctx, 956, 401, 16, 104, AMBER);
  const path = ctx.createLinearGradient(661, 431, 1060, 310);
  path.addColorStop(0, "#6bf5d500");
  path.addColorStop(1, CYAN);
  ctx.strokeStyle = path;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(660, 430);
  ctx.bezierCurveTo(770, 441, 908, 240, 949, 251);
  ctx.bezierCurveTo(984, 260, 1010, 292, 1060, 310);
  ctx.stroke();
  orb(ctx, 1060, 310, C.BALL_R, INK);
  text(
    ctx,
    "THE ANGLE IS ONLY THE BEGINNING.",
    888,
    605,
    11,
    MUTED,
    700,
    "center",
  );
  text(ctx, "01", 644, 198, 11, CYAN, 600);
  text(ctx, "02", 1135, 198, 11, CORAL, 600, "right");
  ctx.restore();
}
export function render(s: StateView, api: RenderApi): void {
  const ctx = api.ctx;
  backdrop(ctx);
  if (s.screen === "title") {
    text(ctx, "A GAME OF ANGLES & INSTINCT", 100, 145, 12, CYAN, 700);
    text(ctx, C.TITLE_TEXT, 92, 264, 104, INK, 900);
    text(ctx, "Move. Strike. Bend the rally.", 100, 306, 22, MUTED);
    text(ctx, "PADDLE DUEL   /   01", 100, 67, 11, MUTED, 700);
    titleArt(ctx);
    menus(s, ctx);
    text(ctx, "↑ ↓  /  W S  SELECT      ENTER  PLAY", 100, 630, 11, MUTED, 600);
  } else if (s.screen === "howto") {
    text(ctx, "THE PLAYBOOK", 100, 102, 12, CYAN, 700);
    text(ctx, "MAKE IT CURVE.", 96, 173, 58, INK, 900);
    const rows = [
      [
        "01",
        "TAKE YOUR SIDE",
        "Solo: W / S or ↑ / ↓ move your paddle.",
        "Versus: left player W / S, right player ↑ / ↓.",
      ],
      [
        "02",
        "PUT SPIN ON IT",
        "Move your paddle as you strike to bend the ball’s flight.",
        "Hit near an edge for a sharper angle. Every return gets faster.",
      ],
      [
        "03",
        "PLAY THE BANK",
        "The amber obstacles and top / bottom walls return your shot.",
        `Score behind your opponent. First to ${C.WIN_SCORE}, ahead by ${C.WIN_LEAD}, wins.`,
      ],
    ];
    rows.forEach((r, i) => {
      const y = 245 + i * 106;
      text(ctx, r[0], 100, y, 16, CYAN, 700);
      text(ctx, r[1], 153, y, 17, INK, 800);
      text(ctx, r[2], 153, y + 29, 17, MUTED);
      text(ctx, r[3], 153, y + 54, 17, MUTED);
    });
    text(
      ctx,
      "P / ESC  PAUSE     M  SOUND     TOUCH  ON-SCREEN CONTROLS",
      100,
      552,
      12,
      MUTED,
    );
    text(ctx, "ENTER / SPACE  CONFIRM     ESC  BACK", 520, 616, 12, MUTED);
    menus(s, ctx);
  } else {
    furniture(s, ctx);
    hud(s, ctx);
    if (s.screen === "countdown") {
      text(ctx, "GET READY", C.FIELD_CX, 274, 23, INK, 800, "center");
      text(
        ctx,
        `SERVING ${s.receiver === "left" ? "LEFT" : "RIGHT"}`,
        C.FIELD_CX,
        301,
        11,
        CYAN,
        600,
        "center",
      );
      if (s.ball) {
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          C.FIELD_CX,
          C.FIELD_CY,
          29,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * s.ball.holdTimer) / C.HOLD_TIME,
        );
        ctx.stroke();
      }
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#090f18cf";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      ctx.fillStyle = "#101d27";
      ctx.beginPath();
      ctx.roundRect(400, 158, 480, s.screen === "paused" ? 458 : 390, 12);
      ctx.fill();
      ctx.strokeStyle = "#35464e";
      ctx.lineWidth = 1;
      ctx.stroke();
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        208,
        11,
        CYAN,
        700,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : s.winner === "left"
            ? "PLAYER 01 WINS"
            : s.mode === "solo"
              ? "COMPUTER WINS"
              : "PLAYER 02 WINS",
        C.FIELD_CX,
        270,
        s.screen === "paused" ? 52 : 32,
        INK,
        900,
        "center",
      );
      text(
        ctx,
        `${String(s.score.p1).padStart(2, "0")}  :  ${String(s.score.p2).padStart(2, "0")}`,
        C.FIELD_CX,
        321,
        26,
        MUTED,
        700,
        "center",
      );
      menus(s, ctx);
    }
  }
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 40,
    C.FIELD_H - 9,
    10,
    MUTED,
    600,
    "right",
  );
}
