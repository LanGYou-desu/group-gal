# group-gal 重构设计（单文件 HTML → Vite + TypeScript）

- 日期：2026-10-11
- 分支：`refactor/vite-ts`
- 状态：待评审

---

## 1. 背景

`group-gal` 是一个把真实 QQ 群（群号 `1058585968`，Arcaea / 舞萌音游群）二创成 galgame 的同人项目。

现状是**一个 907 行的单文件** `group-chat-galgame.html`：HTML + CSS + JS + 剧情数据 + 角色数据全部内联，零依赖、零构建，双击即玩、离线可玩。

### 现状里三层是耦合的

| 层 | 内容 | 行数 |
|---|---|---|
| 剧情数据 | `CHARS`（14 角色）/ `S`（剧本节点数组）/ `BEDATA` / `ENDING` | ~420 |
| 引擎 | `play()` 解释器、`pushMsg/pushCard/pushSys`、`applyEff`、`renderHub`、结局判定 | ~200 |
| 表现 + 音频 | CSS、`sil()` SVG 剪影立绘、`BGM` Web Audio 合成 | ~280 |

剧本规模：约 180 个节点 / 12 种节点类型 / 34 个 label / 54 处 `goto` / 16 个选项节点（约 50 个选项）/ 9 个 Bad End（7 个由剧本节点直接触发 + 2 个由结局判定触发）/ 7 条路线结局。

### 现状已确认的缺陷

| # | 缺陷 | 位置 | 后果 |
|---|---|---|---|
| 1 | `goLabel()` 遇到不存在的 label 会**静默跳到结局** | `group-chat-galgame.html:731-735` | 写错 `goto` 不报错，玩家莫名通关 |
| 2 | `hub` 的 `once` 用**按钮文字**当去重键 | `:430-436`、`:756` | 改一次文案，"只触发一次"的分支重新出现 |
| 3 | 无存档 / 读档 | 全文无 `localStorage` | VN 标配功能缺失 |
| 4 | 无回想（backlog） | 历史只存在于 DOM | 游戏不知道自己说过什么，"复读"靠 DOM 反查 |
| 5 | 无剧本校验、无测试 | — | 剧情的分支图（枢纽 / once 标记 / 好感度阈值 / BE 触发）无法验证 |
| 6 | 剧情与引擎交织 | 全文件 | 加一段剧情要在 700 行代码里翻找 |

---

## 2. 目标与非目标

### 目标（按用户确认的优先级）

1. **方便持续加剧情内容** —— 加内容 = 新建文件，不碰引擎与 UI
2. **补齐 VN 标配功能** —— 存档 / 读档、回想、设置
3. **工程化** —— TypeScript 类型安全、模块化、剧本校验、自动化测试

### 非目标（明确不做）

- **不重写任何剧情文本或人设** —— 全部机械搬运，见 §11
- **不引入 UI 框架** —— 见 §4 选型理由
- **不做多语言、联机、成就系统** —— YAGNI
- **不把真实聊天记录入库** —— 见 §10

---

## 3. 成功标准

1. 重构后**行为与现状一致**：同一条选项路径产生相同的渲染序列与终态（见 §11 等价性验收）
2. `npm run build` 产出**单文件 HTML**，双击可玩、离线可玩，无外部请求
3. `npm run check:script` 能在**构建前**拦下断裂的 `goto`、不存在的角色键、缺文本的 BE
4. 新增一章剧情**只需新建一个 `content/chapters/*.ts`**
5. `npm test` 覆盖：校验器、引擎状态转移、好感度结算、存档往返与迁移
6. 存档 / 读档 / 回想可用

---

## 4. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 构建 | **Vite** | dev 有 HMR，build 有成熟产物；`vite-plugin-singlefile` 能打包回单文件 |
| 语言 | **TypeScript**（strict） | 判别联合类型直接消灭 §1 缺陷 1/2；IDE 补全让写剧本变快 |
| UI 层 | **原生 DOM，无框架** | 见下 |
| 测试 | **Vitest** | 与 Vite 同源，零额外配置 |
| 音频 | **沿用 Web Audio 合成** | 现状就是这个，免版权、离线可播，无需资源文件 |
| 立绘 | **沿用 SVG 剪影生成** | 同上 |

### 为什么 UI 不引入框架

这个项目的复杂度**集中在内容（剧本），不在 UI**。UI 只有三块：聊天流、成员抽屉、弹窗。聊天是**追加式**的（`appendChild` + 定时揭示），原生 DOM 天然契合且性能最好；框架在这类流式列表上反而要处理 key / 重渲染。

为这点 UI 引入框架，多出来的一层抽象不抵收益。

> **重新评估的触发条件**：若后续「VN 标配功能」持续膨胀到多存档槽 + 设置面板 + CG 图鉴 + 多语言同时存在，可再评估 Svelte。届时引擎层（§6）无需改动，只换 UI 层实现。

### 已评估并排除：Ren'Py

Ren'Py 是「立绘 + 背景」的 ADV 引擎，核心范式与本项目「聊天气泡 + 群成员抽屉」的界面**对不上**；且它无法产出 HTML，会直接破坏「单文件双击即玩」与「Pages 在线玩」两条分发路线。排除。

---

## 5. 目录结构

```
group-gal/
├─ index.html                    # Vite 入口，仅剩挂载点
├─ vite.config.ts                # singlefile 插件 + Pages base
├─ tsconfig.json
├─ package.json
├─ .gitignore / .gitattributes / .editorconfig
├─ src/
│  ├─ main.ts                    # 启动装配：引擎 + 真实渲染器
│  ├─ engine/                    # 纯逻辑，零 DOM 依赖
│  │  ├─ types.ts                # 剧本节点判别联合、角色、状态类型
│  │  ├─ runner.ts               # 解释器
│  │  ├─ state.ts                # GameState、存档序列化与迁移
│  │  ├─ effects.ts              # 好感度结算、阶段计算
│  │  └─ validate.ts             # 剧本图校验器
│  ├─ content/
│  │  ├─ characters.ts           # 角色表
│  │  ├─ endings.ts              # BE / 结局文本
│  │  └─ chapters/
│  │     ├─ index.ts             # 拼装全剧本 + 建 label 索引
│  │     ├─ prologue.ts          # 序章
│  │     ├─ ch1.ts               # 第一章
│  │     ├─ hub.ts               # 支线枢纽 + 6 条支线
│  │     └─ ch3.ts               # 第三章
│  ├─ ui/
│  │  ├─ chat.ts                 # 聊天流渲染
│  │  ├─ composer.ts             # 选项 / 枢纽按钮
│  │  ├─ drawer.ts               # 群成员抽屉
│  │  ├─ overlay.ts              # 结局 / 关于弹窗
│  │  ├─ toasts.ts               # 好感度浮层
│  │  ├─ backlog.ts              # 回想
│  │  ├─ saves.ts                # 存档界面
│  │  ├─ settings.ts             # 设置界面
│  │  └─ silhouettes.ts          # SVG 立绘
│  ├─ audio/bgm.ts               # Web Audio 合成
│  └─ styles/                    # 按块拆分的 CSS
├─ docs/
│  ├─ persona/                   # ← .gitignore，人设档案（含真实 QQ 号）
│  └─ superpowers/specs/         # 本文件
└─ tests/
```

**加新剧情 = 在 `content/chapters/` 新建一个文件并在 `index.ts` 里登记。**

---

## 6. 数据模型

### 6.1 剧本节点

从「数组的数组」改为**带字段名的判别联合**：

```ts
// 现状：数组下标寻址，写错没人拦
['msg', 'yu', '新人 你玩机械动力吗']

// 改为：具名字段
{ kind: 'say', who: 'yu', text: '新人 你玩机械动力吗' }
```

完整节点类型：

```ts
export type Node =
  | { kind: 'label';  name: Label }
  | { kind: 'say';    who: CharKey; text: string }
  | { kind: 'sys';    text: string }
  | { kind: 'note';   text: string }
  | { kind: 'card';   who: CharKey }
  | { kind: 'bgm';    track: TrackName }
  | { kind: 'aff';    eff: AffDelta }
  | { kind: 'set';    flag: FlagKey }
  | { kind: 'goto';   label: Label }
  | { kind: 'choice'; prompt: string; options: ChoiceOption[] }
  | { kind: 'hub';    prompt: string; options: HubOption[] }
  | { kind: 'be';     id: BeId }
  | { kind: 'ending' };
```

> 类型名映射：`msg → say`、`jump → goto`，其余同名。**内容一字不改**，只改承载形式。

### 6.2 类型收紧对照

| 字段 | 现状 | 改为 | 拦住的缺陷 |
|---|---|---|---|
| `who` / `card.who` | 任意字符串 | `CharKey` 联合 | 角色键拼错 |
| `be.id` | 字符串 | `BeId` 联合 | BE 编号拼错 |
| `set.flag` | 任意字符串 | `FlagKey` 联合 | flag 拼错导致分支永不触发 |
| `hub` 选项去重键 | **按钮文字** | 新增稳定 `id: string` | 改文案丢进度（缺陷 2） |
| `goto.label` | 运行时才知 | 构建期校验 | 静默通关（缺陷 1） |

### 6.3 选项

```ts
export interface ChoiceOption {
  label: string;            // 按钮文字
  say?: string;             // 实际发出的消息，默认 = label
  eff?: AffDelta;           // 好感度增量
  set?: FlagKey;            // 置位标记
  goto: Label;              // 跳转目标
}

export interface HubOption {
  id: string;               // ★ 稳定去重键，取代原按钮文字
  label: string;
  once?: boolean;           // 是否只触发一次
  eff?: AffDelta;
  set?: FlagKey;
  goto: Label;
}
```

### 6.4 角色与状态

```ts
export type CharKey =
  | 'nanao' | 'yu' | 'cat' | 'g' | 'shisuan' | 'tttt' | 'shei'
  | 'shiban' | 'taffy' | 'c30586' | 'mianbao'   // 可攻略
  | 'gen' | 'aka' | 'moku';                      // 助攻 / 反派

export interface Character {
  key: CharKey;
  name: string;  sub: string;  emoji: string;  color: string;
  role: string;  desc: string;
  hero: boolean;                 // 是否计入好感度
  shape: SilhouetteShape;
}

export type AffDelta = Partial<Record<CharKey, number>>;

/** 现状剧本里出现的全部标记，收成联合类型以拦住拼写错误 */
export type FlagKey =
  | 'sheiTrap'   // 接受了誰的"攻略对象"邀请
  | 'mokuJoin'   // 附和了蘑菇汤
  | 'actGood'    // 活动组织成功
  | 'actSkip';   // 放了这个群的鸽子（→ BE10 判定）

/** 9 个 Bad End：BE01/02/05/17/19/20/24 由剧本节点触发；BE10/23 由结局判定触发 */
export type BeId =
  | 'BE01' | 'BE02' | 'BE05' | 'BE17' | 'BE19' | 'BE20' | 'BE24'
  | 'BE10' | 'BE23';

export interface GameState {
  schemaVersion: number;         // ★ 存档迁移用
  aff: Record<CharKey, number>;
  flags: Partial<Record<FlagKey, boolean>>;
  water: number;                 // 水群值
  members: number;               // 群成员数
  hub: Record<string, boolean>;  // hub 选项 id → 是否已触发
  // 复读检测（现状在 state 里，保留）
  lastRepeat: string;
  repeatN: number;
}
```

### 6.5 回想所需的新数据

现状历史只存在于 DOM，游戏不知道自己说过什么。新增：

```ts
export type LogEntry =
  | { kind: 'say';  who: CharKey | 'me'; text: string; at: number }
  | { kind: 'sys';  text: string; at: number }
  | { kind: 'note'; text: string; at: number };

export interface Session {
  state: GameState;
  ip: number;                    // 当前剧本指针
  history: LogEntry[];           // ★ 供回想与复读使用
}
```

`Session` 随存档一起序列化。

---

## 7. 引擎与渲染解耦

引擎**不含任何 DOM 代码**，通过注入的渲染接口驱动界面。这是「工程化」目标的实际落点——剧情分支第一次变得可测。

```ts
export interface Renderer {
  say(who: CharKey | 'me', text: string): Promise<void>;
  sys(text: string): Promise<void>;
  note(text: string): Promise<void>;
  card(who: CharKey): Promise<void>;
  bgm(track: TrackName): void;
  aff(eff: AffDelta): void;
  toast(text: string): void;
  askChoice(prompt: string, options: ChoiceOption[]): Promise<number>;
  askHub(prompt: string, options: HubOption[]): Promise<number>;
  showBE(id: BeId): Promise<void>;
  showEnding(session: Session): Promise<void>;
  /** 等待时长策略（快进开关在这里生效） */
  readonly delay: DelayPolicy;
}

export async function run(session: Session, script: Script, r: Renderer): Promise<void>;
```

- **生产**：`ui/*` 实现真实 DOM 渲染器
- **测试**：`FakeRenderer` 记录调用序列，可无头跑完整张剧情图

`DelayPolicy` 把现在的 `fast` 快进开关抽成配置，默认值与现状对齐（消息 520ms、系统 560ms、旁白 680ms、卡片 760ms、玩家消息 280ms）。

---

## 8. 存档 / 读档 / 回想

- `Session`（含 `state` + `ip` + `history`）是纯 JSON，直接 `JSON.stringify` 存 localStorage
- 键名带版本：`group-gal/session/v1`
- **3 个手动存档槽 + 1 个自动存档**（每次进入选项节点时自动存）
- `migrate(raw: unknown): Session` 负责老存档升级；`schemaVersion` 不匹配时走迁移链，迁移不了则丢弃并提示
- **回想**：从 `history` 渲染可滚动的过往消息列表；**复读**功能改为从 `history` 取最后一条，不再依赖 DOM 反查（顺带修掉现状的脆弱点）

---

## 9. 剧本校验器与测试

### 9.1 `validate.ts` 检查项

| 检查 | 拦住的缺陷 |
|---|---|
| 每个 `goto` / `choice.goto` / `hub.goto` 的目标 label 存在 | 缺陷 1（静默通关） |
| 每个 `say.who` / `card.who` 在 `CHARS` 里 | 角色键拼错 |
| 每个 `be.id` 在 `BEDATA` 里有文本 | 有 id 无内容 |
| 每个 `label` 唯一 | 重复 label 导致跳转错位 |
| 无不可达节点 | 死剧情 |
| `hub` 选项 `id` 唯一 | 去重失效 |
| （警告）`set` 的 flag 从未被读取 | 写了没用的标记 |

### 9.2 运行位置

1. `npm run check:script` —— 手动跑
2. Vitest 里作为测试
3. **`vite build` 前置** —— 剧本写坏则构建失败，而不是等玩家踩到

### 9.3 测试清单（Vitest）

- 校验器：全剧本通过
- 引擎：给定剧本 + 固定选项序列 → 状态转移符合预期
- 好感度结算与阶段计算（`stageOf`）
- 结局判定：`actSkip` 且总分 ≤6 → BE10；总分 ≤4 → BE23；否则按最高好感出路线
- 存档：序列化 → 反序列化往返一致；老版本存档迁移正确
- **全图遍历**：从 `start` 出发穷举所有选项组合，断言不崩、不落到不存在的 label（分支覆盖）

### 9.4 端到端（可选，后续）

Playwright 已在环境中可用，可作为后续增强：真浏览器跑通关流程、验证单文件产物可离线打开。

---

## 10. 人设档案

从 `D:/CodeWorks/qqanalyser/archive/1058585968/` 的分析材料（`analyse.md` 为唯一事实来源，两个 PDF 是它的编译产物）提炼。

- 产出位置：`docs/persona/`
- **`docs/persona/` 已写入 `.gitignore`** —— 档案含真实 QQ 号、群名片与聊天内容，禁止入库、禁止推送
- 粒度：每个角色一份，含
  1. 原型成员（QQ 号 / 现用名 / 群内角色）
  2. 群内行为特征（发言量、话题分布、互动对象）
  3. 转译后的人设定位（游戏内 `role` / `desc`）
  4. 口头禅与常用语库（对应 `members/*.md` 里的真实发言）
  5. 关系网（与哪些角色有互动，可作好感度联动）
  6. 可用剧情钩子

> 分析报告刻画的是真实群像（核心层 8 人占 60% 消息量、卖弱/嘴臭的群文化、活动成功率不足 20%）；游戏做的是**温情化二创**——把真实特质转译成人设。这个转译是创作，不是机械提取，因此人设档案是**供人读的参考**，不进构建、不参与自动生成。

---

## 11. 迁移策略（两阶段，保证全程可玩）

> **核心原则：不重写内容，先等价搬运，再增量加功能。**

### 阶段 1 · 机械搬运（行为不变）

1. 搭 Vite + TS 骨架
2. 把现有 `S` 的约 180 个节点**逐条翻译**成 §6.1 的新格式
3. `CHARS` / `BEDATA` / `ENDING` 原样搬进 `content/`
4. UI 层按现状行为实现，`BGM` 与 `sil()` 原样搬运
5. **验收：等价性对比**

### 等价性验收方法

- 旧版：在浏览器里跑一遍，走固定选项路径，记录「渲染序列 + 终态」
- 新版：用 `FakeRenderer` 跑同一条路径，比对「渲染序列 + 终态」
- 对**多条路径**（至少：正常通关、每条支线、每条 BE 的触发路径）比对

> **等价的定义**：渲染项的顺序与内容、以及终态（`aff` / `flags` / `water` / 结局 id）一致。
> **不要求**：动画时长逐毫秒一致——计时改由 `DelayPolicy` 驱动，默认值对齐现状，但允许用快进改变。

### 阶段 2 · 增量（在跑通的基础上）

- 剧本校验器 + 测试
- 存档 / 读档 / 回想 / 设置
- 章节拆分（阶段 1 可先整体搬运，阶段 2 再拆）
- 单文件与 Pages 构建
- 人设档案

---

### 阶段 3 · 前端优化（用户授权：前端可自行优化）

在阶段 1 把搬运正确性钉死之后，用 `frontend-design` 技能做一次正经的设计重做。

**为什么必须排在阶段 1 之后**：阶段 1 的全部价值在于可验证——新版本要证明与现状行为一致。
若同时改视觉，一旦出现异常将**无法区分是搬运 bug 还是设计改动**。因此阶段 1 要求
**DOM 结构与 class 名保持原样**，让 CSS 能整体迁移并支持肉眼并排比对。

**等价性只约束游戏逻辑**（剧本流程、选项效果、好感度、结局），**不约束视觉**。
阶段 3 的优化方向：

- 排版层级与信息密度（聊天流可读性、气泡节奏）
- 动效节奏（消息揭示、抽屉、弹窗）
- 移动端手感（安全区、触控目标尺寸、软键盘）
- 响应式断点
- 无障碍（对比度、焦点管理、`prefers-reduced-motion`）

### 阶段 4 · 人设档案

见 §10。放在最后，因为它是内容工作，不阻塞工程。

### 阶段 5 · 台词修订（用户授权：「剧情结局对话可根据人设档案自行修改」）

**前提：阶段 4 的人设档案必须先存在**——否则「根据人设档案修改」的依据仍是原始报告，授权被降级成凭感觉改。

修订边界（自行拟定，待用户确认）：

| 项 | 决定 |
|---|---|
| **改什么** | 让每个角色的台词贴合其口癖与关注点（从 `members/*.md` 的真实发言提炼） |
| **不改什么** | 剧情走向、分支结构、结局判定逻辑、好感度数值 —— 作品骨架 |
| **基调** | 保持现有温情二创基调。原始报告相当尖刻，游戏已把它转译成善意调侃；朝尖刻方向改是大得多的改动，不擅自做 |

**为什么不能与阶段 1 合并**：阶段 1 的等价性验证手段是「台词一字未改动，故渲染序列必须完全一致」。
在阶段 1 改台词等于拆掉唯一的正确性证明。两个动作必须分开。

---

## 12. 构建与分发

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite dev server + HMR |
| `npm run build` | `vite-plugin-singlefile` → `dist/index.html` 单文件，内联 JS/CSS，无外部请求 |
| `npm run build:pages` | 常规多文件构建，`base` 适配 Pages 子路径 |
| `npm test` | Vitest |
| `npm run check:script` | 剧本校验器 |
| `npm run typecheck` | `tsc --noEmit` |

### 部署现状

GitHub 在本机**连不通**（`github.com` 超时；`gitee.com` 与 npm registry 正常；未配代理）。因此：

- `upstream` 远端已加上，但**设为只读**（push URL = `no_push`）
- Pages 部署脚本先写好，**托管目标待定**：Gitee Pages / 本地代理可用后走 GitHub Pages
- 本地开发、提交、构建**不受影响**

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 搬运 180 个节点时漏改 / 错改 | 剧情行为漂移 | 阶段 1 只做等价搬运 + 多路径对比验收；校验器兜底 |
| 单文件产物被插件漏内联（如 CSS 未内联） | 破坏「无外部请求」 | 构建后断言 `dist/index.html` 无 `src=`/`href=` 外链 |
| 首次 `npm install` 依赖下载 | 需要网络 | npm registry 已确认可达；若失败则回退到仅 TS 编译 + 手动打包 |
| 存档格式后续变动 | 老档失效 | `schemaVersion` + `migrate()` 迁移链 |
| 重构期间上游有更新 | 合并冲突 | `upstream` 只读，网络恢复后先 fetch 比对 |

---

## 14. 未决项

1. **Pages 托管目标**：Gitee Pages，还是等代理可用后走 GitHub Pages？（不阻塞开发）
2. **GitHub 代理**：是否需要我配置本地代理（需你提供端口）？（不阻塞开发）
3. **人设档案粒度**：按 §10 的六段式，是否符合预期？

---

## 15. 实施顺序

**阶段 1（等价重构）** —— 计划：`docs/superpowers/plans/2026-10-11-group-gal-refactor-stage1.md`

1. 项目骨架（package.json / tsconfig / vite.config / index.html）+ `npm install`
2. 类型定义
3. 角色数据、结局数据
4. 引擎：好感度结算、结局判定、复读逻辑（TDD）
5. 剧本校验器（TDD）
6. 剧本解释器（TDD）
7. 剧本搬运：序章 → 第一章 → 支线枢纽与六条支线 → 第三章与结局标签
8. UI 外壳与样式（结构与现状一致）
9. 立绘与音频搬运
10. 聊天流、浮层、选项、抽屉、弹窗
11. 装配与驱动
12. **等价性验收**（自动化走查 + 手工并排比对）

**阶段 2（VN 标配功能）** 13. 存档 / 读档（`schemaVersion` + 迁移） 14. 回想（backlog） 15. 设置面板 16. Pages 构建

**阶段 3（前端优化）** 17. 设计重做：排版层级、动效、移动端手感、响应式、无障碍

**阶段 4（内容）** 18. 人设档案 `docs/persona/`

**阶段 5（文本）** 19. 台词修订：按人设档案统一各角色口癖，不动剧情骨架与基调
