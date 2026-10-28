import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { bundle, exportsOf } from "./simbundle.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const ROOT = (process.argv.find((arg) => arg.startsWith("--root=")) ?? "").slice(7) || "C:/Users/aajin/Downloads/eelf-angular-phaser/eelf-angular-phaser";

const W = 640;
const H = 412;
const AZIMUTH = 58;
const ELEVATION = 34;

const PLATE = { x: -152, y: -114, w: 334, d: 228, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;
const DECK = { x: -140, y: -50, w: 314, d: 146, r: 6 };
const DECK_H = 4;

const WORLD = { w: 1280, h: 800 };
const FLOOR = { x: -84, y: -28, w: 160, d: 100, r: 0 };
const PER = FLOOR.w / WORLD.w;
const CELL = 96 * PER;
const TRAY = { x: -90, y: -34, w: 172, d: 112, r: 4 };
const PLINTH = { x: -88, y: -32, w: 168, d: 108, r: 3 };
const Z = { deck: DECK_H, plinth: 10, floor: 13, wall: 20 };

const HOUSE = { x: 96, y: -30, w: 72, d: 92, r: 5 };
const HOUSE_TOP = 40;
const BRIDGE = { x: 102, y: -24, w: 60, d: 80, r: 3 };
const BRIDGE_TOP = 41.4;
const WC = [130, 6];
const TEETH = 30;
const TIP = 15;
const ROOT_R = 12.4;
const WHEEL_Z = 44;
const WHEEL_H = 0.9;
const ANCHOR_Z = WHEEL_Z + WHEEL_H + 0.3;
const ANCHOR_H = 1.2;
const AP = [130, 30];
const PALLET = (40 * Math.PI) / 180;
const BRAKE_REST = WC[0] + TIP + 6;
const BRAKE_HELD = WC[0] + TIP;
const DIAL = [146, 42];
const DIAL_R = 12;
const KNOB_R = 4;
const KNOB_TOP = BRIDGE_TOP + 0.8 + 3;
const SPEEDS = [1, 2, 4];
const SPEED_ANGLE = { 1: -0.75, 2: 0, 4: 0.75 };

const POST = [-104, 22];
const JBOX = { x: -118, y: 10, w: 26, d: 24, r: 2 };
const JBOX_TOP = 16;
const ARM_Z = 50;
const CAM = { x: -16, y: 12, w: 20, d: 20, r: 3 };
const LENS = [-6, 22];
const HOPPER = [-116, 64];

const RAILS = [-104, -80];
const RAIL_X = 132;
const TRAVEL = 80;
const REST_C = 40;
const CAR = { x: REST_C - 84, y: -108, w: 168, d: 40, r: 3 };
const CAR_Z = 3;
const CAR_TOP = 7;
const FRONT_Y = -82;
const MONITORS = [
  { id: "a", name: "Angular", cx: REST_C - 40, r: 3 },
  { id: "p", name: "Phaser", cx: REST_C + 40, r: 9 },
];
const CASE_TOP = 62;
const BEZEL = { dx: 29, z0: 17, z1: 58, r: 4, depth: 1.2 };
const GLASS = { dx: 25, z0: 20, z1: 20 + (50 * WORLD.h) / WORLD.w, r: 3, depth: 3 };
const LEDGE_TOP = 12;
const BUTTONS = ["run", "step", "speed", "feed", "restart"];
const BUTTON_DOWN = 0.9;
const DOCK = { x: -10, y: -64, w: 20, d: 12, r: 2 };
const DOCK_TOP = 9;
const MOVE = [-TRAVEL, 0, 0];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-113, -106, CASE_TOP],
    [113, -106, CASE_TOP],
    [-113, -82, CASE_TOP],
    [113, -82, CASE_TOP],
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => Math.round(v * 100) / 100;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const shift = (plan, dx) => ({ ...plan, x: plan.x + dx });

const R = A.recorder(P, { order: ["carriage"], spring: SPRING });
const record = R.solid;
function put(name, ref, svg, shapes = [], { piece = "bench", bias = 0, attrs = "", ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece, move: piece === "carriage" ? MOVE : [0, 0, 0], attrs, ...rest });
}
function slab(name, plan, z, h, style = {}, { steps = 4, bevel = 0, inner = "", extra = "", ...opts } = {}) {
  const shape = record(A.slab(plan, z, h, { name }, steps));
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], opts);
  return shape;
}
function cyl(name, cx, cy, r, z, h, style = {}, { steps = 28, bevel = 0, inner = "", extra = "", ...opts } = {}) {
  const shape = record(A.cylinder(cx, cy, r, z, h, { name }));
  put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], opts);
  return shape;
}
function along(name, F, s0, s1, r, style = {}, { extra = "", inner = "", ...opts } = {}) {
  const shape = record(A.disc(F, s0, s1, r, { name }));
  put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel: 0.2 }), { tone: "mid", ...style, inner }) + extra, [shape], opts);
  return shape;
}
const screws = (points, z, { ring = 1.6, size = 0.45 } = {}) => Ln(points.map(([x, y]) => k.ring(x, y, ring, z, P, 14)).join(""), { tone: "lo" }) + Dots(points.map(([x, y]) => at([x, y, z])), { size });

const CABLES = [];
function cable(name, points, r, { tone = "mid", bend = 4, shells = [false, true], clamps = [], ...opts } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(2, r * 2.4);
  const clampAt = clamps.map((cx) => {
    let walked = 0;
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]];
      const len = G.len3(G.sub3(b, a));
      if ((a[0] - cx) * (b[0] - cx) <= 0 && Math.abs(b[0] - a[0]) > 1e-6) return { s: walked + (len * (cx - a[0])) / (b[0] - a[0]), p: G.lerp3(a, b, (cx - a[0]) / (b[0] - a[0])) };
      walked += len;
    }
    throw new Error("clamp off route " + cx);
  });
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...clampAt.map(({ s }) => [s - 1.5, s + 1.5]), ...(shells[1] ? [[total - SHELL, total]] : [])];
  clampAt.forEach(({ p }, index) => {
    const plan = { x: p[0] - 1.5, y: p[1] - 2.2, w: 3, d: 4.4, r: 0.6 };
    const shape = record(A.slab(plan, 0, p[2] + r + 0.6, { name: `${name}.clamp${index}`, owner: name, fitting: true }, 2));
    put(`${name}.clamp${index}`, [p[0], p[1], (p[2] + r) / 2], S(k.slabOf(plan, 0, p[2] + r + 0.6, P, 2, 0.2), { tone: "mid" }) + Dots([at([p[0], p[1] + 1.4, p[2] + r + 0.6])], { size: 0.34 }), [shape], { bias: 0.2 });
  });
  R.route(name, route, r, { gaps, limp: true, rims: shells.map((on) => (on ? r * 1.8 : r)), piece: "bench" });
  CABLES.push(name);
  tubePieces(route, r, P, { maxLength: 14, spacing: 1.2, gaps }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii)], { bias: 0.05, route: name, chunk: index, attrs: ` data-chunk="${index}"`, ...opts }),
  );
  [0, 1].forEach((index) => {
    if (!shells[index]) return;
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const shape = record(A.disc(F, s0, s1, r * 1.8, { name: `${name}.shell${index}`, owner: name }));
    put(`${name}.shell${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 1.8, F, P, { steps: 24, bevel: 0.2 }), { tone: "mid" }) + (index ? "" : ""), [shape], { bias: 0.15 });
  });
  return route;
}

const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
back.push(screws(k.corners(PLATE, 10), 0, { ring: 2.2, size: 0.5 }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }, 8));
const STRIP = { x: PLATE.x + 30, y: PLATE.y + PLATE.d - 13, w: PLATE.w - 120, d: 6, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y, 0.6, [1.8, 3.4], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3, 0.6])], { size: 0.45 }));
const LABEL = { x: PLATE.x + PLATE.w - 78, y: PLATE.y + PLATE.d - 18, w: 44, d: 12, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(Ln([26, 18, 22].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 3.2 + i * 2.8], [LABEL.x + 4 + w, LABEL.y + 3.2 + i * 2.8], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w - 3.4, LABEL.y + 3.4, 0.8]), at([LABEL.x + LABEL.w - 3.4, LABEL.y + LABEL.d - 3.4, 0.8])], { size: 0.45 }));

back.push(`<path class="iso-halo" d="${k.haloOf(DECK, 0, DECK_H, P)}" style="opacity:calc(var(--anatomy-halo-opacity) * .5)"/>`);
back.push(S(k.slabOf(DECK, 0, DECK_H, P, 6, 0.8), { tone: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(DECK, 3.5), DECK_H, P, 6), { tone: "faint" }));
back.push(screws(k.corners(DECK, 8), DECK_H));
record(A.slab(DECK, 0, DECK_H, { name: "stand.deck", ground: true }, 6));

for (const y of RAILS) {
  const plan = { x: -RAIL_X, y, w: RAIL_X * 2, d: 5, r: 1 };
  slab(`rail${y}`, plan, 0, 3, {}, { steps: 3, bevel: 0.4, extra: Dots([-RAIL_X + 6, -60, 60, RAIL_X - 6].map((x) => at([x, y + 2.5, 3])), { size: 0.4 }) });
}
for (const x of [-RAIL_X - 5, RAIL_X]) {
  slab(`stop${x}`, { x, y: RAILS[0] - 2, w: 5, d: RAILS[1] - RAILS[0] + 9, r: 1.2 }, 0, 9, {}, { steps: 3, bevel: 0.5, extra: Dots([at([x + 2.5, RAILS[0] + 2.5, 9]), at([x + 2.5, RAILS[1] + 2.5, 9])], { size: 0.45 }) });
}
{
  const rule = { x: -60, y: RAILS[1] + 5, w: 120, d: 3, r: 0.6 };
  const t = k.topTicks(rule.x + 2, rule.x + rule.w - 2, 4, 5, rule.y, 0.5, [1.2, 2.2], P);
  slab("rail.rule", rule, 0, 0.5, { tone: "lo", crease: "none" }, { steps: 2, extra: Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) });
}

{
  const car = "carriage";
  slab("car.plate", CAR, CAR_Z, CAR_TOP - CAR_Z, {}, { piece: car, steps: 5, bevel: 0.6, inner: Ln(k.sideSeam(CAR, 5, P, 5), { tone: "faint" }), extra: Dots([-70, -30, 30, 70].map((dx) => at([REST_C + dx, CAR.y + CAR.d - 2.4, CAR_TOP])), { size: 0.4, tone: "lo" }) + screws([-82, 74].flatMap((dx) => RAILS.flatMap((y) => [[REST_C + dx + 4, y + 0.6], [REST_C + dx + 4, y + 4.4]])), CAR_TOP, { ring: 0.8, size: 0.36 }), attrs: " data-car" });
  for (const dx of [-82, 74]) for (const y of RAILS) {
    for (const [y0, side] of [[y - 2.5, "a"], [y + 5, "b"]]) {
      slab(`car.bush${dx}${y}${side}`, { x: REST_C + dx, y: y0, w: 8, d: 2.5, r: 0.6 }, 0.4, CAR_Z - 0.4, {}, { piece: car, steps: 2, bevel: 0.2, attrs: " data-car" });
    }
  }
  for (const m of MONITORS) {
    const pad = { x: m.cx - 6, y: CAR.y + CAR.d, w: 12, d: 1.6, r: 0.4 };
    slab(`car.pad.${m.id}`, pad, CAR_Z + 0.6, 11 - CAR_Z - 0.6, { tone: "hi" }, { piece: car, steps: 2, bevel: 0.2, extra: Dots([at([m.cx - 3.6, pad.y + pad.d, 9.6]), at([m.cx + 3.6, pad.y + pad.d, 9.6])], { size: 0.36 }), attrs: ` data-car data-pad="${m.id}"` });
  }
}

function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "el-well", inside = "", id) {
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

for (const m of MONITORS) {
  const car = "carriage";
  const x = m.cx;
  const tag = ` data-car data-mon="${m.id}"`;
  slab(`mon.${m.id}.plinth`, { x: x - 30, y: -104, w: 60, d: 20, r: 2 }, CAR_TOP, 3, { tone: "lo" }, { piece: car, steps: 3, attrs: tag });
  const CASE = { x: x - 33, y: FRONT_Y - 24, w: 66, d: 24, r: m.r };
  const vents = m.id === "p"
    ? Ln(Array.from({ length: 9 }, (_, i) => k.planOutline({ x: x - 22 + i * 5, y: CASE.y + 5, w: 1.6, d: 13, r: 0.8 }, CASE_TOP, P, 3)).join(""), { tone: "faint" })
    : Ln(k.planOutline({ x: x - 20, y: CASE.y + 7, w: 40, d: 9, r: 4.5 }, CASE_TOP, P, 6) + k.planOutline({ x: x - 17.8, y: CASE.y + 9.2, w: 35.6, d: 4.6, r: 2.3 }, CASE_TOP, P, 6), { tone: "faint" });
  const bezel = { x0: x - BEZEL.dx, x1: x + BEZEL.dx, z0: BEZEL.z0, z1: BEZEL.z1, r: BEZEL.r, depth: BEZEL.depth };
  const glass = { x0: x - GLASS.dx, x1: x + GLASS.dx, z0: GLASS.z0, z1: GLASS.z1, r: GLASS.r, depth: GLASS.depth };
  const screen = `<g data-screen="${m.id}"><g data-crt></g></g><path class="el-beam" data-beam d="M${x - GLASS.dx + 3} ${-(GLASS.z0 + GLASS.z1) / 2}H${x + GLASS.dx - 3}" style="opacity:0"/><circle class="el-dot" data-dot cx="${x}" cy="${-(GLASS.z0 + GLASS.z1) / 2}" r="1.2" style="opacity:0"/>`;
  const face = recess(bezel, FRONT_Y, "", "el-bezel", recess(glass, FRONT_Y - BEZEL.depth, screen, `el-glass`, "", `el-clip-${m.id}-g`), `el-clip-${m.id}-b`);
  const seam = Ln(k.sideSeam(CASE, 14, P, m.r > 4 ? 8 : 4), { tone: "faint" });
  const led = Ln(k.sideRing([x + 26, FRONT_Y, 13.4], 1.4, "y", P, 16), { tone: "lo" }) + `<g data-led="${m.id}">${Dots([at([x + 26, FRONT_Y, 13.4])], { size: 0.75, tone: "hi" })}</g>`;
  const shape = record(A.slab(CASE, 10, CASE_TOP - 10, { name: `mon.${m.id}.case` }, m.r > 4 ? 8 : 4));
  put(`mon.${m.id}.case`, [x, CASE.y + CASE.d / 2, 36], S(k.slabOf(CASE, 10, CASE_TOP - 10, P, m.r > 4 ? 8 : 4, 1.2), { tone: "mid", inner: seam }) + vents + face + led + screws([[x - 29, CASE.y + 3], [x + 29, CASE.y + 3]], CASE_TOP, { ring: 1.2, size: 0.4 }), [shape], { piece: car, attrs: tag + ` data-glass="${m.id}"` });
  const LEDGE = { x: x - 31, y: FRONT_Y, w: 62, d: 12, r: 1.6 };
  slab(`mon.${m.id}.ledge`, LEDGE, CAR_TOP, LEDGE_TOP - CAR_TOP, {}, { piece: car, steps: 3, bevel: 0.5, extra: Ln(k.planOutline({ x: x - 29, y: FRONT_Y + 2, w: 58, d: 8, r: 1.2 }, LEDGE_TOP, P, 3), { tone: "faint" }), attrs: tag });
  BUTTONS.forEach((button, i) => {
    const plan = { x: x - 27.4 + i * 11.2, y: FRONT_Y + 2.8, w: 8.4, d: 6.4, r: 1.4 };
    const name = `mon.${m.id}.btn.${button}`;
    const shapeB = record(A.slab(plan, LEDGE_TOP, 2.2, { name }, 3));
    const glyph = {
      run: k.onTop([[plan.x + 3, plan.y + 1.6], [plan.x + 6, plan.y + 3.2], [plan.x + 3, plan.y + 4.8]], LEDGE_TOP + 2.2, P, true),
      step: k.onTop([[plan.x + 2.6, plan.y + 1.8], [plan.x + 5, plan.y + 3.2], [plan.x + 2.6, plan.y + 4.6]], LEDGE_TOP + 2.2, P, true) + k.lineOnTop([plan.x + 5.8, plan.y + 1.8], [plan.x + 5.8, plan.y + 4.6], LEDGE_TOP + 2.2, P),
      speed: k.onTop([[plan.x + 1.8, plan.y + 1.8], [plan.x + 4, plan.y + 3.2], [plan.x + 1.8, plan.y + 4.6]], LEDGE_TOP + 2.2, P, true) + k.onTop([[plan.x + 4.2, plan.y + 1.8], [plan.x + 6.4, plan.y + 3.2], [plan.x + 4.2, plan.y + 4.6]], LEDGE_TOP + 2.2, P, true),
      feed: [[3.2, 2.4], [5.2, 2.4], [4.2, 4.2]].map(([u, v]) => k.ring(plan.x + u, plan.y + v, 0.45, LEDGE_TOP + 2.2, P, 8)).join(""),
      restart: k.onTop(Array.from({ length: 13 }, (_, j) => { const a = 0.5 + (j / 12) * 4.6; return [plan.x + 4.2 + Math.cos(a) * 1.6, plan.y + 3.2 + Math.sin(a) * 1.6]; }), LEDGE_TOP + 2.2, P) + k.onTop([[plan.x + 4.2 + Math.cos(5.1) * 1.6 - 0.9, plan.y + 3.2 + Math.sin(5.1) * 1.6 - 0.5], [plan.x + 4.2 + Math.cos(5.1) * 1.6, plan.y + 3.2 + Math.sin(5.1) * 1.6], [plan.x + 4.2 + Math.cos(5.1) * 1.6 + 0.3, plan.y + 3.2 + Math.sin(5.1) * 1.6 - 1.1]], LEDGE_TOP + 2.2, P),
    }[button];
    put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, LEDGE_TOP + 1.1], `<g data-press>${S(k.slabOf(plan, LEDGE_TOP, 2.2, P, 3, 0.4), { tone: "mid" })}${Ln(glyph, { tone: "lo" })}</g>`, [shapeB], { piece: car, attrs: tag + ` data-btn="${button}"` });
  });
}

slab("dock", DOCK, 0, DOCK_TOP, {}, { steps: 3, bevel: 0.6, extra: screws([[DOCK.x + 3.4, DOCK.y + 8.6], [DOCK.x + DOCK.w - 3.4, DOCK.y + 8.6]], DOCK_TOP, { ring: 1.1, size: 0.4 }) + Ln(k.sideRing([DOCK.x + DOCK.w / 2, DOCK.y + DOCK.d, 5.4], 1.5, "y", P, 18), { tone: "lo" }) + `<g data-dock-led>${Dots([at([DOCK.x + DOCK.w / 2, DOCK.y + DOCK.d, 5.4])], { size: 0.8, tone: "hi" })}</g>` + Ln(k.segment([DOCK.x, DOCK.y + DOCK.d, 3.2], [DOCK.x + DOCK.w, DOCK.y + DOCK.d, 3.2], P), { tone: "faint" }) });
slab("dock.finger", { x: -3, y: CAR.y + CAR.d + 1.6, w: 6, d: DOCK.y + 4 - (CAR.y + CAR.d + 1.6), r: 0.5 }, DOCK_TOP, 0.8, { tone: "hi" }, { steps: 2, extra: Dots([at([0, DOCK.y + 2, DOCK_TOP + 0.8])], { size: 0.4 }) });

const trayParts = [];
{
  slab("tray.plinth", PLINTH, Z.deck, Z.plinth - Z.deck, { tone: "lo" }, { steps: 4 });
  slab("tray.floor", TRAY, Z.plinth, Z.floor - Z.plinth, {}, { steps: 6, bevel: 0.5 });
  const grid = [];
  for (let i = 1; FLOOR.x + i * CELL < FLOOR.x + FLOOR.w - 0.5; i++) grid.push(k.lineOnTop([FLOOR.x + i * CELL, FLOOR.y], [FLOOR.x + i * CELL, FLOOR.y + FLOOR.d], Z.floor, P));
  for (let j = 1; FLOOR.y + j * CELL < FLOOR.y + FLOOR.d - 0.5; j++) grid.push(k.lineOnTop([FLOOR.x, FLOOR.y + j * CELL], [FLOOR.x + FLOOR.w, FLOOR.y + j * CELL], Z.floor, P));
  const specimens = record(A.slab(FLOOR, Z.floor, 0.6, { name: "tray.specimens" }, 2));
  put("tray.specimens", [FLOOR.x + FLOOR.w / 2, FLOOR.y + FLOOR.d / 2, Z.floor + 0.3], Ln(grid.join(""), { tone: "faint" }) + `<g data-part="food"></g><g data-part="eels"></g>`, [specimens]);
  const walls = [
    ["back", { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 6, r: 1.6 }],
    ["left", { x: TRAY.x, y: TRAY.y + 6, w: 6, d: TRAY.d - 12, r: 0.8 }],
    ["right", { x: TRAY.x + TRAY.w - 6, y: TRAY.y + 6, w: 6, d: TRAY.d - 12, r: 0.8 }],
    ["front", { x: TRAY.x, y: TRAY.y + TRAY.d - 6, w: TRAY.w, d: 6, r: 1.6 }],
  ];
  for (const [side, plan] of walls) {
    const long = plan.w > plan.d;
    const dots = long ? [plan.x + 3, plan.x + plan.w / 2, plan.x + plan.w - 3].map((x) => [x, plan.y + 3]) : [[plan.x + 3, plan.y + plan.d / 2]];
    slab(`tray.wall.${side}`, plan, Z.floor, Z.wall - Z.floor, {}, { steps: 3, bevel: 0.4, extra: screws(dots, Z.wall, { ring: 1.1, size: 0.4 }) });
  }
}

{
  slab("house", HOUSE, DECK_H, HOUSE_TOP - DECK_H, {}, { steps: 6, bevel: 1.2, inner: Ln(k.sideSeam(HOUSE, 30, P, 6), { tone: "faint" }) + Ln(k.sideSeam(HOUSE, 10, P, 6), { tone: "faint" }), extra: [
    `<g transform="${planeOf(HOUSE.y + HOUSE.d)}">${Ln(Array.from({ length: 8 }, (_, i) => flat(HOUSE.x + 30 + i * 4.4, 14, HOUSE.x + 31.6 + i * 4.4, 26, 0.8, 4)).join(""), { tone: "lo" })}</g>`,
    `<g transform="${planeOf(HOUSE.y + HOUSE.d)}">${Ln(flat(HOUSE.x + 6, 14, HOUSE.x + 24, 26, 1.2, 3), { tone: "lo" })}${Ln(`M${HOUSE.x + 8.6} -22.4H${HOUSE.x + 19}M${HOUSE.x + 8.6} -20H${HOUSE.x + 16.6}M${HOUSE.x + 8.6} -17.6H${HOUSE.x + 18}`, { tone: "lo", free: true })}</g>`,
    Dots([at([HOUSE.x + 22, HOUSE.y + HOUSE.d, 16]), at([HOUSE.x + 22, HOUSE.y + HOUSE.d, 24])], { size: 0.4 }),
    Ln(k.pathOf(k.roundedPlan({ x: HOUSE.y + 10, y: 13, w: HOUSE.d - 26, d: 14, r: 2 }, 4).map(([y, z]) => at([HOUSE.x + HOUSE.w, y, z])), true), { tone: "lo" }),
    Ln(k.pathOf(k.roundedPlan({ x: HOUSE.y + 12, y: 15, w: HOUSE.d - 30, d: 10, r: 1.2 }, 4).map(([y, z]) => at([HOUSE.x + HOUSE.w, y, z])), true), { tone: "faint" }),
    Dots([[HOUSE.y + 13, 15.6], [HOUSE.y + HOUSE.d - 19, 15.6], [HOUSE.y + 13, 24.4], [HOUSE.y + HOUSE.d - 19, 24.4]].map(([y, z]) => at([HOUSE.x + HOUSE.w, y, z])), { size: 0.4 }),
  ].join("") });
  const HINGE = G.frameOf([HOUSE.x + HOUSE.w + 1, 0, 27.6], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  along("house.hinge.a", HINGE, HOUSE.y + 14, HOUSE.y + 22, 1);
  along("house.hinge.b", HINGE, HOUSE.y + HOUSE.d - 28, HOUSE.y + HOUSE.d - 20, 1);
  slab("house.bridge", BRIDGE, HOUSE_TOP, BRIDGE_TOP - HOUSE_TOP, { tone: "lo" }, { steps: 3, extra: screws(k.corners(BRIDGE, 4), BRIDGE_TOP, { ring: 1.2, size: 0.42 }) });
  cyl("esc.arbor", WC[0], WC[1], 1.8, BRIDGE_TOP, WHEEL_Z - BRIDGE_TOP, {}, { steps: 16 });
  const wheel = record(A.cylinder(WC[0], WC[1], TIP, WHEEL_Z, WHEEL_H, { name: "esc.wheel" }));
  put("esc.wheel", [WC[0], WC[1], WHEEL_Z + 0.7], `<g data-part="wheel">${wheelSvg(0)}</g>`, [wheel]);
  cyl("esc.cap", WC[0], WC[1], 2.2, WHEEL_Z + WHEEL_H, 0.8, {}, { steps: 16, extra: Dots([at([WC[0], WC[1], WHEEL_Z + WHEEL_H + 0.8])], { size: 0.45 }) });
  cyl("esc.pivot", AP[0], AP[1], 1.8, BRIDGE_TOP, ANCHOR_Z - BRIDGE_TOP, {}, { steps: 16 });
  const anchor = record(A.extruded(anchorRing(0), ANCHOR_Z, ANCHOR_H, { name: "esc.anchor" }));
  put("esc.anchor", [AP[0], AP[1] - 6, ANCHOR_Z + ANCHOR_H / 2], `<g data-part="anchor">${anchorSvg(0)}</g>`, [anchor], { bias: 0.4 });
  cyl("esc.anchorcap", AP[0], AP[1], 2, ANCHOR_Z + ANCHOR_H, 0.8, {}, { steps: 16, extra: Dots([at([AP[0], AP[1], ANCHOR_Z + ANCHOR_H + 0.8])], { size: 0.45 }) });
  slab("brake.guide", { x: BRAKE_REST + 3.6, y: WC[1] - 7, w: 7, d: 14, r: 1 }, BRIDGE_TOP, 4.6, {}, { steps: 3, bevel: 0.3, extra: Dots([at([BRAKE_REST + 7.1, WC[1] - 4, BRIDGE_TOP + 4.6]), at([BRAKE_REST + 7.1, WC[1] + 4, BRIDGE_TOP + 4.6])], { size: 0.4 }) });
  const shoe = record(A.slab({ x: BRAKE_REST, y: WC[1] - 4, w: 3.6, d: 8, r: 0.6 }, WHEEL_Z - 0.6, 2.6, { name: "brake.shoe" }, 2));
  put("brake.shoe", [BRAKE_REST + 1.8, WC[1], WHEEL_Z + 0.7], `<g data-part="shoe">${S(k.slabOf({ x: BRAKE_REST, y: WC[1] - 4, w: 3.6, d: 8, r: 0.6 }, WHEEL_Z - 0.6, 2.6, P, 2, 0.3), { tone: "mid" })}</g>`, [shoe], { bias: 0.3 });
  const face = record(A.cylinder(DIAL[0], DIAL[1], DIAL_R, BRIDGE_TOP, 0.8, { name: "speed.face" }));
  const marks = SPEEDS.map((s) => {
    const a = SPEED_ANGLE[s];
    return `<path class="iso-line" data-tone="mid" data-mark="${s}" d="${k.lineOnTop([DIAL[0] + Math.sin(a) * 8.4, DIAL[1] - Math.cos(a) * 8.4], [DIAL[0] + Math.sin(a) * (DIAL_R - 0.4), DIAL[1] - Math.cos(a) * (DIAL_R - 0.4)], BRIDGE_TOP + 0.8, P)}"/>`;
  });
  const pips = SPEEDS.map((s, i) => {
    const a = SPEED_ANGLE[s];
    const n = i + 1;
    return Array.from({ length: n }, (_, j) => at([DIAL[0] + Math.sin(a + (j - (n - 1) / 2) * 0.16) * 6.6, DIAL[1] - Math.cos(a + (j - (n - 1) / 2) * 0.16) * 6.6, BRIDGE_TOP + 0.8]));
  }).flat();
  put("speed.face", [DIAL[0], DIAL[1], BRIDGE_TOP + 0.4], S(k.cylinder(DIAL[0], DIAL[1], DIAL_R, BRIDGE_TOP, 0.8, P, 48), { tone: "lo" }) + Ln(k.ring(DIAL[0], DIAL[1], DIAL_R - 0.4, BRIDGE_TOP + 0.8, P, 48), { tone: "faint" }) + marks.join("") + Dots(pips, { size: 0.36, tone: "mid" }), [face]);
  cyl("speed.knob", DIAL[0], DIAL[1], KNOB_R, BRIDGE_TOP + 0.8, KNOB_TOP - BRIDGE_TOP - 0.8, {}, { steps: 28, extra: Ln(k.knurl(DIAL[0], DIAL[1], KNOB_R, BRIDGE_TOP + 0.8, KNOB_TOP, 24, P), { tone: "lo" }) + `<path class="iso-line" data-tone="hi" data-part="pointer" data-free="" d="${pointerD(1)}"/>` + Dots([at([DIAL[0], DIAL[1], KNOB_TOP])], { size: 0.5 }) });
  const SHAFT_Z = 7;
  const SPAN = HOUSE.x - (PLINTH.x + PLINTH.w);
  const SHAFT_Y = 54;
  const SHAFT = G.frameOf([PLINTH.x + PLINTH.w, SHAFT_Y, SHAFT_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const mid = SPAN / 2;
  along("shaft.flange.tray", SHAFT, 0, 1.2, 2.8);
  along("shaft.a", SHAFT, 1.2, mid - 1.6, 1.4);
  along("shaft.collar", SHAFT, mid - 1.6, mid + 1.6, 2.4, {}, { extra: Dots([at([PLINTH.x + PLINTH.w + mid, SHAFT_Y + 2.4 * Math.sin(1.1), SHAFT_Z + 2.4 * Math.cos(1.1)])], { size: 0.4 }) });
  along("shaft.b", SHAFT, mid + 1.6, SPAN - 1.2, 1.4);
  along("shaft.flange.house", SHAFT, SPAN - 1.2, SPAN, 2.8);
}

{
  slab("jbox", JBOX, DECK_H, JBOX_TOP - DECK_H, {}, { steps: 3, bevel: 0.6, extra: Ln(k.planOutline(k.insetPlan(JBOX, 2), JBOX_TOP, P, 3), { tone: "faint" }) + screws(k.corners(JBOX, 3.2), JBOX_TOP, { ring: 0.9, size: 0.38 }) });
  cyl("cam.collar", POST[0], POST[1], 5, JBOX_TOP, 3, {}, { steps: 28, bevel: 0.3 });
  cyl("cam.post", POST[0], POST[1], 3, JBOX_TOP + 3, ARM_Z - 4 - JBOX_TOP - 3, { tone: "mid", crease: "none" }, { steps: 24, inner: Ln(k.sideArc(POST[0], POST[1], 3, 32, P, 16), { tone: "faint" }) });
  slab("cam.clamp", { x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2 }, ARM_Z - 4, 10, {}, { steps: 4, bevel: 0.5 });
  slab("cam.thumb.neck", { x: POST[0] - 1.4, y: POST[1] + 6, w: 2.8, d: 2.6, r: 0.8 }, ARM_Z - 1, 4, { crease: "none" }, { steps: 2 });
  cyl("cam.thumb", POST[0], POST[1] + 11, 2.4, ARM_Z - 2, 6, {}, { steps: 18, extra: Ln(k.knurl(POST[0], POST[1] + 11, 2.4, ARM_Z - 2, ARM_Z + 4, 16, P), { tone: "lo" }) });
  const ARM = { x: POST[0] + 6, y: POST[1] - 3, w: CAM.x + CAM.w - (POST[0] + 6), d: 6, r: 2 };
  slab("cam.arm", ARM, ARM_Z, 4, {}, { steps: 4, bevel: 0.4, extra: Dots([at([ARM.x + 5, POST[1], ARM_Z + 4]), at([ARM.x + ARM.w - 5, POST[1], ARM_Z + 4])], { size: 0.42 }) });
  slab("cam.body", CAM, ARM_Z - 12, 12, {}, { steps: 4, bevel: 0.6, inner: Ln(k.sideSeam(CAM, ARM_Z - 4, P, 4), { tone: "faint" }), extra: Ln(k.sideRing([CAM.x + CAM.w - 4, CAM.y + CAM.d, ARM_Z - 8], 1.6, "y", P, 18), { tone: "lo" }) + `<g data-lamp>${Dots([at([CAM.x + CAM.w - 4, CAM.y + CAM.d, ARM_Z - 8])], { size: 0.9, tone: "hi" })}</g>` });
  cyl("cam.lens", LENS[0], LENS[1], 5.4, ARM_Z - 19, 7, {}, { steps: 32, inner: Ln(k.sideArc(LENS[0], LENS[1], 5.4, ARM_Z - 15, P, 20), { tone: "faint" }) });
  cyl("cam.lensring", LENS[0], LENS[1], 6.2, ARM_Z - 21, 2.2, {}, { steps: 32, extra: Ln(k.knurl(LENS[0], LENS[1], 6.2, ARM_Z - 21, ARM_Z - 18.8, 28, P), { tone: "lo" }) });
}

{
  const [hx, hy] = HOPPER;
  slab("hopper.base", { x: hx - 11, y: hy - 11, w: 22, d: 22, r: 2 }, DECK_H, 2, { tone: "lo" }, { steps: 3, extra: screws([[hx - 8, hy - 8], [hx + 8, hy - 8], [hx - 8, hy + 8], [hx + 8, hy + 8]], DECK_H + 2, { ring: 0.9, size: 0.36 }) });
  cyl("hopper.body", hx, hy, 8, DECK_H + 2, 18, {}, { steps: 40, inner: Ln(k.sideArc(hx, hy, 8, 12, P, 24) + k.sideArc(hx, hy, 8, 20, P, 24), { tone: "faint" }) });
  cyl("hopper.lid", hx, hy, 8.8, DECK_H + 20, 1.6, {}, { steps: 40, bevel: 0.3 });
  cyl("hopper.knob", hx, hy, 2, DECK_H + 21.6, 2.4, {}, { steps: 18, extra: Ln(k.knurl(hx, hy, 2, DECK_H + 21.6, DECK_H + 24, 12, P), { tone: "lo" }) });
  slab("hopper.spout", { x: hx + 7.6, y: hy - 2, w: TRAY.x + 4 - hx - 7.6, d: 4, r: 1 }, Z.wall + 0.4, 1.8, {}, { steps: 2, bevel: 0.2 });
}

cable("line", [
  [POST[0] - 6, JBOX.y, DECK_H + 2.6],
  [POST[0] - 6, JBOX.y - 8, DECK_H + 2.6],
  [POST[0] - 6, JBOX.y - 16, DECK_H + 1.4],
  [POST[0] - 6, DECK.y - 2.5, DECK_H + 1.4],
  [POST[0] - 6, DECK.y - 8, 1.4],
  [POST[0] - 6, -64, 1.4],
  [-26, -64, 1.4],
  [-18, DOCK.y + 4, 3],
  [DOCK.x, DOCK.y + 4, 3],
], 0.9, { tone: "lo", shells: [true, true], clamps: [-90, -50] });

function toothRing(turn) {
  const ring = [];
  for (let i = 0; i < TEETH; i++) {
    const a0 = turn + (i / TEETH) * Math.PI * 2;
    const a1 = a0 + (0.62 / TEETH) * Math.PI * 2;
    const a2 = a0 + (1 / TEETH) * Math.PI * 2;
    ring.push([WC[0] + Math.sin(a0) * ROOT_R, WC[1] - Math.cos(a0) * ROOT_R]);
    ring.push([WC[0] + Math.sin(a1) * TIP, WC[1] - Math.cos(a1) * TIP]);
    ring.push([WC[0] + Math.sin(a2 - 0.01) * ROOT_R, WC[1] - Math.cos(a2 - 0.01) * ROOT_R]);
  }
  return ring;
}
function wheelSvg(turn) {
  const body = k.extrude(toothRing(turn), WHEEL_Z, WHEEL_H, P, { convex: false });
  const spokes = [0, 1, 2, 3, 4].map((i) => {
    const a = turn + (i / 5) * Math.PI * 2 + 0.3;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      const t = a + (s / 6) * 0.82;
      pts.push([WC[0] + Math.sin(t) * 9.6, WC[1] - Math.cos(t) * 9.6]);
    }
    for (let s = 6; s >= 0; s--) {
      const t = a + 0.12 + (s / 6) * 0.6;
      pts.push([WC[0] + Math.sin(t) * 4.2, WC[1] - Math.cos(t) * 4.2]);
    }
    return k.onTop(pts, WHEEL_Z + WHEEL_H, P, true);
  });
  return S(body, { tone: "hi", crease: "lo" }) + Ln(spokes.join(""), { tone: "lo" }) + Ln(k.ring(WC[0], WC[1], 10.8, WHEEL_Z + WHEEL_H, P, 48), { tone: "faint" }) + Ln(k.ring(WC[0], WC[1], 2.8, WHEEL_Z + WHEEL_H, P, 16), { tone: "lo" });
}
function anchorRing(tilt) {
  const arm = (side) => {
    const a = side * PALLET;
    return [WC[0] + Math.sin(a) * (TIP - 1.2) - AP[0], -(WC[1] + Math.cos(a) * (TIP - 1.2)) + AP[1]];
  };
  const side = (s) => {
    const t = arm(s);
    const len = Math.hypot(t[0], t[1]);
    const n = [(t[1] / len) * s, (-t[0] / len) * s];
    return { outer: [t[0] + n[0] * 1.1, t[1] + n[1] * 1.1], inner: [t[0] - n[0] * 1.1, t[1] - n[1] * 1.1] };
  };
  const L = side(-1);
  const Rr = side(1);
  const pts = [[0, -9], [1.1, -3], [2.4, 0.4], Rr.outer, Rr.inner, [0, 4.2], L.inner, L.outer, [-2.4, 0.4], [-1.1, -3]];
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return pts.map(([x, y]) => [AP[0] + x * c - y * s, AP[1] - (x * s + y * c)]);
}
function anchorSvg(tilt) {
  return S(k.extrude(anchorRing(tilt), ANCHOR_Z, ANCHOR_H, P, { convex: false }), { tone: "mid" });
}
function pointerD(speed) {
  const a = SPEED_ANGLE[speed];
  return k.lineOnTop([DIAL[0] - Math.sin(a) * 1.2, DIAL[1] + Math.cos(a) * 1.2], [DIAL[0] + Math.sin(a) * (KNOB_R - 0.3), DIAL[1] - Math.cos(a) * (KNOB_R - 0.3)], KNOB_TOP, P);
}

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it" data-name="${item.name}" data-k="${f2(item.key)}" data-l="${f2(G.dot3(item.move, V))}"${item.attrs ?? ""}>${item.svg}</g>`);

const sim = bundle([join(ROOT, "packages/browser/src/Runtime.ts"), join(ROOT, "packages/browser/src/Drawing.ts")], ROOT);
const SIM_EXPORTS = `{ runtime: ${exportsOf(join(ROOT, "packages/browser/src/Runtime.ts"), ROOT)}, drawing: ${exportsOf(join(ROOT, "packages/browser/src/Drawing.ts"), ROOT)} }`;

const svg = k.figureSvg({
  width: W,
  height: H,
  label:
    "A culture bench that stands for the Eelf web project. On a raised deck, the worker: a shallow tray whose floor is engraved with the 96-unit spatial-hash grid and holds the live eels and their food, a seed hopper over its edge, a housing whose escape wheel advances one tooth per 1/30-second tick, with a speed dial and a brake, and a camera on a post that photographs the tray after each scheduler call that runs. One clamped cable crosses the deck edge to a dock. Behind it, two viewers ride a sliding carriage, Angular on one side and Phaser on the other; the docked one shows the snapshots, interpolated, and its buttons send commands back along the same cable.",
  body: [...back, `<g data-layer>${groups.join("")}</g>`],
});

const DATA = {
  P,
  KS: f2(KS),
  V,
  MOVE,
  SPRING,
  FLOOR,
  PER,
  FLOOR_Z: Z.floor,
  WC,
  TEETH,
  TIP,
  ROOT_R,
  WHEEL_Z,
  WHEEL_H,
  ANCHOR_Z,
  ANCHOR_H,
  AP,
  PALLET,
  BRAKE: [BRAKE_REST, BRAKE_HELD],
  DIAL,
  KNOB_R,
  KNOB_TOP,
  SPEED_ANGLE,
  BRIDGE_TOP,
  GLASS,
  MONITORS,
  REST_C,
  TRAVEL,
  BUTTON_DOWN,
};

const live = `
const SIM = (() => {
${sim}
return ${SIM_EXPORTS};
})();
(() => {
const D = ${JSON.stringify(DATA)};
const P = D.P;
const { SimulationRuntime, INITIAL_CONFIG } = SIM.runtime;
const { SnapshotInterpolator, segmentPose } = SIM.drawing;
const toothRing = ${toothRing.toString().replace(/\b(TEETH|TIP|ROOT_R|WC)\b/g, "D.$1")};
const anchorRing = ${anchorRing.toString().replace(/\b(TIP|WC|AP|PALLET)\b/g, "D.$1")};
const wheelTurnSvg = (turn) => {
  const body = extrude(toothRing(turn), D.WHEEL_Z, D.WHEEL_H, P, { convex: false });
  const zt = D.WHEEL_Z + D.WHEEL_H;
  const spokes = [0, 1, 2, 3, 4].map((i) => {
    const a = turn + (i / 5) * Math.PI * 2 + 0.3;
    const pts = [];
    for (let s = 0; s <= 6; s++) { const t = a + (s / 6) * 0.82; pts.push([D.WC[0] + Math.sin(t) * 9.6, D.WC[1] - Math.cos(t) * 9.6]); }
    for (let s = 6; s >= 0; s--) { const t = a + 0.12 + (s / 6) * 0.6; pts.push([D.WC[0] + Math.sin(t) * 4.2, D.WC[1] - Math.cos(t) * 4.2]); }
    return onTop(pts, zt, P, true);
  });
  return solidSvg(body, { tone: "hi", crease: "lo" }) + lineSvg(spokes.join(""), { tone: "lo" }) + lineSvg(ring(D.WC[0], D.WC[1], 10.8, zt, P, 48), { tone: "faint" }) + lineSvg(ring(D.WC[0], D.WC[1], 2.8, zt, P, 16), { tone: "lo" });
};
const anchorTiltSvg = (tilt) => solidSvg(extrude(anchorRing(tilt), D.ANCHOR_Z, D.ANCHOR_H, P, { convex: false }), { tone: "mid" });
const pointerFor = (a) => lineOnTop([D.DIAL[0] - Math.sin(a) * 1.2, D.DIAL[1] + Math.cos(a) * 1.2], [D.DIAL[0] + Math.sin(a) * (D.KNOB_R - 0.3), D.DIAL[1] - Math.cos(a) * (D.KNOB_R - 0.3)], D.KNOB_TOP, P);

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector("[data-layer]");
const items = [...layer.children].map((el) => ({ el, k: Number(el.dataset.k), l: Number(el.dataset.l), car: el.hasAttribute("data-car") }));
const carItems = items.filter((it) => it.car);
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const wheelEl = svg.querySelector('[data-part="wheel"]');
const anchorEl = svg.querySelector('[data-part="anchor"]');
const shoeEl = svg.querySelector('[data-part="shoe"]');
const pointerEl = svg.querySelector('[data-part="pointer"]');
const eelsEl = svg.querySelector('[data-part="eels"]');
const foodEl = svg.querySelector('[data-part="food"]');
const lampEl = svg.querySelector("[data-lamp]");
const dockLed = svg.querySelector("[data-dock-led]");
const desc = document.querySelector("[data-desc]");
const chunks = [...svg.querySelectorAll("[data-chunk]")].sort((a, b) => Number(a.dataset.chunk) - Number(b.dataset.chunk));
const pads = [...svg.querySelectorAll("[data-pad]")];
let commandsAt = [];
const mon = Object.fromEntries(D.MONITORS.map((m) => [m.id, {
  ...m,
  crt: svg.querySelector('[data-screen="' + m.id + '"] [data-crt]'),
  beam: svg.querySelector('[data-mon="' + m.id + '"] [data-beam]'),
  dot: svg.querySelector('[data-mon="' + m.id + '"] [data-dot]'),
  glass: svg.querySelector('[data-glass="' + m.id + '"] .el-glass'),
  led: svg.querySelector('[data-led="' + m.id + '"]'),
  buttons: Object.fromEntries([...svg.querySelectorAll('[data-mon="' + m.id + '"][data-btn]')].map((el) => [el.dataset.btn, { el: el.querySelector("[data-press]"), at: 0, held: 0 }])),
  power: m.id === "a" ? 1 : 0,
  powerClock: 9,
}]));
const down = axisVector(P, [0, 0, -D.BUTTON_DOWN]);
const moveScreen = axisVector(P, D.MOVE);
const screenMid = (D.GLASS.z0 + D.GLASS.z1) / 2;
const scaleScreen = (D.GLASS.dx * 2) / 1280;

let docked = "a";
let rt = null;
let interp = new SnapshotInterpolator();
let last = null;
let previous = performance.now();
let lampAt = -9;
let clock = 0;
let tickShown = -1, tiltShown = 0;
let shoe = { x: 0 }, pointer = { x: D.SPEED_ANGLE[1] };
let car = { x: 0, v: 0, target: 0 };
let swap = null;
let lastText = "";
let visible = false, hidden = false, frame = 0, prevNow = 0;
let touring = !still.matches, tourClock = 0, tourIndex = 0, idleTimer = 0, tourSwaps = 0;

function boot(text) {
  rt = new SimulationRuntime();
  rt.dispatch({ type: "init", config: { ...INITIAL_CONFIG } });
  if (hidden) rt.dispatch({ type: "visibility", hidden: true });
  if (text) for (const r of rt.dispatch({ type: "load", text })) handle(r);
  if (still.matches && !text) rt.dispatch({ type: "pause", paused: true });
  interp = new SnapshotInterpolator();
  last = null;
  handle(rt.dispatch({ type: "select", id: null })[0]);
  previous = performance.now();
}
function handle(response) {
  if (!response) return;
  if (response.type === "frame") {
    last = response;
    interp.accept(response.frame, performance.now());
    interpAt = performance.now();
    drawTray(response.frame);
    lampAt = clock;
    run();
  }
}
function send(command) {
  for (const r of rt.dispatch(command)) handle(r);
  if (["init", "reset", "pause", "visibility", "load"].includes(command.type)) previous = performance.now();
}
setInterval(() => {
  const now = performance.now();
  const response = rt ? rt.advance((now - previous) / 1000) : null;
  previous = now;
  if (response) handle(response);
}, 50);
function setHidden() {
  const want = !visible || document.hidden;
  if (want === hidden || !rt) return;
  hidden = want;
  send({ type: "visibility", hidden });
}

const f1 = (v) => Math.round(v * 10) / 10;
function eelPath(c, time, map, unit) {
  const t = c.traits;
  const pts = [];
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
  for (let i = 0; i < t.segments; i++) {
    const s = segmentPose(t, i, time, c.id);
    pts.push(map(c.x + s.x * ca - s.y * sa, c.y + s.x * sa + s.y * ca));
  }
  return pts;
}
function drawSpecimens(frameData, time, map, unit, sample, { scale = 1, edge = 0, least = 0.5, sprites = false } = {}) {
  const groups = new Map();
  const n2 = (v) => Math.round(v * 100) / 100;
  const bodies = [];
  for (const raw of frameData.creatures) {
    const c = sample ? sample(raw) : raw;
    const pts = eelPath(c, time, map, unit);
    const width = Math.max(least, Math.round(c.traits.radius * c.traits.width * 2 * unit * scale * 4) / 4);
    const d = sprites ? pts.map((p) => "M" + f1(p[0]) + " " + f1(p[1]) + "h0").join("") : "M" + pts.map((p) => f1(p[0]) + " " + f1(p[1])).join("L");
    if (edge) bodies.push({ y: c.y, width, d, head: pts[0] });
    else groups.set(width, (groups.get(width) || "") + d);
  }
  let eels = "";
  for (const [w, d] of groups) eels += '<path class="el-eel" style="stroke-width:' + n2(w) + 'px" d="' + d + '"/>';
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) {
    const inner = b.width - edge * 2;
    eels += '<path class="el-eel" style="stroke-width:' + n2(b.width) + 'px" d="' + b.d + '"/>';
    if (inner > 0.15) eels += '<path class="el-eel-in" style="stroke-width:' + n2(inner) + 'px" d="' + b.d + '"/><path class="el-eel" style="stroke-width:' + n2(Math.max(0.4, inner * 0.62)) + 'px" d="M' + f1(b.head[0]) + " " + f1(b.head[1]) + 'h0"/>';
  }
  const plants = [], meat = [];
  for (const food of frameData.food) (food.kind === "Plant" ? plants : meat).push(map(food.x, food.y));
  const dots = (list, r, cls) => list.length ? '<path class="' + cls + '" style="stroke-width:' + n2(r * 2) + 'px" d="' + list.map((p) => "M" + f1(p[0]) + " " + f1(p[1]) + "h0").join("") + '"/>' : "";
  return { eels, food: dots(plants, Math.max(least * 0.5, 4 * unit * scale), "el-plant") + dots(meat, Math.max(least * 0.7, 6 * unit * scale), "el-meat") };
}
const trayMap = (x, y) => iso([D.FLOOR.x + x * D.PER, D.FLOOR.y + y * D.PER, D.FLOOR_Z + 0.2], P);
function drawTray(frameData) {
  const { eels, food } = drawSpecimens(frameData, frameData.statistics.time, trayMap, D.PER, null, { scale: D.KS * 0.82, edge: 0.4, least: 1.4 });
  eelsEl.innerHTML = eels;
  foodEl.innerHTML = food;
}
function screenMap(m) {
  const x0 = m.cx - D.GLASS.dx, z1 = D.GLASS.z1;
  return (x, y) => [x0 + x * scaleScreen, -z1 + y * scaleScreen];
}
function drawScreen(now) {
  const m = mon[docked];
  if (!last || swap) return;
  const f = last.frame;
  const sample = still.matches ? null : (c) => interp.sample(c, now);
  const { eels, food } = drawSpecimens(f, still.matches ? f.statistics.time : interp.time(now), screenMap(m), scaleScreen, sample, docked === "p" ? { scale: 0.95, least: 0.42, sprites: true } : { scale: 0.7, least: 0.32 });
  m.crt.innerHTML = food + eels;
}

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function crtFrame(m, dt) {
  m.powerClock += dt;
  const t = m.powerClock;
  let sx = 1, sy = 1, beam = 0, dot = 0, lit = m.power;
  if (m.power) {
    if (t < 0.14) { sx = ease(t / 0.14); sy = 0.012; beam = 1; }
    else if (t < 0.36) { sy = 0.012 + 0.988 * ease((t - 0.14) / 0.22); beam = 1 - ease((t - 0.14) / 0.22); }
  } else {
    if (t < 0.1) { sy = 1 - 0.988 * ease(t / 0.1); beam = ease(t / 0.1); lit = 1; }
    else if (t < 0.26) { sy = 0.012; sx = 1 - ease((t - 0.1) / 0.16); beam = 1; lit = 1; }
    else { sx = 0; sy = 0; dot = Math.max(0, 1 - (t - 0.26) / 0.5); }
  }
  const cx = m.cx;
  m.crt.setAttribute("transform", "translate(" + cx + " " + -screenMid + ") scale(" + sx.toFixed(3) + " " + sy.toFixed(3) + ") translate(" + -cx + " " + screenMid + ")");
  m.beam.setAttribute("transform", "translate(" + cx + " " + -screenMid + ") scale(" + Math.max(sx, 0.001).toFixed(3) + " 1) translate(" + -cx + " " + screenMid + ")");
  m.beam.style.opacity = beam.toFixed(2);
  m.dot.style.opacity = dot.toFixed(2);
  m.glass.toggleAttribute("data-on", !!lit);
  m.led.style.opacity = m.power ? "" : "0.12";
  return t > 0.8;
}
function setPower(id, on) {
  const m = mon[id];
  if (m.power === on) return;
  m.power = on;
  m.powerClock = still.matches ? 9 : 0;
  if (!on) m.crt.innerHTML = m.crt.innerHTML;
}

function press(id, fromTour = false) {
  const b = mon[docked].buttons[id];
  if (!b || swap) return;
  b.held = 0.14;
  if (id === "step" && !last.paused) { if (!fromTour) announce("Step works while paused. Press Space to pause first."); run(); return; }
  commandsAt.push(clock);
  if (id === "run") send({ type: "pause", paused: !last.paused });
  if (id === "step") send({ type: "step" });
  if (id === "speed") send({ type: "speed", value: last.speed === 1 ? 2 : last.speed === 2 ? 4 : 1 });
  if (id === "feed") send({ type: "feed" });
  if (id === "restart") send({ type: "reset", config: { ...INITIAL_CONFIG } });
  if (!fromTour) announce(id === "feed" ? "Added plants." : id === "restart" ? "New experiment started." : phase());
  run();
}
function startSwap() {
  if (swap) return;
  const from = docked, to = docked === "a" ? "p" : "a";
  const responses = rt.dispatch({ type: "save", requestId: 1 });
  const saved = responses.find((r) => r.type === "saved");
  if (!saved) return;
  send({ type: "pause", paused: true });
  swap = { from, to, text: saved.text, kib: saved.text.length / 1024, stage: "saving", at: clock };
  setPower(from, 0);
  if (!touring) announce("Saved " + swap.kib.toFixed(1) + " KiB from " + mon[from].name + ". Loading it into " + mon[to].name + ".");
  run();
}
function swapStep() {
  if (!swap) return;
  const age = clock - swap.at;
  if (swap.stage === "saving") {
    if (age > 0.45) { swap.stage = "sliding"; car.target = swap.to === "p" ? 1 : 0; eelsEl.innerHTML = ""; foodEl.innerHTML = ""; }
  } else if (swap.stage === "sliding") {
    if (Math.abs(car.x - car.target) < 0.004 && Math.abs(car.v) < 0.01) {
      car.x = car.target; car.v = 0;
      docked = swap.to;
      boot(swap.text);
      setPower(docked, 1);
      swap.stage = "loaded"; swap.at = clock;
      if (!touring) announce(mon[docked].name + " loaded the save. Paused.");
      describe();
    }
  } else if (swap.stage === "loaded" && age > 0.2) swap = null;
}

function phase() {
  if (!last) return "";
  if (swap) return swap.stage === "saving" ? "saving" : swap.stage === "sliding" ? "moving to " + mon[swap.to].name : "loaded";
  return last.paused ? "paused" : last.speed + "×";
}
function readoutText() {
  if (!last) return "";
  const s = last.frame.statistics;
  if (swap && swap.stage !== "loaded") return (swap.stage === "saving" ? "saved " : "→ " + mon[swap.to].name + " · ") + swap.kib.toFixed(1) + " KiB";
  return mon[docked].name + " · " + phase() + " · tick " + s.tick + " · " + s.population + " alive";
}
function describe() {
  if (!last) return;
  const s = last.frame.statistics;
  desc.textContent = mon[docked].name + " app docked, " + (last.paused ? "paused" : "running at " + last.speed + " times") + ", tick " + s.tick + ", " + s.population + " creatures alive, generation " + s.generation + ", " + s.plants + " plants.";
}
let announceTimer = 0;
let interpAt = 0;
function announce(text) { clearTimeout(announceTimer); announceTimer = setTimeout(() => { if (status.textContent !== text) status.textContent = text; describe(); }, 120); }

function place(share) {
  const [dx, dy] = [moveScreen[0] * share, moveScreen[1] * share];
  const t = Math.abs(share) < 1e-4 ? "" : "translate(" + dx.toFixed(2) + " " + dy.toFixed(2) + ")";
  for (const it of carItems) t ? it.el.setAttribute("transform", t) : it.el.removeAttribute("transform");
  const order = items.map((it, i) => [it.k + it.l * share, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let changed = false;
  for (let i = 0; i < order.length; i++) if (layer.children[i] !== items[order[i][1]].el) { changed = true; break; }
  if (changed) { const frag = document.createDocumentFragment(); for (const [, i] of order) frag.appendChild(items[i].el); layer.appendChild(frag); }
}

const TOUR = [
  [6, "speed"], [10, "speed"], [13, "speed"], [15, "run"], [16.2, "step"], [16.9, "step"], [17.6, "step"], [19, "run"], [21, "feed"], [24, "swap"], [26.4, "run"], [30, null],
];
function tourStep(dt) {
  if (swap) return;
  tourClock += dt;
  if (last && last.frame.statistics.population === 0 && !last.paused) { press("restart", true); return; }
  while (tourIndex < TOUR.length && tourClock >= TOUR[tourIndex][0]) {
    const action = TOUR[tourIndex][1];
    tourIndex++;
    if (action === "swap") startSwap();
    else if (action === "run" && tourIndex > 10) { if (last.paused) press("run", true); }
    else if (action) press(action, true);
    else { tourClock = 0; tourIndex = 0; }
  }
}

function tick(now) {
  const dt = prevNow ? Math.min((now - prevNow) / 1000, 1 / 30) : 1 / 60;
  prevNow = now;
  const calm = still.matches;
  clock += dt;
  if (touring) tourStep(dt);
  swapStep();
  const want = car.target;
  if (calm) { car.x = want; car.v = 0; }
  else for (let i = 0; i < D.SPRING.substeps; i++) { const h = dt / D.SPRING.substeps; car.v += (D.SPRING.stiffness * (want - car.x) - D.SPRING.damping * car.v) * h; car.x += car.v * h; }
  if (Math.abs(want - car.x) < 1e-3 && Math.abs(car.v) < 1e-3) { car.x = want; car.v = 0; }
  place(car.x);
  if (last) {
    const s = last.frame.statistics;
    if (s.tick !== tickShown) {
      tickShown = s.tick;
      wheelEl.innerHTML = wheelTurnSvg(((s.tick % D.TEETH) / D.TEETH) * Math.PI * 2);
      anchorEl.innerHTML = anchorTiltSvg(s.tick % 2 ? 0.07 : -0.07);
    }
    const shoeWant = last.paused ? D.BRAKE[1] - D.BRAKE[0] : 0;
    shoe.x = calm ? shoeWant : shoe.x + (shoeWant - shoe.x) * (1 - Math.exp(-dt / 0.08));
    const sv = axisVector(P, [shoe.x, 0, 0]);
    shoeEl.setAttribute("transform", "translate(" + sv[0].toFixed(2) + " " + sv[1].toFixed(2) + ")");
    const angleWant = D.SPEED_ANGLE[last.speed];
    pointer.x = calm ? angleWant : pointer.x + (angleWant - pointer.x) * (1 - Math.exp(-dt / 0.12));
    pointerEl.setAttribute("d", pointerFor(pointer.x));
  }
  const glow = calm ? 0 : Math.max(0, 1 - (clock - lampAt) / 0.06);
  lampEl.style.opacity = (0.45 + 0.55 * glow).toFixed(2);
  const streaming = !calm && last && !last.paused && !hidden && !swap;
  commandsAt = commandsAt.filter((t) => clock - t < 1.6);
  let flowing = false;
  chunks.forEach((el, i) => {
    let v = streaming ? 0.4 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * (clock * 1.6 - i / 3.5))), 6) : 0;
    if (!calm) for (const t of commandsAt) { const at = chunks.length - 1 - (clock - t) * 16; v = Math.max(v, 0.9 * Math.exp(-(((i - at) / 0.9) ** 2))); }
    if (v > 0.01) flowing = true;
    const text = v > 0.01 ? v.toFixed(2) : "";
    if (el.style.getPropertyValue("--flow") !== text) text ? el.style.setProperty("--flow", text) : el.style.removeProperty("--flow");
  });
  dockLed.style.opacity = swap && swap.stage === "sliding" ? "0.12" : "";
  let settled = car.x === car.target && Math.abs(shoe.x - (last && last.paused ? D.BRAKE[1] - D.BRAKE[0] : 0)) < 0.01 && (!last || Math.abs(pointer.x - D.SPEED_ANGLE[last.speed]) < 0.002) && !flowing && glow === 0;
  for (const m of Object.values(mon)) {
    if (!crtFrame(m, dt)) settled = false;
    for (const b of Object.values(m.buttons)) {
      if (b.held > 0 || b.at > 0) settled = false;
      b.held = Math.max(0, b.held - dt);
      const bw = b.held > 0 ? 1 : 0;
      b.at = calm ? bw : b.at + (bw - b.at) * (1 - Math.exp(-dt / (bw ? 0.02 : 0.07)));
      if (b.at < 0.01 && !bw) { b.at = 0; b.el.removeAttribute("transform"); }
      else b.el.setAttribute("transform", "translate(" + (down[0] * b.at).toFixed(2) + " " + (down[1] * b.at).toFixed(2) + ")");
    }
  }
  pads.forEach((el) => el.toggleAttribute("data-on", el.dataset.pad === docked && !swap));
  drawScreen(now);
  const text = readoutText();
  if (text !== lastText) { readout.textContent = text; lastText = text; }
  const idle = settled && !touring && !swap && (!last || last.paused || hidden) && now - interpAt > 120;
  frame = visible && !idle ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { prevNow = 0; frame = requestAnimationFrame(tick); } }
function resumeTour() {
  if (still.matches) return;
  if (document.activeElement === stage || stage.matches(":hover")) { idleTimer = setTimeout(resumeTour, 3000); return; }
  if (last && !swap) {
    if (last.paused) send({ type: "pause", paused: false });
    if (last.speed !== 1) send({ type: "speed", value: 1 });
  }
  touring = true; tourClock = 0; tourIndex = 0; run();
}
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(resumeTour, 9000);
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; setHidden(); if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointerenter", takeOver);
document.addEventListener("visibilitychange", setHidden);
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  const map = { " ": "run", "arrowright": "step", ".": "step", "1": "speed1", "2": "speed2", "4": "speed4", "x": "speed", "f": "feed", "r": "restart", "s": "swap", "escape": "stop" };
  const action = map[key];
  if (!action) return;
  event.preventDefault();
  takeOver();
  if (action === "swap") startSwap();
  else if (action === "stop") { touring = false; clearTimeout(idleTimer); }
  else if (action.startsWith("speed") && action.length > 5) { const value = Number(action.slice(5)); if (last.speed !== value && !swap) { mon[docked].buttons.speed.held = 0.14; commandsAt.push(clock); send({ type: "speed", value }); announce(phase()); run(); } }
  else press(action);
});
svg.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-btn]");
  const monEl = event.target.closest("[data-mon]");
  takeOver();
  stage.focus({ preventScroll: true });
  if (btn && btn.dataset.mon === docked) { press(btn.dataset.btn); return; }
  if (monEl && monEl.dataset.mon !== docked) startSwap();
});
stage.addEventListener("focus", () => { takeOver(); describe(); });
boot(null);
if (still.matches) touring = false;
setHidden();
describe();
place(0);
})();
`;

const css = `<style>
.el-well{fill:var(--anatomy-shade-1)}
.el-bezel{fill:var(--anatomy-top)}
.el-glass{fill:var(--anatomy-shade-0);transition:fill .5s var(--anatomy-ease)}
.el-glass[data-on]{fill:var(--el-glass-on)}
.iso{--el-glass-on:#232323;--el-ink:var(--anatomy-lit)}
.iso[data-theme="light"]{--el-glass-on:#ecece6}
.el-eel{fill:none;stroke:var(--el-ink);stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.el-eel-in{fill:none;stroke:var(--anatomy-lit-top);stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.el-plant{fill:none;stroke:var(--anatomy-mid);stroke-linecap:round;vector-effect:none!important}
.el-meat{fill:none;stroke:var(--anatomy-hi);stroke-linecap:round;vector-effect:none!important}
.el-beam{fill:none;stroke:var(--anatomy-lit);stroke-width:1.2px;stroke-linecap:round}
.el-dot{fill:var(--anatomy-lit)}
[data-lamp],[data-dock-led],[data-led]{transition:opacity .25s linear}
[data-pad][data-on] .iso-edge{stroke:var(--anatomy-lit)}
[data-btn]{cursor:pointer}
.it[data-chunk] .tb-body{fill:color-mix(in srgb,var(--anatomy-lit) calc(var(--flow,0) * 100%),var(--anatomy-shade-2))}
.el-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.iso-stage{touch-action:pan-y}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "Eelf evolution lab",
    hint: "Press its buttons · S swaps app",
    readout: "Angular · 1× · tick 0 · 72 alive",
    keys: [
      { mark: "lit", label: "Eels: the project's own runtime, live (here on the page's main thread)" },
      { mark: "raised", label: "The worker: one escape-wheel tooth per 1/30 s tick" },
      { mark: "edge", label: "One line to the dock: snapshots out, commands back" },
      { mark: "dim", label: "The parked viewer: the other app, a separate build with its own worker" },
    ],
    caption:
      "Eelf web is two separately served apps, Angular and Phaser, over one shared simulation: a simulation package plus a shared browser runtime. Each app starts its own worker, and the worker owns the World. Every 50 ms its scheduler lets out fixed 1/30 s ticks through the escape wheel, ×1, ×2 or ×4 by the dial, at most 30 ticks and 0.25 s of catch-up per call; the brake is pause, and a hidden tab stops it the same way. The tray floor is the 96-unit spatial hash on a 1280 × 800 world seeded 104729, with 72 founders and 220 plants; the hopper is Add nourishment. After each call that runs, the camera posts a cloned snapshot down the line, about 20 a second. The docked viewer interpolates it at display rate and never touches the tray, and its buttons send commands back along the same line. The bench shows one app at a time, so a swap exports the World as version-1 JSON and imports it into the other app's own worker, which loads it paused: the same save runs in both. This page runs the project's own runtime code on its main thread, on the worker's 50 ms schedule.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Eelf evolution lab. Space runs or pauses, right arrow steps one tick while paused, 1, 2 or 4 sets the speed, F adds plants, R restarts, S swaps between the Angular and Phaser apps." aria-describedby="el-desc">${svg}<span class="el-sr" id="el-desc" data-desc></span><span class="el-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const name = THEME === "light" ? "eelf-lab-light.html" : "eelf-lab.html";
const page = k.pageHtml({ title: "Eelf evolution lab", theme: THEME, body, script: kitScript() + live, width: 700 });
writeFileSync(join(HERE, name), page);

if (process.argv.includes("--artifact")) {
  const blockOf = (css, head) => {
    const from = css.indexOf(head);
    const to = css.indexOf("}", from);
    return { text: css.slice(from, to + 1), body: css.slice(from + head.length, to) };
  };
  const dark = blockOf(k.ISO_CSS, ".iso{");
  const light = blockOf(k.ISO_CSS, '.iso[data-theme="light"]{');
  const rest = k.ISO_CSS.replace(dark.text, "").replace(light.text, "");
  const ownDark = "--el-glass-on:#232323;--el-ink:var(--anatomy-lit);";
  const ownLight = "--el-glass-on:#ecece6;--el-ink:var(--anatomy-lit);";
  const tokens = [
    `:root{${dark.body};${light.body};${ownLight}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark.body};${ownDark}color-scheme:dark}}`,
    `:root[data-theme="dark"]{${dark.body};${ownDark}color-scheme:dark}`,
  ].join("\n");
  const ownCss = css.replace(/<\/?style>/g, "").replace('.iso{--el-glass-on:#232323;--el-ink:var(--anatomy-lit)}\n.iso[data-theme="light"]{--el-glass-on:#ecece6}\n', "");
  const pageCss = `*{box-sizing:border-box}
body{background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.iso-page{max-width:700px;margin:0 auto;padding-block:40px 72px}`;
  const script = (kitScript() + live).replace(/<\/(script)/gi, "<\\/$1");
  const doc = `<title>Eelf Evolution Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${tokens}
${rest}
${pageCss}
${ownCss}
</style>
<main class="iso iso-page">${body.replace(css, "")}</main>
<script type="module">${script}</script>
`;
  writeFileSync(join(HERE, "eelf-lab-artifact.html"), doc);
  console.log("wrote eelf-lab-artifact.html", `${(doc.length / 1024).toFixed(0)} KB`);
}
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `scale ${KS.toFixed(3)}`, `${CABLES.length} cables`);
A.auditOrExit(R, P, {});
