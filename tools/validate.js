/* 剧本图完整性 + 全路线可达性校验
   用法：node tools/validate.js [目标HTML，默认 ../group-chat-galgame-v1.html] */
const fs = require("fs");
const path = require("path");
const target = process.argv[2] || path.join(__dirname, "..", "group-chat-galgame-v1.html");
const src = fs.readFileSync(target, "utf8");

function grab(startMark, endMark, ret) {
  const a = src.indexOf(startMark);
  if (a < 0) throw new Error("marker not found: " + startMark);
  const b = src.indexOf(endMark, a);
  if (b < 0) throw new Error("end marker not found: " + endMark);
  const code = src.slice(a, b) + endMark;   // 拼回结束符
  return new Function(code + "; return (" + ret + ");")();
}

const CH = grab("const CH = {", "\n};", "CH");
const NODES = grab("const NODES = {", "\n};", "NODES");
const ENDINGS = grab("const ENDINGS = {", "\n};", "ENDINGS");
const GE_SLOTS = grab("const GE_SLOTS = [", "];", "GE_SLOTS");
const PRIORITY = grab("const PRIORITY=[", "];", "PRIORITY");
const ROUTE_START = grab("const ROUTE_START={", "};", "ROUTE_START");

console.log("CH:", Object.keys(CH).length, " NODES:", Object.keys(NODES).length,
  " ENDINGS:", Object.keys(ENDINGS).length, " GE_SLOTS:", GE_SLOTS.length);

let errors = [];

/* 1. 所有跳转目标可解析 */
function checkTarget(from, to) {
  if (to == null) return;
  if (typeof to !== "string") { errors.push(`${from}: 非法跳转 ${to}`); return; }
  if (to.startsWith("__end_")) {
    const k = to.slice(6);
    if (!ENDINGS[k]) errors.push(`${from} -> ${to}: ENDINGS 缺少 ${k}`);
    return;
  }
  if (to.startsWith("__ge_")) {
    const k = to.slice(5);
    if (!NODES["ge_" + k]) errors.push(`${from} -> ${to}: 缺少节点 ge_${k}`);
    return;
  }
  if (!NODES[to]) errors.push(`${from} -> ${to}: 节点不存在`);
}
for (const [id, n] of Object.entries(NODES)) {
  checkTarget(id, n.next);
  (n.o || []).forEach((o, i) => {
    if (!Array.isArray(o) || o.length < 2) { errors.push(`${id}.o[${i}] 结构异常`); return; }
    checkTarget(id + ".o" + i, o[1]);
    const fx = o[2];
    if (fx) {
      for (const k in (fx.a || {})) if (!CH[k]) errors.push(`${id}.o${i}: fx.a 引用了未知角色 ${k}`);
      for (const k in (fx.s || {})) if (!"zrmqw".includes(k)) errors.push(`${id}.o${i}: 未知资质 ${k}`);
    }
  });
  if (n.fx) for (const k in (n.fx.a || {})) if (!CH[k]) errors.push(`${id}: fx.a 未知角色 ${k}`);
  if (n.c && n.c !== null && !CH[n.c]) errors.push(`${id}: 立绘角色 ${n.c} 不存在`);
  const lines = n.b || n.l || [];
  lines.forEach(([k], i) => {
    if (k && k !== "#" && !CH[k]) errors.push(`${id} 行${i}: 说话人 ${k} 不存在`);
  });
}

/* 2. GE / 路线可解析 */
GE_SLOTS.forEach(k => {
  if (!NODES["ge_" + k]) errors.push(`GE_SLOTS: 缺少 ge_${k}`);
  if (!ROUTE_START[k]) errors.push(`GE_SLOTS: ROUTE_START 缺少 ${k}`);
  if (!CH[k]) errors.push(`GE_SLOTS: CH 缺少 ${k}`);
});
PRIORITY.forEach(k => { if (!CH[k]) errors.push(`PRIORITY: CH 缺少 ${k}`); });
Object.entries(ROUTE_START).forEach(([k, id]) => { if (!NODES[id]) errors.push(`ROUTE_START ${k} -> ${id} 不存在`); });

/* 3. 全路线可达性：穷举共通线选择，检查每个角色都能成为最高羁绊 */
const COMMON = [
  ["d1a", 3], ["d1c", 3], ["d2a", 3], ["d2b", 3], ["d3a", 3], ["d3b", 5], ["d4a", 4],
  ["d4_b", 3], ["d5a", 4], ["d5b", 3], ["d6a", 3], ["d6_b", 3], ["d6c", 2], ["d7a", 2], ["mx1", 3]
];
// 固定节点加成（d6c / d7a / mx2 的节点级 fx）
const FIXED = { lusi: 1, liuli: 1 };
const keys = Object.keys(CH).filter(k => k !== "you");
const canWin = new Set();
let paths = 0;
(function walk(i, deltas, q) {
  if (i === COMMON.length) {
    paths++;
    const total = {};
    keys.forEach(k => total[k] = (deltas[k] || 0) + (FIXED[k] || 0));
    let best = null, bv = -1e9;
    PRIORITY.forEach(k => { if (total[k] > bv) { bv = total[k]; best = k; } });
    if (q < 3) canWin.add(best);           // q>=3 会走第 81 人 END
    return;
  }
  const [nodeId, cnt] = COMMON[i];
  const opts = NODES[nodeId].o.slice(0, cnt);
  opts.forEach(o => {
    const to = o[1];
    if (to && to.startsWith("__end_")) return;  // 进 BE 的选项不参与主线枚举
    const d = Object.assign({}, deltas);
    (o[2] && o[2].a ? Object.keys(o[2].a) : []).forEach(k => d[k] = (d[k] || 0) + o[2].a[k]);
    const nq = q + ((o[2] && o[2].s && o[2].s.q) || 0);
    walk(i + 1, d, nq);
  });
})(0, {}, 0);
console.log("枚举路径数:", paths);
const missing = GE_SLOTS.filter(k => !canWin.has(k));
console.log("可达成最高羁绊的角色:", [...canWin].sort().join(", "));
console.log("不可达角色:", missing.length ? missing.join(", ") : "无 ✓");
missing.forEach(k => errors.push(`路线不可达: ${k}`));

/* 4. 结局文本 / 描述存在性 */
Object.entries(NODES).forEach(([id, n]) => {
  if (id.startsWith("ge_")) {
    const k = id.slice(3);
    if (!CH[k]) errors.push(`${id}: CH 缺少 ${k}`);
    if (!(n.l && n.l.length)) errors.push(`${id}: 无台词`);
  }
});
Object.entries(ENDINGS).forEach(([k, e]) => {
  if (!e.name || !e.who || !e.desc) errors.push(`ENDINGS.${k}: 字段缺失`);
});

console.log(errors.length ? "\n[FAIL]\n" + errors.join("\n") : "\n[ALL CHECKS PASSED]");
process.exit(errors.length ? 1 : 0);