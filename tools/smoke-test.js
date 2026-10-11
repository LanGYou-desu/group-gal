/* v1.0 完整版 · jsdom 端到端冒烟测试
   用法：
     npm i -D jsdom        # 或 npm i -g jsdom 后在任意目录运行
     node tools/smoke-test.js
   覆盖：加载 → 开场聊天 → DAY7 分岔（回归缺陷1）→ 整条线通关 → 复读禁言 BE
         → 羁绊抽屉 → 15 路线可达 → 回收室/第81人/蘑菇汤 → 结局协议
*/
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const target = process.argv[2] || path.join(__dirname, "..", "group-chat-galgame-v1.html");
const html = fs.readFileSync(target, "utf8");
const logs = [];
const vc = new VirtualConsole();
vc.on("error", (...a) => logs.push("[console.error] " + a.join(" ")));
vc.on("jsdomError", (e) => logs.push("[jsdomError] " + (e.stack || e.message)));
vc.on("warn", () => {});
vc.on("log", () => {});

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/group-chat-galgame-v1.html",
  virtualConsole: vc,
  beforeParse(window) {
    // —— 浏览器能力补丁：Web Audio 走空实现，仅验证调用路径 ——
    const g = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
    class FakeCtx extends window.EventTarget {
      constructor() { super(); this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; this.state = "running"; }
      createGain() { return { gain: g(), connect() {} }; }
      createOscillator() { return { type: "sine", frequency: g(), connect() {}, start() {}, stop() {} }; }
      createBuffer() { return { getChannelData: () => new Float32Array(64) }; }
      createBufferSource() { return { connect() {}, start() {}, buffer: null }; }
      resume() {}
    }
    window.AudioContext = FakeCtx;
    window.confirm = () => true;
  }
});

const w = dom.window;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (code) => w.eval(code);
let failed = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? "  ✓ " : "  ✗ ") + label + (extra !== undefined ? "  → " + JSON.stringify(extra) : ""));
  if (!cond) failed++;
};

(async () => {
  await wait(300);
  console.log("== 1. 基础加载 ==");
  ok(ev("document.querySelectorAll('#s-title .menu button').length") === 4, "标题菜单 4 个按钮");
  ok(typeof ev("typeof go") === "string", "引擎函数已定义");

  // —— 加速：把"快"档调到极速，便于自动跑完整条线 ——
  ev("PREF.auto=true; PREF.spd=2; SPEEDS[2].type=1; SPEEDS[2].punc=2; SPEEDS[2].autoWait=()=>25;");

  console.log("== 2. 开始游戏（聊天流） ==");
  ev("document.getElementById('btn-start').click()");
  await wait(2500);
  const bubbles = ev("document.querySelectorAll('#chat .bub, #chat .sysmsg').length");
  ok(bubbles >= 5, "开场聊天出现 ≥5 条消息", bubbles);
  ok(ev("S.id").length > 0, "存档节点 id", ev("S.id"));

  console.log("== 3. DAY7 分岔（回归：原版此处崩溃） ==");
  ev("S=freshState(); S.a={fish:6,suan:2}; toGame(); go('d7b');");
  await wait(3500);
  const branchLabel = ev("(document.querySelector('#avgchoices button')||{}).textContent || null");
  ok(!!branchLabel && branchLabel.includes("去追"), "分岔选项渲染", branchLabel);
  ok(branchLabel && branchLabel.includes("一条鱼"), "羁绊最高角色判定为「一条鱼」", branchLabel);
  ev("document.querySelector('#avgchoices button').click()");
  await wait(600);
  ok(String(ev("S.id")).startsWith("r_f"), "进入一条鱼路线", ev("S.id"));

  console.log("== 4. 自动跑完整条角色线 → 结局卡 ==");
  let end = null;
  for (let i = 0; i < 120 && !end; i++) {
    ev("(()=>{const b=document.querySelector('#avgchoices button, #choices button'); if(b) b.click();})()");
    end = ev("(()=>{const e=document.getElementById('endcard'); return e? {h:e.querySelector('h2').textContent, cls:e.className}:null;})()");
    if (!end) await wait(300);
  }
  ok(!!end, "自动跑线出现结局卡", end);
  if (end) ok(end.cls.includes("bad") || end.cls.includes("ge"), "结局卡样式类别合法", end.cls);

  console.log("== 5. 复读 ×3 → 刷屏禁言 BE（v0.2 机制移植） ==");
  ev("document.getElementById('endcard') && document.getElementById('endcard').remove(); S=freshState(); toGame(); go('d1a');");
  await wait(2500);
  const before = ev("S.s.w");
  ev("document.getElementById('btn-repeat').click();document.getElementById('btn-repeat').click();document.getElementById('btn-repeat').click();");
  await wait(200);
  const fz = ev("(()=>{const e=document.getElementById('endcard'); return e?e.querySelector('h2').textContent:null;})()");
  ok(fz && fz.includes("刷屏"), "复读 3 次触发刷屏禁言", fz);
  ok(ev("S.s.w") === before + 3, "水群值 +3", ev("S.s.w"));

  console.log("== 6. 群成员羁绊抽屉 ==");
  ev("document.getElementById('endcard').remove(); S=freshState(); S.a={naoqi:5,fish:2}; S.f={butterUnlocked:true}; toGame(); go('d5z');");
  await wait(600);
  ev("document.getElementById('btn-members').click()");
  const rows = ev("document.querySelectorAll('#dr-list .dr-row').length");
  ok(rows === 17, "抽屉 17 行（18 角色去掉玩家）", rows);
  ok(ev("document.querySelector('#dr-list .dr-stage').textContent") === "宝宝", "闹七(羁绊5)显示「宝宝」", ev("document.querySelector('#dr-list .dr-stage').textContent"));
  ok(ev("document.getElementById('drawer').classList.contains('open')"), "抽屉打开");
  ev("document.getElementById('btn-drawer-close').click()");

  console.log("== 7. 15 条路线标签 & 入口可达（引擎侧复检） ==");
  const keys = ["naoqi", "fish", "g", "suan", "tttt", "dan", "gen", "aka", "mian", "n305", "butter", "obra", "lusi", "liuli", "ban"];
  let bad = [];
  for (const k of keys) {
    const r = ev(`(()=>{S=freshState(); S.f={butterUnlocked:true}; S.a={${k}:9}; const best=pickRoute(); return best+"|"+pickRouteLabel(best)+"|"+(!!NODES[ROUTE_START[best]]);})()`);
    if (!r.startsWith(k + "|") || !r.endsWith("|true")) bad.push(k + "=>" + r);
  }
  ok(bad.length === 0, "15/15 角色均可被分岔选中且路线入口存在", bad.length ? bad : "全部通过");

  console.log("== 8. 结局回收室 / 第 81 人 / 蘑菇汤际遇 ==");
  ev("S.unlocked=['fz','pass','moku1','moku2','adult','ge_naoqi','ge_suan']; openGallery('title');");
  ok(ev("document.getElementById('gal-progress').textContent").includes("5 / 23"), "回收室进度（5/23 BE）", ev("document.getElementById('gal-progress').textContent"));
  ok(ev("document.getElementById('gal-progress').textContent").includes("2 / 15"), "回收室进度（2/15 GE）");

  ev("S=freshState(); S.s={z:0,r:0,m:0,q:3,w:0}; toGame(); go('d7b');");
  await wait(2500);
  const pass = ev("(()=>{const e=document.getElementById('endcard'); return e?e.querySelector('h2').textContent:null;})()");
  ok(pass && pass.includes("81"), "空気≥3 触发「第 81 人 END」", pass);

  ev("document.getElementById('endcard').remove(); S=freshState(); toGame(); go('mx1');");
  await wait(2500);
  const moku = ev("Array.from(document.querySelectorAll('#choices button')).map(b=>b.textContent).join('|')");
  ok(moku.includes("群主挺护着") && moku.includes("阴阳怪气"), "蘑菇汤际遇 3 选项", moku);

  console.log("== 9. 结局协议（__end_/__ge_）+ 读档 ==");
  ev("S=freshState(); toGame(); go('__end_nq2');");
  await wait(100);
  ok(String(ev("(document.getElementById('endcard').querySelector('h2')||{}).textContent")).includes("解散式"), "BE 协议");
  ok(ev("S.unlocked").includes("nq2"), "BE 已录入回收");
  ev("document.getElementById('endcard').remove(); S=freshState(); toGame(); go('__ge_naoqi');");
  await wait(100);
  ok(ev("S.unlocked").includes("ge_naoqi"), "GE 协议 + 解锁");

  console.log("\n== 错误日志 ==");
  console.log(logs.length ? logs.join("\n") : "无 ✓");
  console.log(failed === 0 && logs.length === 0 ? "\n[SMOKE TEST PASSED]" : `\n[SMOKE TEST FAILED] ${failed} 项失败, ${logs.length} 条错误`);
  process.exit(failed === 0 && logs.length === 0 ? 0 : 1);
})();