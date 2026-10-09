import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, MenuRect, StateView } from "./game";
import { startMatch, title } from "./world";

export function menuItems(s: StateView): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: StateView, index: number): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  if (s.screen === "title")
    return { x: 100, y: 356 + index * 74, w: 380, h: 60 };
  if (s.screen === "howto") return { x: 100, y: 580, w: 380, h: 60 };
  return { x: 440, y: 366 + index * 74, w: 400, h: 60 };
}
function confirm(s: StateView): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : title(s);
    default:
      return s;
  }
}
export function readInput(state: StateView, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  api.input.pointer();
  let s: CaromState = {
    ...state,
    muted: edges.mute ? !state.muted : state.muted,
  };
  api.audio.setMuted(s.muted);
  if (s.screen === "playing" || s.screen === "countdown") {
    return edges.pause
      ? {
          ...s,
          resumeScreen: s.screen,
          screen: "paused",
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  }
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return title(s);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  const moved = up || down;
  if (moved)
    s = { ...s, menuIndex: (s.menuIndex + (up ? -1 : 1) + count) % count };
  // Only the screen present at the beginning of this update reads input.
  if (!moved && edges.confirm) return confirm(s);
  const presses = { ...s.menuPresses };
  const hit = (x: number, y: number): number => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(state, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  let activation = -1;
  for (const sample of samples) {
    const index = hit(sample.x, sample.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (sample.type === "down" && sample.button === "primary")
      presses[sample.id] = index;
    if (sample.type === "up") {
      if (index >= 0 && presses[sample.id] === index) activation = index;
      delete presses[sample.id];
    }
  }
  for (const contact of contacts) {
    if (contact.device !== "touch") continue;
    const index = hit(contact.x, contact.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuPresses: presses };
  return activation >= 0 ? confirm({ ...s, menuIndex: activation }) : s;
}
