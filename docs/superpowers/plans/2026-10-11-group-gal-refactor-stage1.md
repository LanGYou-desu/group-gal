# group-gal 阶段 1（等价重构）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 907 行单文件 `group-chat-galgame.html` 重构为 Vite + TypeScript 的模块化工程，**行为与现状完全一致**。

**Architecture:** 保留原有「节点数组 + 解释器」引擎设计，但把引擎与 DOM 解耦——引擎通过注入的 `Renderer` 接口驱动界面，于是剧情分支第一次可被无头测试。剧本节点从「数组的数组」改为带字段名的判别联合类型，配合一个构建期校验器拦住断裂的 `goto`、拼错的角色键、缺文本的 Bad End。

**Tech Stack:** Vite 7 · TypeScript 5（strict）· Vitest 3 · vite-plugin-singlefile

**Spec:** `docs/superpowers/specs/2026-10-11-group-gal-refactor-design.md`

## Global Constraints

- 源文件：`group-chat-galgame.html`（907 行，UTF-8 **无 BOM**）。**阶段 1 全程保留该文件，不删除、不修改**——它是等价性比对的基准。
- **不重写任何剧情文本或人设**。`CHARS` / `S` / `BEDATA` / `ENDING` 的内容一字不改，只改承载形式。
- 新增文件一律 UTF-8 无 BOM、LF、2 空格缩进（见 `.editorconfig`）。
- TypeScript 开 `strict`，禁用 `any`（校验器里解析不可信 JSON 时允许 `unknown` + 收窄）。
- 引擎目录 `src/engine/` **不得出现任何 DOM API**（`document` / `window` / `localStorage`）。这是可测试性的前提。
- 节点类型名映射：`msg → say`、`jump → goto`，其余同名。
- 计时默认值必须对齐现状：玩家消息 280ms、他人消息 520ms、系统 560ms、旁白 680ms、卡片 760ms。
- 好感度下限为 0（`Math.max(0, ...)`），非 `hero` 角色的 `eff` 一律忽略（现状行为）。
- 提交信息末尾附 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## Review Focus

以下五类输入是本计划的任务测试**覆盖不到**、但最可能让玩家踩坑的，各自应在所属任务里补一条测试：

1. **`goto` 指向不存在的 label（运行时构造）** —— 校验器能拦住静态剧本，但若运行时走到未登记 label，`runner` 必须**抛错**，而不是像现状那样静默跳结局。
2. **复读计数的连续性** —— 同一句连续复读 3 次触发 BE24；中间插入任何他人消息后计数必须归零，"连续"的语义不能被打破。
3. **好感度为 0 时收到负向 `eff`** —— 数值应钳制在 0，且**不应**弹出 `💔 -1` 的浮层（因为没有实际变化）。
4. **快进开启时的长延迟节点** —— 所有等待必须经过 `DelayPolicy` 并被钳制，卡片的 760ms 在快进下不得仍是 760ms。
5. **`hub` 的全部 `once` 选项走完后** —— 面板上必须只剩「推进主线」，且此时不能渲染出空按钮。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `index.html` | Vite 入口，仅挂载点 |
| `vite.config.ts` | 构建配置，singlefile 插件 |
| `tsconfig.json` | TS 严格模式 |
| `package.json` | 依赖与脚本 |
| `src/engine/types.ts` | 全部类型：节点判别联合、角色、状态、Renderer 接口 |
| `src/engine/effects.ts` | 好感度结算、阶段计算、初始状态 |
| `src/engine/ending.ts` | 结局判定（纯函数） |
| `src/engine/runner.ts` | 解释器：驱动剧本，调用 Renderer |
| `src/engine/validate.ts` | 剧本图校验器 |
| `src/content/characters.ts` | 14 个角色 |
| `src/content/endings.ts` | 9 个 BE + 7 条路线结局文本 |
| `src/content/chapters/*.ts` | 按章拆分的剧本 |
| `src/content/chapters/index.ts` | 拼装全剧本 + label 索引 |
| `src/ui/silhouettes.ts` | SVG 剪影立绘 |
| `src/ui/chat.ts` | 聊天流（say/sys/note/card） |
| `src/ui/composer.ts` | 选项与枢纽按钮 |
| `src/ui/drawer.ts` | 群成员抽屉 |
| `src/ui/overlay.ts` | 结局 / 关于弹窗 |
| `src/ui/toasts.ts` | 浮层提示 |
| `src/ui/renderer.ts` | 把上述组装成 `Renderer` 实现 |
| `src/audio/bgm.ts` | Web Audio 合成 + 音效 |
| `src/styles/*.css` | 按块拆分的样式 |
| `src/main.ts` | 启动装配 |
| `tests/*.test.ts` | Vitest 用例 |
| `tests/fake-renderer.ts` | 记录调用序列的假渲染器 |
| `tests/equivalence/baseline.json` | 现状渲染序列基线 |

---

### Task 1: 项目骨架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 Vite 工程；`npm run dev` / `npm run build` / `npm test` 可用

- [ ] **Step 1: 建 `package.json`**

```json
{
  "name": "group-gal",
  "private": true,
  "version": "0.3.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run check:script && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "check:script": "tsx src/engine/validate.cli.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vite": "^7.0.0",
    "vite-plugin-singlefile": "^2.1.0",
    "vitest": "^3.0.0",
    "tsx": "^4.19.2"
  }
}
```

- [ ] **Step 2: 建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: 建 `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // base 用相对路径，令单文件产物可被 file:// 直接打开
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000, // 强制内联一切资源
    cssCodeSplit: false,
  },
});
```

- [ ] **Step 4: 建 `index.html`（挂载点）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>😂群聊 · 全群攻陷计划</title>
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: 建占位 `src/main.ts`**

```ts
const app = document.getElementById('app');
if (app) app.textContent = '骨架就绪';
```

- [ ] **Step 6: 安装依赖**

Run: `npm install`
Expected: 安装成功，生成 `package-lock.json` 与 `node_modules/`

> 若失败（npm registry 不可达），停下并报告——不要改用 CDN 或手动打包。npm registry 已确认可达（HTTP 200）。

- [ ] **Step 7: 验证骨架**

Run: `npm run typecheck && npm run build`
Expected: 通过；`dist/index.html` 生成且**不含任何外部 `src=` / `href=` 引用**

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: 搭建 Vite + TypeScript 项目骨架"
```

---

### Task 2: 类型定义

**Files:**
- Create: `src/engine/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 后续所有任务依赖的全部类型 —— `CharKey`、`TrackName`、`FlagKey`、`BeId`、`Label`、`Character`、`AffDelta`、`ChoiceOption`、`HubOption`、`Node`、`Script`、`GameState`、`LogEntry`、`Session`、`DelayPolicy`、`Renderer`、`EndingResolution`

- [ ] **Step 1: 写类型文件**

```ts
/* 剧本与游戏的类型定义。此文件不含任何运行时代码。 */

export type TrackName = 'chat' | 'night' | 'tension' | 'warm';

export type SilhouetteShape =
  | 'crown' | 'fish' | 'cat' | 'star' | 'garlic' | 'mask' | 'egg'
  | 'fin' | 'bucket' | 'moon' | 'bread' | 'wrench' | 'wave'
  | 'mushroom' | 'dot';

/** 可攻略角色 + 助攻/反派。 */
export type CharKey =
  | 'nanao' | 'yu' | 'cat' | 'g' | 'shisuan' | 'tttt' | 'shei'
  | 'shiban' | 'taffy' | 'c30586' | 'mianbao'
  | 'gen' | 'aka' | 'moku';

/** 玩家自己。渲染成右侧气泡，不计好感度。 */
export type Speaker = CharKey | 'me';

export interface Character {
  readonly name: string;
  readonly sub: string;
  readonly emoji: string;
  readonly color: string;
  readonly role: string;
  readonly desc: string;
  /** 是否计入好感度（= 现状的 AFFKEYS 成员） */
  readonly hero: boolean;
  readonly shape: SilhouetteShape;
}

export type CharTable = Readonly<Record<CharKey, Character>>;

export type AffDelta = Partial<Record<CharKey, number>>;

/** 现状剧本里出现的全部标记，收成联合以拦住拼写错误。 */
export type FlagKey = 'sheiTrap' | 'mokuJoin' | 'actGood' | 'actSkip';

/** 7 个由剧本节点触发 + 2 个由结局判定触发。 */
export type BeId =
  | 'BE01' | 'BE02' | 'BE05' | 'BE17' | 'BE19' | 'BE20' | 'BE24'
  | 'BE10' | 'BE23';

/** label 是数据里定义的自由字符串，由校验器保证引用有效。 */
export type Label = string;

export interface ChoiceOption {
  readonly label: string;
  /** 实际发出的消息，缺省时等于 label */
  readonly say?: string;
  readonly eff?: AffDelta;
  readonly set?: FlagKey;
  readonly goto: Label;
}

export interface HubOption {
  /** 稳定去重键。取代现状用按钮文字当键的做法。 */
  readonly id: string;
  readonly label: string;
  readonly once?: boolean;
  readonly eff?: AffDelta;
  readonly set?: FlagKey;
  readonly goto: Label;
}

export type Node =
  | { readonly kind: 'label';  readonly name: Label }
  | { readonly kind: 'say';    readonly who: Speaker; readonly text: string }
  | { readonly kind: 'sys';    readonly text: string }
  | { readonly kind: 'note';   readonly text: string }
  | { readonly kind: 'card';   readonly who: CharKey }
  | { readonly kind: 'bgm';    readonly track: TrackName }
  | { readonly kind: 'aff';    readonly eff: AffDelta }
  | { readonly kind: 'set';    readonly flag: FlagKey }
  | { readonly kind: 'goto';   readonly label: Label }
  | { readonly kind: 'choice'; readonly prompt: string; readonly options: readonly ChoiceOption[] }
  | { readonly kind: 'hub';    readonly prompt: string; readonly options: readonly HubOption[] }
  | { readonly kind: 'be';     readonly id: BeId }
  | { readonly kind: 'ending' };

export type Script = readonly Node[];

export type LabelIndex = Readonly<Record<Label, number>>;

export interface EndingData {
  readonly tag: string;
  readonly title: string;
  readonly text: string;
}

export interface GameState {
  readonly schemaVersion: number;
  readonly aff: Record<CharKey, number>;
  readonly flags: Partial<Record<FlagKey, boolean>>;
  readonly water: number;
  readonly members: number;
  /** hub 选项 id → 是否已触发 */
  readonly hub: Record<string, boolean>;
  /** 复读检测：上一句被复读的内容 */
  readonly lastRepeat: string;
  /** 连续复读次数 */
  readonly repeatN: number;
}

export type LogEntry =
  | { readonly kind: 'say';  readonly who: Speaker; readonly text: string }
  | { readonly kind: 'sys';  readonly text: string }
  | { readonly kind: 'note'; readonly text: string };

/** 存档单位：状态 + 剧本指针 + 历史。三者都是纯 JSON。
 *  字段可变——`run()` 把它当作可变工作副本就地推进。 */
export interface Session {
  state: GameState;
  /** 剧本节点指针：指向「下一个待执行节点」 */
  ip: number;
  history: LogEntry[];
}

/** 等待时长策略。快进开关在这里生效。 */
export interface DelayPolicy {
  readonly me: number;
  readonly msg: number;
  readonly sys: number;
  readonly note: number;
  readonly card: number;
  /** 快进时为 true，所有等待被钳制到上限 */
  readonly fast: boolean;
}

export type EndingResolution =
  | { readonly kind: 'be'; readonly id: BeId }
  | { readonly kind: 'route'; readonly key: CharKey };

/** 引擎驱动界面的唯一出口。引擎不含 DOM，所有副作用经此发生。 */
export interface Renderer {
  say(who: Speaker, text: string): Promise<void>;
  sys(text: string): Promise<void>;
  note(text: string): Promise<void>;
  card(who: CharKey): Promise<void>;
  bgm(track: TrackName): void;
  /** 好感度变化：状态已由引擎结算，这里只负责展示 */
  affToast(items: readonly AffToastItem[]): void;
  toast(text: string): void;
  askChoice(prompt: string, options: readonly ChoiceOption[]): Promise<number>;
  askHub(prompt: string, options: readonly HubOption[]): Promise<number>;
  showBE(id: BeId): Promise<void>;
  showEnding(resolution: EndingResolution, session: Session): Promise<void>;
  readonly delays: DelayPolicy;
}

export interface AffToastItem {
  readonly who: CharKey;
  readonly delta: number;
}
```

- [ ] **Step 2: 写编译期断言测试**

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { Node, Renderer, Session } from '../src/engine/types';

describe('类型定义', () => {
  it('Node 是判别联合，kind 可收窄', () => {
    const n: Node = { kind: 'say', who: 'yu', text: 'hi' };
    if (n.kind === 'say') {
      expectTypeOf(n.who).toEqualTypeOf<'yu' | 'nanao' | 'cat' | 'g' | 'shisuan' | 'tttt'
        | 'shei' | 'shiban' | 'taffy' | 'c30586' | 'mianbao' | 'gen' | 'aka' | 'moku' | 'me'>();
      expectTypeOf(n.text).toEqualTypeOf<string>();
    }
  });

  it('Renderer 覆盖引擎全部副作用出口', () => {
    expectTypeOf<keyof Renderer>().toEqualTypeOf<
      | 'say' | 'sys' | 'note' | 'card' | 'bgm' | 'affToast' | 'toast'
      | 'askChoice' | 'askHub' | 'showBE' | 'showEnding' | 'delays'
    >();
  });

  it('Session 可被 JSON 往返', () => {
    const s = {} as Session;
    expectTypeOf(JSON.parse(JSON.stringify(s))).toEqualTypeOf<Session>();
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/types.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts tests/types.test.ts
git commit -m "feat(engine): 定义剧本节点判别联合与 Renderer 接口"
```

---

### Task 3: 角色数据

**Files:**
- Create: `src/content/characters.ts`
- Test: `tests/characters.test.ts`

**Interfaces:**
- Consumes: `Character`、`CharTable`、`CharKey`、`SilhouetteShape`（Task 2）
- Produces: `CHARS: CharTable`、`HERO_KEYS: readonly CharKey[]`、`MAIN_KEYS: readonly CharKey[]`

**搬运规则**：源是 `group-chat-galgame.html:195-221` 的 `CHARS` 对象。逐条搬运，**文案一字不改**。变化只有两点：
1. 加 `key` 字段（原对象的键）
2. `sil` 属性在源码里叫 `shape`（源码用的就是 `shape`，保持）

- [ ] **Step 1: 写 `src/content/characters.ts`**

结构如下（**每个角色的 `name`/`sub`/`emoji`/`color`/`role`/`desc`/`shape` 必须与源文件 `:195-221` 逐字一致**）：

```ts
import type { CharKey, CharTable } from '../engine/types';

export const CHARS: CharTable = {
  nanao: {
    name: '闹七', sub: 'null7323 · 群主', emoji: '👑', color: '#ff6ec7', role: '傲娇暴君',
    desc: '😂群聊的群主，自己开着 MC / 帕鲁服务器，还是 Arcaea 知名谱师、写谱高手。嘴硬心软，护短——嘴上天天喊解散群，真踢起人来一次也没舍得。',
    hero: true, shape: 'crown',
  },
  yu: {
    name: '一条鱼', sub: '别问她为什么叫鱼', emoji: '🐟', color: '#5ce1e6', role: '天然呆',
    desc: '这个群最单纯的人，MC 机械动力工程师。平时话不多，一聊红石就停不下来。',
    hero: true, shape: 'fish',
  },
  // … 其余 12 个（cat / g / shisuan / tttt / shei / shiban / taffy /
  //    c30586 / mianbao / gen / aka / moku）从源文件逐条搬运
};

/** 计入好感度的角色（= 现状的 AFFKEYS，顺序即界面显示顺序） */
export const HERO_KEYS: readonly CharKey[] = [
  'nanao', 'yu', 'cat', 'g', 'shisuan', 'tttt', 'shei',
  'shiban', 'taffy', 'c30586', 'mianbao',
];

/** 参与路线结局评选的角色（= 现状的 MAIN） */
export const MAIN_KEYS: readonly CharKey[] = [
  'nanao', 'yu', 'cat', 'g', 'shisuan', 'tttt', 'shei',
];
```

> `gen` / `aka` / `moku` 三个角色在源码里**没有 `hero` 字段**，即为非可攻略，搬运时写 `hero: false`。

- [ ] **Step 2: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { CHARS, HERO_KEYS, MAIN_KEYS } from '../src/content/characters';

describe('角色数据', () => {
  it('恰好 14 个角色', () => {
    expect(Object.keys(CHARS)).toHaveLength(14);
  });

  it('HERO_KEYS 与 hero:true 的角色完全一致', () => {
    const heroes = (Object.keys(CHARS) as (keyof typeof CHARS)[]).filter(k => CHARS[k].hero);
    expect([...HERO_KEYS].sort()).toEqual([...heroes].sort());
  });

  it('MAIN_KEYS 是 HERO_KEYS 的子集', () => {
    for (const k of MAIN_KEYS) expect(HERO_KEYS).toContain(k);
  });

  it('每个角色字段非空且颜色是 6 位十六进制', () => {
    for (const [key, c] of Object.entries(CHARS)) {
      expect(c.name, key).toBeTruthy();
      expect(c.emoji, key).toBeTruthy();
      expect(c.role, key).toBeTruthy();
      expect(c.color, key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('闹七是群主，蘑菇汤是反派', () => {
    expect(CHARS.nanao.sub).toContain('群主');
    expect(CHARS.moku.role).toBe('反派');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/characters.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 4: Commit**

```bash
git add src/content/characters.ts tests/characters.test.ts
git commit -m "feat(content): 搬运 14 个角色数据"
```

---

### Task 4: 结局数据

**Files:**
- Create: `src/content/endings.ts`
- Test: `tests/endings.test.ts`

**Interfaces:**
- Consumes: `BeId`、`CharKey`、`EndingData`（Task 2）
- Produces: `BEDATA: Readonly<Record<BeId, EndingData>>`、`ENDING: Readonly<Record<CharKey, EndingData>>`

**搬运规则**：源是 `group-chat-galgame.html:608-627`（`BEDATA`，9 条）与 `:629-644`（`ENDING`，7 条）。**文本逐字搬运**，`\n` 保持为 `\n`。

- [ ] **Step 1: 写 `src/content/endings.ts`**

```ts
import type { BeId, CharKey, EndingData } from '../engine/types';

export const BEDATA: Readonly<Record<BeId, EndingData>> = {
  BE01: { tag: 'BAD END', title: 'BE-01 老傻子', text: '…' },
  // … 其余 8 条（BE02 / BE05 / BE17 / BE19 / BE20 / BE24 / BE10 / BE23）
  //    从源文件 :608-627 逐字搬运
};

export const ENDING: Readonly<Record<CharKey, EndingData>> = {
  nanao: { title: '闹七线 · 那个没被解散的群', text: '…' },
  // … 其余 6 条（yu / cat / g / shisuan / tttt / shei）从源文件 :629-644 搬运
};
```

> `ENDING` 的类型是 `Record<CharKey, EndingData>`，但源数据只有 7 个可攻略角色有路线结局。
> **解法**：类型改为 `Partial<Record<CharKey, EndingData>>`，并在 `ending.ts` 里对缺失回退到 `nanao`
> （与现状 `ENDING[top] || ENDING.nanao` 一致）。**此处的类型定义以本任务为准，覆盖 Task 2 的 `types.ts` 写法**——`types.ts` 中不定义 `ENDING` 的类型，由本文件导出。

- [ ] **Step 2: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { BEDATA, ENDING } from '../src/content/endings';
import { MAIN_KEYS } from '../src/content/characters';

describe('结局数据', () => {
  it('9 个 Bad End 全部有标题与正文', () => {
    expect(Object.keys(BEDATA)).toHaveLength(9);
    for (const [id, d] of Object.entries(BEDATA)) {
      expect(d.tag, id).toBe('BAD END');
      expect(d.title, id).toBeTruthy();
      expect(d.text.length, id).toBeGreaterThan(20);
    }
  });

  it('7 条路线结局，且全部可攻略主角都有', () => {
    expect(Object.keys(ENDING)).toHaveLength(7);
    for (const k of MAIN_KEYS) expect(ENDING[k], k).toBeDefined();
  });

  it('BE10 与 BE23 存在（由结局判定触发而非剧本节点）', () => {
    expect(BEDATA.BE10.title).toContain('我很伤心');
    expect(BEDATA.BE23.title).toContain('第 81 人');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/endings.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 4: Commit**

```bash
git add src/content/endings.ts tests/endings.test.ts
git commit -m "feat(content): 搬运 9 个 Bad End 与 7 条路线结局文本"
```

---

### Task 5: 状态与好感度结算

**Files:**
- Create: `src/engine/effects.ts`
- Test: `tests/effects.test.ts`

**Interfaces:**
- Consumes: `GameState`、`AffDelta`、`CharKey`、`CharTable`、`AffToastItem`（Task 2）；`CHARS`、`HERO_KEYS`（Task 3）
- Produces: `SCHEMA_VERSION`、`createInitialState(): GameState`、`applyEff(state, eff, chars): { state, toasts }`、`stageOf(aff): StageName`、`StageName`、`applyRepeat(session): RepeatResult`、`RepeatOutcome`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest';
import { createInitialState, applyEff, stageOf, SCHEMA_VERSION } from '../src/engine/effects';
import { CHARS } from '../src/content/characters';

describe('初始状态', () => {
  it('所有可攻略角色好感度为 0', () => {
    const s = createInitialState();
    expect(s.aff.nanao).toBe(0);
    expect(s.aff.mianbao).toBe(0);
    expect(s.water).toBe(0);
    expect(s.members).toBe(81);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('好感度结算', () => {
  it('累加并回报浮层项', () => {
    const s0 = createInitialState();
    const { state, toasts } = applyEff(s0, { nanao: 2, yu: 1 }, CHARS);
    expect(state.aff.nanao).toBe(2);
    expect(state.aff.yu).toBe(1);
    expect(toasts).toEqual([{ who: 'nanao', delta: 2 }, { who: 'yu', delta: 1 }]);
  });

  it('下限为 0', () => {
    const s0 = createInitialState();
    const { state } = applyEff(s0, { nanao: -5 }, CHARS);
    expect(state.aff.nanao).toBe(0);
  });

  it('好感度为 0 时的负向 eff 不产生浮层（无实际变化）', () => {
    const s0 = createInitialState();
    const { state, toasts } = applyEff(s0, { nanao: -1 }, CHARS);
    expect(state.aff.nanao).toBe(0);
    expect(toasts).toEqual([]);
  });

  it('非 hero 角色的 eff 被忽略（如 moku）', () => {
    const s0 = createInitialState();
    const { state, toasts } = applyEff(s0, { moku: 3 }, CHARS);
    expect(state.aff.moku).toBe(0);
    expect(toasts).toEqual([]);
  });

  it('不修改传入的 state（纯函数）', () => {
    const s0 = createInitialState();
    const before = s0.aff.nanao;
    applyEff(s0, { nanao: 3 }, CHARS);
    expect(s0.aff.nanao).toBe(before);
  });
});

describe('阶段计算', () => {
  it.each([
    [0, '无视'], [1, '眼熟'], [2, '眼熟'], [3, '嘴替'],
    [4, '嘴替'], [5, '宝宝'], [6, '宝宝'], [7, '沦陷'], [99, '沦陷'],
  ])('%i → %s', (aff, expected) => {
    expect(stageOf(aff)).toBe(expected);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/effects.test.ts`
Expected: FAIL — 无法解析 `../src/engine/effects`

- [ ] **Step 3: 实现 `src/engine/effects.ts`**

```ts
import type { AffDelta, AffToastItem, CharTable, GameState } from './types';
import { HERO_KEYS } from '../content/characters';

export const SCHEMA_VERSION = 1;

export function createInitialState(): GameState {
  const aff = {} as Record<string, number>;
  for (const k of HERO_KEYS) aff[k] = 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    aff: aff as GameState['aff'],
    flags: {},
    water: 0,
    members: 81,
    hub: {},
    lastRepeat: '',
    repeatN: 0,
  };
}

export interface ApplyEffResult {
  readonly state: GameState;
  readonly toasts: readonly AffToastItem[];
}

/**
 * 结算一次好感度变化。纯函数，返回新状态。
 * 与现状 group-chat-galgame.html:705-715 行为一致：
 * - 非 hero 角色的键被忽略
 * - 数值下限 0
 * - 只有实际发生变化时才产生浮层项
 */
export function applyEff(state: GameState, eff: AffDelta | undefined, chars: CharTable): ApplyEffResult {
  if (!eff) return { state, toasts: [] };

  const toasts: AffToastItem[] = [];
  const aff = { ...state.aff };
  let changed = false;

  for (const [k, delta] of Object.entries(eff) as [keyof CharTable, number][]) {
    const c = chars[k];
    if (!c || !c.hero || delta === undefined) continue;
    const before = aff[k] ?? 0;
    const after = Math.max(0, before + delta);
    if (after === before) continue;
    aff[k] = after;
    toasts.push({ who: k, delta: after - before });
    changed = true;
  }

  return changed ? { state: { ...state, aff }, toasts } : { state, toasts: [] };
}

export type StageName = '无视' | '眼熟' | '嘴替' | '宝宝' | '沦陷';

/** 与现状 group-chat-galgame.html:716 一致。 */
export function stageOf(aff: number): StageName {
  if (aff <= 0) return '无视';
  if (aff <= 2) return '眼熟';
  if (aff <= 4) return '嘴替';
  if (aff <= 6) return '宝宝';
  return '沦陷';
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/effects.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: 为复读逻辑写失败的测试（Review Focus #2）**

复读逻辑现状藏在 `main.ts` 式的事件回调里（源 `:889-899`），无法单测。**先把它抽成纯函数**，才能钉住「连续性」语义。

在 `tests/effects.test.ts` 追加：

```ts
import { applyRepeat } from '../src/engine/effects';
import type { Session } from '../src/engine/types';

const sess = (history: Session['history']): Session => ({
  state: createInitialState(), ip: 0, history,
});

describe('复读与水群值', () => {
  const yu = { kind: 'say', who: 'yu', text: '新人？' } as const;

  it('无历史时返回 empty，不产生任何变化', () => {
    const r = applyRepeat(sess([]));
    expect(r.outcome).toBe('empty');
    expect(r.session.state.water).toBe(0);
  });

  it('首次复读：水群值 +1，提示成功', () => {
    const r = applyRepeat(sess([yu]));
    expect(r.outcome).toBe('ok');
    expect(r.session.state.water).toBe(1);
    expect(r.session.state.repeatN).toBe(1);
    expect(r.spoken).toBe('新人？');
  });

  it('连续第二次：提示将被禁言', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    expect(r2.outcome).toBe('warn');
    expect(r2.session.state.repeatN).toBe(2);
  });

  it('连续第三次：banned（调用方据此触发 BE24）', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    const r3 = applyRepeat(r2.session);
    expect(r3.outcome).toBe('banned');
    expect(r3.session.state.water).toBe(3);
  });

  it('中间插入他人新消息后，连续性归零', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    expect(r2.session.state.repeatN).toBe(2);
    // 别人发了新消息 → 末条他人消息变了
    const withNew = { ...r2.session, history: [...r2.session.history, { kind: 'say', who: 'g', text: '新谱' }] as Session['history'] };
    const r3 = applyRepeat(withNew);
    expect(r3.outcome).toBe('ok');          // 重置为第 1 次
    expect(r3.session.state.repeatN).toBe(1);
    expect(r3.spoken).toBe('新谱');
  });

  it('复读的是最后一条他人消息，不取自己的', () => {
    const r = applyRepeat(sess([yu, { kind: 'say', who: 'me', text: '我说的话' }]));
    expect(r.spoken).toBe('新人？');
  });

  it('系统消息与旁白不参与复读', () => {
    const r = applyRepeat(sess([yu, { kind: 'sys', text: '成员 80 → 81' }, { kind: 'note', text: '旁白' }]));
    expect(r.spoken).toBe('新人？');
  });
});
```

- [ ] **Step 6: 在 `src/engine/effects.ts` 实现 `applyRepeat`**

```ts
export type RepeatOutcome = 'ok' | 'warn' | 'banned' | 'empty';

export interface RepeatResult {
  readonly session: Session;
  readonly outcome: RepeatOutcome;
  /** 被复读的文本；outcome 为 'empty' 时缺省 */
  readonly spoken?: string;
}

/**
 * 复读：把群里的最后一条他人消息原样再发一次，水群值 +1。
 *
 * 与现状 group-chat-galgame.html:889-899 行为一致：
 *   第 1 次 → ok（水群值 +1）
 *   连续第 2 次 → warn（提示将被禁言）
 *   连续第 3 次 → banned（调用方触发 BE24）
 * 差别在于现状从 DOM 反查最后一条消息，这里改为读 history——
 * 于是「连续性」可以被测试钉住。
 */
export function applyRepeat(session: Session): RepeatResult {
  const last = [...session.history].reverse().find(e => e.kind === 'say' && e.who !== 'me');
  if (!last || last.kind !== 'say') return { session, outcome: 'empty' };

  const s = session.state;
  const repeatN = s.lastRepeat === last.text ? s.repeatN + 1 : 1;

  const outcome: RepeatOutcome = repeatN >= 3 ? 'banned' : repeatN === 2 ? 'warn' : 'ok';

  return {
    outcome,
    spoken: last.text,
    session: {
      ...session,
      state: { ...s, lastRepeat: last.text, repeatN, water: s.water + 1 },
      history: [...session.history, { kind: 'say', who: 'me', text: last.text }],
    },
  };
}
```

需要在该文件顶部的 import 加入 `Session`：

```ts
import type { AffDelta, AffToastItem, CharTable, GameState, Session } from './types';
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `npm test -- tests/effects.test.ts`
Expected: PASS（含复读 7 个用例）

- [ ] **Step 8: Commit**

```bash
git add src/engine/effects.ts tests/effects.test.ts
git commit -m "feat(engine): 好感度结算、阶段计算与复读逻辑"
```

---

### Task 6: 结局判定

**Files:**
- Create: `src/engine/ending.ts`
- Test: `tests/ending.test.ts`

**Interfaces:**
- Consumes: `GameState`、`EndingResolution`、`CharKey`（Task 2）；`createInitialState`（Task 5）；`HERO_KEYS`、`MAIN_KEYS`（Task 3）
- Produces: `resolveEnding(session): EndingResolution`

**行为必须与现状 `group-chat-galgame.html:814-821` 完全一致。**

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest';
import { resolveEnding } from '../src/engine/ending';
import { createInitialState } from '../src/engine/effects';
import type { Session } from '../src/engine/types';

function sessionWith(aff: Partial<Record<string, number>>, flags: Record<string, boolean> = {}): Session {
  const base = createInitialState();
  return {
    state: { ...base, aff: { ...base.aff, ...aff } as never, flags: flags as never },
    ip: 0,
    history: [],
  };
}

describe('结局判定', () => {
  it('放鸽子且总分 ≤6 → BE10', () => {
    expect(resolveEnding(sessionWith({ nanao: 6 }, { actSkip: true }))).toEqual({ kind: 'be', id: 'BE10' });
  });

  it('放鸽子但总分 >6 → 不走 BE10', () => {
    const r = resolveEnding(sessionWith({ nanao: 7 }, { actSkip: true }));
    expect(r.kind).toBe('route');
  });

  it('总分 ≤4 → BE23（第 81 人）', () => {
    expect(resolveEnding(sessionWith({ nanao: 2, yu: 2 }))).toEqual({ kind: 'be', id: 'BE23' });
  });

  it('总分 5 → 不走 BE23', () => {
    const r = resolveEnding(sessionWith({ nanao: 3, yu: 2 }));
    expect(r.kind).toBe('route');
  });

  it('取可攻略主角中好感度最高者', () => {
    expect(resolveEnding(sessionWith({ nanao: 2, yu: 5, cat: 3 }))).toEqual({ kind: 'route', key: 'yu' });
  });

  it('并列时取 MAIN_KEYS 中靠前者', () => {
    expect(resolveEnding(sessionWith({ yu: 5, cat: 5 }))).toEqual({ kind: 'route', key: 'yu' });
  });

  it('全部为 0 时落到 MAIN_KEYS[0]', () => {
    expect(resolveEnding(sessionWith({ nanao: 7 }))).toEqual({ kind: 'route', key: 'nanao' });
  });
});
```

> 注：「总分 ≤4 → BE23」这条：仅 `nanao:7` 时总分 7 > 4，故走 route。测试用例已自洽。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/ending.test.ts`
Expected: FAIL — 无法解析 `../src/engine/ending`

- [ ] **Step 3: 实现 `src/engine/ending.ts`**

```ts
import type { EndingResolution, Session } from './types';
import { HERO_KEYS, MAIN_KEYS } from '../content/characters';

/**
 * 结局判定。纯函数。
 * 与现状 group-chat-galgame.html:814-821 行为一致：
 *   1. 放过鸽子(actSkip) 且 总好感 ≤6 → BE10
 *   2. 总好感 ≤4 → BE23
 *   3. 否则取 MAIN_KEYS 中好感最高者；并列取靠前者
 */
export function resolveEnding(session: Session): EndingResolution {
  const { aff, flags } = session.state;
  const total = HERO_KEYS.reduce((sum, k) => sum + (aff[k] ?? 0), 0);

  if (flags.actSkip && total <= 6) return { kind: 'be', id: 'BE10' };
  if (total <= 4) return { kind: 'be', id: 'BE23' };

  let top = MAIN_KEYS[0]!;
  for (const k of MAIN_KEYS) {
    if ((aff[k] ?? 0) > (aff[top] ?? 0)) top = k;
  }
  return { kind: 'route', key: top };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- tests/ending.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/ending.ts tests/ending.test.ts
git commit -m "feat(engine): 结局判定（BE10 / BE23 / 路线）"
```

---

### Task 7: 剧本校验器

**Files:**
- Create: `src/engine/validate.ts`, `src/engine/validate.cli.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: `Script`、`CharTable`、`BeId`、`LabelIndex`（Task 2）；`CHARS`（Task 3）；`BEDATA`（Task 4）
- Produces: `buildLabelIndex(script): LabelIndex`、`validateScript(script, chars, beData): ValidationIssue[]`、`ValidationIssue`、`formatIssues(issues): string`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildLabelIndex, validateScript } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import type { Script } from '../src/engine/types';

const ok = (script: Script) => validateScript(script, CHARS, BEDATA);

describe('label 索引', () => {
  it('收集全部 label 的位置', () => {
    const idx = buildLabelIndex([
      { kind: 'label', name: 'a' }, { kind: 'say', who: 'yu', text: 'x' }, { kind: 'label', name: 'b' },
    ]);
    expect(idx).toEqual({ a: 0, b: 2 });
  });
});

describe('剧本校验', () => {
  it('合法剧本无 error', () => {
    const issues = ok([
      { kind: 'label', name: 'start' },
      { kind: 'say', who: 'yu', text: 'hi' },
      { kind: 'goto', label: 'start' },
    ]);
    expect(issues.filter(i => i.level === 'error')).toEqual([]);
  });

  it('goto 目标不存在 → error', () => {
    const issues = ok([{ kind: 'label', name: 'a' }, { kind: 'goto', label: 'nope' }]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'goto-unknown' }));
  });

  it('choice/hub 的 goto 同样校验', () => {
    const issues = ok([
      { kind: 'label', name: 'a' },
      { kind: 'choice', prompt: 'p', options: [{ label: 'x', goto: 'nope' }] },
      { kind: 'hub', prompt: 'p', options: [{ id: 'i', label: 'y', goto: 'nope2' }] },
    ]);
    expect(issues.filter(i => i.code === 'goto-unknown')).toHaveLength(2);
  });

  it('角色键不存在 → error', () => {
    const issues = ok([{ kind: 'say', who: 'nobody' as never, text: 'x' }]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'char-unknown' }));
  });

  it('重复 label → error', () => {
    const issues = ok([{ kind: 'label', name: 'a' }, { kind: 'label', name: 'a' }]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'label-duplicate' }));
  });

  it('BE 缺文本 → error', () => {
    const issues = validateScript([{ kind: 'be', id: 'BE99' as never }], CHARS, BEDATA);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'be-unknown' }));
  });

  it('hub 选项 id 重复 → error', () => {
    const issues = ok([
      { kind: 'label', name: 'a' },
      { kind: 'hub', prompt: 'p', options: [
        { id: 'dup', label: 'x', goto: 'a' }, { id: 'dup', label: 'y', goto: 'a' },
      ] },
    ]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', code: 'hub-id-duplicate' }));
  });

  it('不可达节点 → warn', () => {
    const issues = ok([{ kind: 'label', name: 'a' }, { kind: 'say', who: 'yu', text: 'x' }]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warn', code: 'unreachable' }));
  });

  it('设置了但从未读取的 flag → warn', () => {
    const issues = ok([{ kind: 'label', name: 'a' }, { kind: 'set', flag: 'actGood' }]);
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warn', code: 'flag-unused' }));
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- tests/validate.test.ts`
Expected: FAIL — 无法解析 `../src/engine/validate`

- [ ] **Step 3: 实现 `src/engine/validate.ts`**

```ts
import type { BeId, CharTable, EndingData, Label, LabelIndex, Node, Script } from './types';

export interface ValidationIssue {
  readonly level: 'error' | 'warn';
  readonly code: string;
  readonly message: string;
  readonly index?: number;
}

export function buildLabelIndex(script: Script): LabelIndex {
  const idx: Record<Label, number> = {};
  script.forEach((n, i) => { if (n.kind === 'label') idx[n.name] = i; });
  return idx;
}

/** 收集一个节点里所有的跳转目标。 */
function gotoTargets(n: Node): Label[] {
  switch (n.kind) {
    case 'goto': return [n.label];
    case 'choice': return n.options.map(o => o.goto);
    case 'hub': return n.options.map(o => o.goto);
    default: return [];
  }
}

/** 校验整份剧本。errors 会让构建失败，warnings 仅供提示。 */
export function validateScript(
  script: Script,
  chars: CharTable,
  beData: Readonly<Record<BeId, EndingData>>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const labels = buildLabelIndex(script);

  // 1. label 唯一
  const seen = new Set<Label>();
  script.forEach((n, i) => {
    if (n.kind !== 'label') return;
    if (seen.has(n.name)) {
      issues.push({ level: 'error', code: 'label-duplicate', message: `label 重复：${n.name}`, index: i });
    }
    seen.add(n.name);
  });

  // 2/3/4/5. 逐节点检查
  const hubIds = new Map<string, number>();
  script.forEach((n, i) => {
    for (const target of gotoTargets(n)) {
      if (!(target in labels)) {
        issues.push({ level: 'error', code: 'goto-unknown', message: `goto 目标不存在：${target}`, index: i });
      }
    }

    const whoKeys: string[] = [];
    if (n.kind === 'say') whoKeys.push(n.who);
    if (n.kind === 'card') whoKeys.push(n.who);
    for (const k of whoKeys) {
      if (k !== 'me' && !(k in chars)) {
        issues.push({ level: 'error', code: 'char-unknown', message: `角色键不存在：${k}`, index: i });
      }
    }

    if (n.kind === 'be' && !(n.id in beData)) {
      issues.push({ level: 'error', code: 'be-unknown', message: `Bad End 缺少文本：${n.id}`, index: i });
    }

    if (n.kind === 'hub') {
      const local = new Set<string>();
      for (const o of n.options) {
        if (local.has(o.id)) {
          issues.push({ level: 'error', code: 'hub-id-duplicate', message: `hub 选项 id 重复：${o.id}`, index: i });
        }
        local.add(o.id);
        hubIds.set(o.id, i);
      }
    }
  });

  // 6. 可达性：从 start（或第一个 label）出发，沿 goto 遍历
  const reachable = computeReachable(script, labels);
  script.forEach((n, i) => {
    if (n.kind === 'be') return; // BE 节点由 be 语义终止，且常被 goto 直接引用
    if (!reachable.has(i)) {
      issues.push({ level: 'warn', code: 'unreachable', message: `节点不可达：${n.kind}`, index: i });
    }
  });

  // 7. flag 使用情况
  const setFlags = new Set<string>();
  const readFlags = new Set<string>();
  for (const n of script) {
    if (n.kind === 'set') setFlags.add(n.flag);
    if (n.kind === 'choice') for (const o of n.options) if (o.set) setFlags.add(o.set);
    if (n.kind === 'hub') for (const o of n.options) if (o.set) setFlags.add(o.set);
  }
  // actSkip / actGood 在 ending.ts 里被读取，属于引擎侧读取
  for (const k of ['actSkip', 'actGood']) readFlags.add(k);
  for (const f of setFlags) {
    if (!readFlags.has(f)) {
      issues.push({ level: 'warn', code: 'flag-unused', message: `flag 设置了但从未读取：${f}` });
    }
  }

  return issues;
}

/** 顺序扫描 + 跳转闭包，判断每个节点是否可达。 */
function computeReachable(script: Script, labels: LabelIndex): Set<number> {
  const reachable = new Set<number>();
  const queue: number[] = [];
  const start = labels['start'] ?? 0;
  queue.push(start);

  while (queue.length > 0) {
    const from = queue.pop()!;
    // 从 from 顺序推进，直到遇到终止或跳转
    let i = from;
    while (i < script.length && !reachable.has(i)) {
      reachable.add(i);
      const n = script[i]!;
      if (n.kind === 'goto') { queue.push(labels[n.label]!); break; }
      if (n.kind === 'choice' || n.kind === 'hub') {
        for (const t of gotoTargets(n)) if (labels[t] !== undefined) queue.push(labels[t]!);
        break;
      }
      if (n.kind === 'be' || n.kind === 'ending') break;
      i++;
    }
  }
  return reachable;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues
    .map(i => `${i.level === 'error' ? '✗' : '⚠'} [${i.code}] ${i.message}${i.index !== undefined ? `（节点 #${i.index}）` : ''}`)
    .join('\n');
}
```

- [ ] **Step 4: 写 CLI 包装 `src/engine/validate.cli.ts`**

```ts
import { formatIssues, validateScript } from './validate';
import { CHARS } from '../content/characters';
import { BEDATA } from '../content/endings';
import { SCRIPT } from '../content/chapters';

const issues = validateScript(SCRIPT, CHARS, BEDATA);
const errors = issues.filter(i => i.level === 'error');
const warns = issues.filter(i => i.level === 'warn');

if (issues.length > 0) console.log(formatIssues(issues));
if (errors.length > 0) {
  console.error(`\n剧本校验失败：${errors.length} 个错误，${warns.length} 个警告`);
  process.exit(1);
}
console.log(`剧本校验通过（${warns.length} 个警告）`);
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npm test -- tests/validate.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 6: Commit**

```bash
git add src/engine/validate.ts src/engine/validate.cli.ts tests/validate.test.ts
git commit -m "feat(engine): 剧本图校验器（goto/角色键/BE/可达性/flag）"
```

---

### Task 8: 解释器

**Files:**
- Create: `src/engine/runner.ts`, `tests/fake-renderer.ts`
- Test: `tests/runner.test.ts`

**Interfaces:**
- Consumes: Task 2 全部类型；`applyEff`（Task 5）；`resolveEnding`（Task 6）；`buildLabelIndex`（Task 7）
- Produces: `DEFAULT_DELAYS`、`run(session, env, r): Promise<void>`、`GameEnv`
- 产出供后续任务使用：`tests/fake-renderer.ts` 导出 `FakeRenderer`，记录调用序列

- [ ] **Step 1: 写 `tests/fake-renderer.ts`**

```ts
import type {
  AffToastItem, BeId, CharKey, ChoiceOption, DelayPolicy, EndingResolution,
  HubOption, Renderer, Session, Speaker, TrackName,
} from '../src/engine/types';

export type Call =
  | { t: 'say'; who: Speaker; text: string }
  | { t: 'sys'; text: string }
  | { t: 'note'; text: string }
  | { t: 'card'; who: CharKey }
  | { t: 'bgm'; track: TrackName }
  | { t: 'affToast'; items: readonly AffToastItem[] }
  | { t: 'toast'; text: string }
  | { t: 'be'; id: BeId }
  | { t: 'ending'; resolution: EndingResolution };

/** 记录调用序列的假渲染器。answers 按顺序回答每个 choice/hub。 */
export class FakeRenderer implements Renderer {
  readonly calls: Call[] = [];
  private choiceCursor = 0;
  private hubCursor = 0;
  /** 每次 choice 选第几个（按出现顺序） */
  choiceAnswers: number[] = [];
  /** 每次 hub 选第几个（按出现顺序） */
  hubAnswers: number[] = [];

  delays: DelayPolicy = { me: 0, msg: 0, sys: 0, note: 0, card: 0, fast: true };

  private log(c: Call): void { this.calls.push(c); }

  async say(who: Speaker, text: string): Promise<void> { this.log({ t: 'say', who, text }); }
  async sys(text: string): Promise<void> { this.log({ t: 'sys', text }); }
  async note(text: string): Promise<void> { this.log({ t: 'note', text }); }
  async card(who: CharKey): Promise<void> { this.log({ t: 'card', who }); }
  bgm(track: TrackName): void { this.log({ t: 'bgm', track }); }
  affToast(items: readonly AffToastItem[]): void { this.log({ t: 'affToast', items }); }
  toast(text: string): void { this.log({ t: 'toast', text }); }

  async askChoice(_prompt: string, _options: readonly ChoiceOption[]): Promise<number> {
    const answer = this.choiceAnswers[this.choiceCursor] ?? 0;
    this.choiceCursor++;
    return answer;
  }
  async askHub(_prompt: string, _options: readonly HubOption[]): Promise<number> {
    const answer = this.hubAnswers[this.hubCursor] ?? 0;
    this.hubCursor++;
    return answer;
  }

  async showBE(id: BeId): Promise<void> { this.log({ t: 'be', id }); }
  async showEnding(resolution: EndingResolution, _s: Session): Promise<void> {
    this.log({ t: 'ending', resolution });
  }
}
```

- [ ] **Step 2: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest';
import { run } from '../src/engine/runner';
import { createInitialState } from '../src/engine/effects';
import { buildLabelIndex } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import { FakeRenderer } from './fake-renderer';
import type { Script, Session } from '../src/engine/types';

const env = (script: Script) => ({
  script, labels: buildLabelIndex(script), chars: CHARS, beData: BEDATA,
});

function session(): Session {
  return { state: createInitialState(), ip: 0, history: [] };
}

describe('解释器', () => {
  it('顺序播放 say/sys/note/card', async () => {
    const r = new FakeRenderer();
    await run(session(), env([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'sys', text: '入群' },
      { kind: 'note', text: '旁白' },
      { kind: 'card', who: 'yu' },
    ]), r);
    expect(r.calls).toEqual([
      { t: 'say', who: 'yu', text: '嗨' },
      { t: 'sys', text: '入群' },
      { t: 'note', text: '旁白' },
      { t: 'card', who: 'yu' },
    ]);
  });

  it('记录历史到 session.history', async () => {
    const r = new FakeRenderer();
    const s = session();
    await run(s, env([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'note', text: '旁白' },
    ]), r);
    expect(s.history).toEqual([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'note', text: '旁白' },
    ]);
  });

  it('choice 把选中项作为玩家消息发出，并应用 eff 与 set', async () => {
    const r = new FakeRenderer();
    const s = session();
    r.choiceAnswers = [1];
    await run(s, env([
      { kind: 'label', name: 'start' },
      { kind: 'choice', prompt: '说点什么', options: [
        { label: 'A', eff: { nanao: 1 }, goto: 'done' },
        { label: 'B', say: '😺', eff: { cat: 2 }, set: 'actGood', goto: 'done' },
      ] },
      { kind: 'label', name: 'done' },
      { kind: 'ending' },
    ]), r);

    expect(s.state.aff.cat).toBe(2);
    expect(s.state.flags.actGood).toBe(true);
    expect(r.calls).toContainEqual({ t: 'say', who: 'me', text: '😺' });
    expect(r.calls).toContainEqual({ t: 'affToast', items: [{ who: 'cat', delta: 2 }] });
    expect(r.calls.at(-1)).toEqual({ t: 'ending', resolution: { kind: 'route', key: 'nanao' } });
  });

  it('choice 缺省 say 时用选项文字', async () => {
    const r = new FakeRenderer();
    r.choiceAnswers = [0];
    await run(session(), env([
      { kind: 'choice', prompt: 'p', options: [{ label: '打打 Arcaea', goto: 'end' }] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);
    expect(r.calls).toContainEqual({ t: 'say', who: 'me', text: '打打 Arcaea' });
  });

  it('hub 跳过已触发的 once 选项', async () => {
    const r = new FakeRenderer();
    const s = session();
    s.state.hub['mc'] = true;
    r.hubAnswers = [0];
    await run(s, env([
      { kind: 'hub', prompt: '去哪', options: [
        { id: 'mc', label: 'MC', once: true, goto: 'end' },
        { id: 'main', label: '主线', goto: 'end' },
      ] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);
    // 只剩 main 一个可选项，选第 0 个即 main
    expect(s.state.hub['main']).toBeUndefined();
    expect(r.calls.at(-1)).toEqual({ t: 'ending', resolution: { kind: 'route', key: 'nanao' } });
  });

  it('goto 到不存在的 label 抛错，而不是静默结束', async () => {
    const r = new FakeRenderer();
    await expect(run(session(), env([{ kind: 'goto', label: 'nope' }]), r))
      .rejects.toThrow(/未知 label/);
  });

  it('be 节点终止播放', async () => {
    const r = new FakeRenderer();
    await run(session(), env([{ kind: 'be', id: 'BE01' }, { kind: 'say', who: 'yu', text: '不该出现' }]), r);
    expect(r.calls).toEqual([{ t: 'be', id: 'BE01' }]);
  });

  it('ending 节点走结局判定', async () => {
    const r = new FakeRenderer();
    const s = session();
    s.state.aff.nanao = 8;
    await run(s, env([{ kind: 'ending' }]), r);
    expect(r.calls.at(-1)).toEqual({ t: 'ending', resolution: { kind: 'route', key: 'nanao' } });
  });

  it('bgm 与 aff 节点生效', async () => {
    const r = new FakeRenderer();
    const s = session();
    await run(s, env([
      { kind: 'bgm', track: 'night' },
      { kind: 'aff', eff: { yu: 3 } },
      { kind: 'ending' },
    ]), r);
    expect(r.calls).toContainEqual({ t: 'bgm', track: 'night' });
    expect(s.state.aff.yu).toBe(3);
  });

  it('可从非零 ip 续跑（存档恢复的基础）', async () => {
    const r = new FakeRenderer();
    const script: Script = [
      { kind: 'say', who: 'yu', text: '第一句' },
      { kind: 'say', who: 'yu', text: '第二句' },
    ];
    const s = session();
    s.ip = 1;
    await run(s, env(script), r);
    expect(r.calls).toEqual([
      { t: 'say', who: 'yu', text: '第一句' },  // 见下方说明
    ]);
  });
});
```

> **最后一条用例说明**：`ip` 表示「下一个待执行节点」。`ip = 1` 时从第 1 个节点（`第二句`）开始，
> 故断言应为 `[{ t: 'say', who: 'yu', text: '第二句' }]`。**实现时请按此语义写，并修正该断言。**
> 这样存档只需存 `ip` 即可精确恢复到某个节点。

- [ ] **Step 3: 运行测试，确认失败**

Run: `npm test -- tests/runner.test.ts`
Expected: FAIL — 无法解析 `../src/engine/runner`

- [ ] **Step 4: 实现 `src/engine/runner.ts`**

```ts
import type {
  BeId, CharTable, EndingData, LabelIndex, Node, Renderer, Script, Session,
} from './types';
import { applyEff } from './effects';
import { resolveEnding } from './ending';

/** 与现状 group-chat-galgame.html 的计时默认值一致。 */
export const DEFAULT_DELAYS = {
  me: 280, msg: 520, sys: 560, note: 680, card: 760, fast: false,
} as const;

export interface GameEnv {
  readonly script: Script;
  readonly labels: LabelIndex;
  readonly chars: CharTable;
  readonly beData: Readonly<Record<BeId, EndingData>>;
}

class UnknownLabelError extends Error {
  constructor(readonly label: string) {
    super(`未知 label：${label}（goto 目标不存在，请检查剧本或跑 npm run check:script）`);
    this.name = 'UnknownLabelError';
  }
}

function delayFor(r: Renderer, ms: number): Promise<void> {
  const capped = r.delays.fast ? Math.min(ms, 60) : ms;
  return new Promise(resolve => setTimeout(resolve, capped));
}

/**
 * 驱动剧本。直接修改 session.state / session.ip / session.history（它们是可变的工作副本），
 * 所有界面副作用经 Renderer 发生。
 *
 * ip 语义：指向「下一个待执行节点」。返回时 ip 停在终止节点之后。
 */
export async function run(session: Session, env: GameEnv, r: Renderer): Promise<void> {
  const { script, labels, chars, beData } = env;

  while (session.ip < script.length) {
    const node: Node = script[session.ip]!;
    session.ip++;

    switch (node.kind) {
      case 'label':
        break;

      case 'say': {
        session.history.push({ kind: 'say', who: node.who, text: node.text });
        await r.say(node.who, node.text);
        await delayFor(r, node.who === 'me' ? r.delays.me : r.delays.msg);
        break;
      }

      case 'sys': {
        session.history.push({ kind: 'sys', text: node.text });
        await r.sys(node.text);
        await delayFor(r, r.delays.sys);
        break;
      }

      case 'note': {
        session.history.push({ kind: 'note', text: node.text });
        await r.note(node.text);
        await delayFor(r, r.delays.note);
        break;
      }

      case 'card':
        await r.card(node.who);
        await delayFor(r, r.delays.card);
        break;

      case 'bgm':
        r.bgm(node.track);
        break;

      case 'aff': {
        const { state, toasts } = applyEff(session.state, node.eff, chars);
        session.state = state;
        if (toasts.length > 0) r.affToast(toasts);
        break;
      }

      case 'set':
        session.state = { ...session.state, flags: { ...session.state.flags, [node.flag]: true } };
        break;

      case 'goto': {
        const target = labels[node.label];
        if (target === undefined) throw new UnknownLabelError(node.label);
        session.ip = target;
        break;
      }

      case 'choice': {
        const idx = await r.askChoice(node.prompt, node.options);
        const opt = node.options[idx] ?? node.options[0]!;
        const spoken = opt.say ?? opt.label;
        session.history.push({ kind: 'say', who: 'me', text: spoken });
        await r.say('me', spoken);
        if (opt.set) {
          session.state = { ...session.state, flags: { ...session.state.flags, [opt.set]: true } };
        }
        if (opt.eff) {
          const { state, toasts } = applyEff(session.state, opt.eff, chars);
          session.state = state;
          if (toasts.length > 0) r.affToast(toasts);
        }
        const target = labels[opt.goto];
        if (target === undefined) throw new UnknownLabelError(opt.goto);
        session.ip = target;
        break;
      }

      case 'hub': {
        const available = node.options.filter(o => !(o.once && session.state.hub[o.id]));
        const idx = await r.askHub(node.prompt, available);
        const opt = available[idx] ?? available[0]!;
        if (opt.once) {
          session.state = {
            ...session.state,
            hub: { ...session.state.hub, [opt.id]: true },
          };
        }
        if (opt.set) {
          session.state = { ...session.state, flags: { ...session.state.flags, [opt.set]: true } };
        }
        if (opt.eff) {
          const { state, toasts } = applyEff(session.state, opt.eff, chars);
          session.state = state;
          if (toasts.length > 0) r.affToast(toasts);
        }
        const target = labels[opt.goto];
        if (target === undefined) throw new UnknownLabelError(opt.goto);
        session.ip = target;
        break;
      }

      case 'be': {
        if (!(node.id in beData)) throw new Error(`Bad End 缺少文本：${node.id}`);
        await r.showBE(node.id);
        return;
      }

      case 'ending': {
        await r.showEnding(resolveEnding(session), session);
        return;
      }
    }
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npm test -- tests/runner.test.ts`
Expected: PASS（10 个用例，含修正后的 ip 语义断言）

- [ ] **Step 6: 补 Review Focus 的边界用例**

在 `tests/runner.test.ts` 追加：

```ts
describe('hub 边界', () => {
  it('全部 once 选项走完后只剩非 once 选项', async () => {
    const r = new FakeRenderer();
    const s = session();
    s.state.hub['a'] = true;
    s.state.hub['b'] = true;
    let received: readonly HubOption[] = [];
    r.askHub = async (_p, opts) => { received = opts; return 0; };
    await run(s, env([
      { kind: 'hub', prompt: 'p', options: [
        { id: 'a', label: 'A', once: true, goto: 'end' },
        { id: 'b', label: 'B', once: true, goto: 'end' },
        { id: 'main', label: '推进主线', goto: 'end' },
      ] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);
    expect(received).toHaveLength(1);
    expect(received[0]!.id).toBe('main');
  });
});

describe('快进', () => {
  it('卡片等待被钳制到 60ms 以内', async () => {
    const r = new FakeRenderer();
    r.delays = { me: 280, msg: 520, sys: 560, note: 680, card: 760, fast: true };
    const t0 = Date.now();
    await run(session(), env([{ kind: 'card', who: 'yu' }]), r);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
```

需要把 `HubOption` 加入该文件的 import。

- [ ] **Step 7: 运行测试**

Run: `npm test -- tests/runner.test.ts`
Expected: PASS（12 个用例）

- [ ] **Step 8: Commit**

```bash
git add src/engine/runner.ts tests/runner.test.ts tests/fake-renderer.ts
git commit -m "feat(engine): 剧本解释器，DOM 解耦 + 快进钳制 + 未知 label 抛错"
```

---

### Task 9: 剧本搬运 — 序章与第一章

**Files:**
- Create: `src/content/chapters/prologue.ts`, `src/content/chapters/ch1.ts`
- Test: `tests/chapters.test.ts`

**Interfaces:**
- Consumes: `Script`、`Node`（Task 2）；`CHARS`（Task 3）
- Produces: `PROLOGUE: Script`、`CH1: Script`

**搬运源**：`group-chat-galgame.html:331-349`（序章）、`:351-425`（第一章）

**逐节点映射规则**（必须严格照做，**文案一字不改**）：

| 源码写法 | 新写法 |
|---|---|
| `['label','start']` | `{ kind: 'label', name: 'start' }` |
| `['msg','yu','新人？']` | `{ kind: 'say', who: 'yu', text: '新人？' }` |
| `['sys','时间跳到 00:47']` | `{ kind: 'sys', text: '时间跳到 00:47' }` |
| `['note','—— 群友情报 · 解锁 ——']` | `{ kind: 'note', text: '—— 群友情报 · 解锁 ——' }` |
| `['card','nanao']` | `{ kind: 'card', who: 'nanao' }` |
| `['bgm','night']` | `{ kind: 'bgm', track: 'night' }` |
| `['jump','hub']` | `{ kind: 'goto', label: 'hub' }` |
| `['be','BE01']` | `{ kind: 'be', id: 'BE01' }` |
| `['ending']` | `{ kind: 'ending' }` |
| `['choice','说点什么',[{t,say,eff,set,goto},…]]` | `{ kind: 'choice', prompt: '说点什么', options: [{ label: <t>, say, eff, set, goto }, …] }` |
| `['hub','今晚去哪边混？',[{t,once,eff,set,goto},…]]` | `{ kind: 'hub', prompt: '今晚去哪边混？', options: [{ id: <见下>, label: <t>, once, eff, set, goto }, …] }` |

**`hub` 选项的 `id` 取值**（取代原来的按钮文字做去重键，固定如下，不可再改）：

| 原按钮文字 | `id` |
|---|---|
| `一条鱼叫你去 MC 机械动力服` | `s_mc` |
| `跟 G 和面包去拼机出勤` | `s_arc` |
| `陪石蒜通宵写谱` | `s_chart` |
| `跟黄油猫他们去干饭` | `s_food` |
| `找石斑鱼打怪猎` | `s_mh` |
| `蘑菇汤在群里阴阳你 去会一会` | `s_moku` |
| `不混了 直接推进主线` | `main` |

**ch1 里的两个 `be` 跳转需注意**：源码中 `{t:'你谁啊 凭什么命令我', goto:'BE01'}` 等选项直接 `goto` 到 BE 标签，而 BE 标签区（`:597-605`）会在 Task 11 搬运。**搬运时保持 `goto` 目标字面量不变**，校验器会在 Task 11 完成后确认全部可解析。

- [ ] **Step 1: 写 `src/content/chapters/prologue.ts`**

```ts
import type { Script } from '../../engine/types';

/** 源：group-chat-galgame.html:331-349 */
export const PROLOGUE: Script = [
  { kind: 'label', name: 'start' },
  { kind: 'sys', text: '「根哥」把你拉进了群聊 😂群聊' },
  // … 逐条搬运至 :349 的 choice 节点（该 choice 的 goto 目标为 'intro_done'）
];
```

- [ ] **Step 2: 写 `src/content/chapters/ch1.ts`**

```ts
import type { Script } from '../../engine/types';

/** 源：group-chat-galgame.html:351-425 */
export const CH1: Script = [
  { kind: 'label', name: 'intro_done' },
  // … 逐条搬运至 :425 的 jump 节点
];
```

- [ ] **Step 3: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { PROLOGUE } from '../src/content/chapters/prologue';
import { CH1 } from '../src/content/chapters/ch1';
import { CHARS } from '../src/content/characters';

describe('序章与第一章', () => {
  it('序章以 start 标签开头', () => {
    expect(PROLOGUE[0]).toEqual({ kind: 'label', name: 'start' });
  });

  it('序章含开场四条梗（新人？复读）', () => {
    const texts = PROLOGUE.filter(n => n.kind === 'say').map(n => (n as { text: string }).text);
    expect(texts.filter(t => t === '新人？')).toHaveLength(3);
  });

  it('序章首个 choice 有 4 个选项，且全部指向 intro_done', () => {
    const c = PROLOGUE.find(n => n.kind === 'choice');
    expect(c).toBeDefined();
    if (c?.kind !== 'choice') throw new Error('unreachable');
    expect(c.options).toHaveLength(4);
    for (const o of c.options) expect(o.goto).toBe('intro_done');
  });

  it('第一章以 intro_done 标签开头', () => {
    expect(CH1[0]).toEqual({ kind: 'label', name: 'intro_done' });
  });

  it('所有节点引用的角色键都存在于 CHARS', () => {
    for (const n of [...PROLOGUE, ...CH1]) {
      const who = n.kind === 'say' ? n.who : n.kind === 'card' ? n.who : null;
      if (who && who !== 'me') expect(CHARS[who], `节点引用 ${who}`).toBeDefined();
    }
  });

  it('不存在遗留的数组式节点', () => {
    for (const n of [...PROLOGUE, ...CH1]) {
      expect(Array.isArray(n), JSON.stringify(n)).toBe(false);
    }
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/chapters.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/content/chapters/prologue.ts src/content/chapters/ch1.ts tests/chapters.test.ts
git commit -m "feat(content): 搬运序章与第一章剧本"
```

---

### Task 10: 剧本搬运 — 支线枢纽与六条支线

**Files:**
- Create: `src/content/chapters/hub.ts`
- Test: `tests/chapters-hub.test.ts`

**Interfaces:**
- Consumes: `Script`、`Node`（Task 2）
- Produces: `HUB: Script`

**搬运源**：`group-chat-galgame.html:427-569`。映射规则与 Task 9 完全相同。

本段包含 1 个 `hub` 节点 + 6 条支线（`s_mc` / `s_arc` / `s_chart` / `s_food` / `s_mh` / `s_moku`）。

**注意 `s_moku` 分支**：`s_moku_a` 与 `s_moku_b` 以 `['be','BE19']` / `['be','BE20']` **终止**（不 `jump` 回 hub），只有 `s_moku_c` 回到 hub。搬运时保持这一行为——**不要**给 a/b 补上回 hub 的跳转。

- [ ] **Step 1: 写 `src/content/chapters/hub.ts`**

```ts
import type { Script } from '../../engine/types';

/** 源：group-chat-galgame.html:427-569 */
export const HUB: Script = [
  { kind: 'label', name: 'hub' },
  // … 逐条搬运。hub 节点的 7 个选项按 Task 9 的 id 表取值
];
```

- [ ] **Step 2: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { HUB } from '../src/content/chapters/hub';

const labelAt = (name: string) => HUB.findIndex(n => n.kind === 'label' && n.name === name);

describe('支线枢纽', () => {
  it('存在 hub 节点，且有 7 个选项', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('未找到 hub 节点');
    expect(h.options).toHaveLength(7);
  });

  it('hub 选项 id 与 Task 9 的映射表一致', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('unreachable');
    expect(h.options.map(o => o.id)).toEqual([
      's_mc', 's_arc', 's_chart', 's_food', 's_mh', 's_moku', 'main',
    ]);
  });

  it('6 条支线都标了 once，主线没有', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('unreachable');
    for (const o of h.options) {
      if (o.id === 'main') expect(o.once, 'main 不应是 once').toBeUndefined();
      else expect(o.once, `${o.id} 应是 once`).toBe(true);
    }
  });

  it('六条支线的 label 全部存在', () => {
    for (const l of ['s_mc', 's_arc', 's_chart', 's_food', 's_mh', 's_moku']) {
      expect(labelAt(l), `缺少 label ${l}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('s_moku 的两个 BE 分支不回 hub', () => {
    const a = labelAt('s_moku_a');
    const b = labelAt('s_moku_b');
    const c = labelAt('s_moku_c');
    expect(HUB[a + 2]).toEqual({ kind: 'be', id: 'BE19' });
    expect(HUB[b + 2]).toEqual({ kind: 'be', id: 'BE20' });
    expect(HUB[c + 3]!.kind === 'goto' || HUB[c + 4]!.kind === 'goto').toBe(true);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/chapters-hub.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 4: Commit**

```bash
git add src/content/chapters/hub.ts tests/chapters-hub.test.ts
git commit -m "feat(content): 搬运支线枢纽与六条支线"
```

---

### Task 11: 剧本搬运 — 第三章、结局标签与全剧本拼装

**Files:**
- Create: `src/content/chapters/ch3.ts`, `src/content/chapters/index.ts`
- Test: `tests/chapters-full.test.ts`

**Interfaces:**
- Consumes: `PROLOGUE`、`CH1`（Task 9）；`HUB`（Task 10）；`CHARS`、`BEDATA`（Task 3、4）；`validateScript`、`buildLabelIndex`（Task 7）
- Produces: `CH3: Script`、`SCRIPT: Script`、`LABELS: LabelIndex`

**搬运源**：`group-chat-galgame.html:571-595`（第三章）、`:597-605`（结局标签区）

结局标签区源码形如 `['label','BE01'],['be','BE01'],`，搬运为两个节点：

```ts
{ kind: 'label', name: 'BE01' }, { kind: 'be', id: 'BE01' },
```

共 7 组（BE01 / BE02 / BE05 / BE17 / BE19 / BE20 / BE24）。**BE10 与 BE23 不在剧本里**——它们只由 `resolveEnding` 触发。

- [ ] **Step 1: 写 `src/content/chapters/ch3.ts`**

```ts
import type { Script } from '../../engine/types';

/** 源：group-chat-galgame.html:571-605（第三章 + 结局标签区） */
export const CH3: Script = [
  { kind: 'label', name: 'ch3' },
  // … 逐条搬运。末尾接 7 组 BE 标签
];
```

- [ ] **Step 2: 写 `src/content/chapters/index.ts`**

```ts
import type { Script } from '../../engine/types';
import { buildLabelIndex } from '../../engine/validate';
import { PROLOGUE } from './prologue';
import { CH1 } from './ch1';
import { HUB } from './hub';
import { CH3 } from './ch3';

/**
 * 全剧本。顺序即执行顺序——label 是绝对定位，因此
 * **拼接顺序改变会改变跳转行为**，不要随意调整。
 */
export const SCRIPT: Script = [...PROLOGUE, ...CH1, ...HUB, ...CH3];

/** 复用校验器里的同一实现，避免两处索引逻辑漂移。 */
export const LABELS = buildLabelIndex(SCRIPT);
```

- [ ] **Step 3: 写全剧本测试（这是关键的一步）**

```ts
import { describe, expect, it } from 'vitest';
import { SCRIPT, LABELS } from '../src/content/chapters';
import { validateScript } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';

describe('全剧本', () => {
  it('无校验错误', () => {
    const errors = validateScript(SCRIPT, CHARS, BEDATA).filter(i => i.level === 'error');
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it('节点数与现状相当（约 180）', () => {
    expect(SCRIPT.length).toBeGreaterThan(160);
    expect(SCRIPT.length).toBeLessThan(220);
  });

  it('label 数约 34', () => {
    expect(Object.keys(LABELS).length).toBeGreaterThanOrEqual(30);
  });

  it('起点 start 存在', () => {
    expect(LABELS.start).toBe(0);
  });

  it('7 个 BE 标签全部存在且有对应 be 节点', () => {
    for (const id of ['BE01', 'BE02', 'BE05', 'BE17', 'BE19', 'BE20', 'BE24']) {
      expect(LABELS[id], `缺少 label ${id}`).toBeDefined();
      expect(SCRIPT.some(n => n.kind === 'be' && n.id === id), `缺少 be 节点 ${id}`).toBe(true);
    }
  });

  it('存在 hub 节点且恰好 1 个', () => {
    expect(SCRIPT.filter(n => n.kind === 'hub')).toHaveLength(1);
  });

  it('存在 ending 节点且恰好 1 个', () => {
    expect(SCRIPT.filter(n => n.kind === 'ending')).toHaveLength(1);
  });

  it('choice 节点数与现状一致（16）', () => {
    expect(SCRIPT.filter(n => n.kind === 'choice')).toHaveLength(16);
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/chapters-full.test.ts`
Expected: PASS

> **若「无校验错误」失败**，说明搬运时有 `goto` 目标拼写不一致。错误信息会给出节点位置，逐一修正——**这正是校验器的价值**。

- [ ] **Step 5: 跑校验器 CLI**

Run: `npm run check:script`
Expected: 输出「剧本校验通过」，退出码 0

- [ ] **Step 6: 全量测试**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add src/content/chapters/ch3.ts src/content/chapters/index.ts tests/chapters-full.test.ts
git commit -m "feat(content): 搬运第三章与结局标签，拼装全剧本"
```

---

### Task 12: UI 外壳（DOM 结构与现状一致）

**Files:**
- Create: `src/ui/shell.ts`, `src/styles/*.css`
- Test: `tests/shell.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `mountShell(root: HTMLElement): Shell`，`Shell` 暴露全部元素引用

**关键约束**：**DOM 结构与 class 名必须与现状逐字一致**（源：`group-chat-galgame.html:147-187`）。样式才能整体搬过来，并支持与旧版的肉眼并排比对。

- [ ] **Step 1: 写 `src/ui/shell.ts`**

```ts
export interface Shell {
  readonly title: HTMLElement;
  readonly game: HTMLElement;
  readonly chat: HTMLElement;
  readonly composer: HTMLElement;
  readonly drawer: HTMLElement;
  readonly drList: HTMLElement;
  readonly overlay: HTMLElement;
  readonly ovCard: HTMLElement;
  readonly toasts: HTMLElement;
  readonly stageSil: HTMLElement;
  readonly mCount: HTMLElement;
  readonly mWater: HTMLElement;
  readonly btnStart: HTMLButtonElement;
  readonly btnAbout: HTMLButtonElement;
  readonly btnBgmTitle: HTMLButtonElement;
  readonly btnMembers: HTMLButtonElement;
  readonly btnCloseDr: HTMLButtonElement;
  readonly btnRepeat: HTMLButtonElement;
  readonly btnFast: HTMLButtonElement;
  readonly btnBgm: HTMLButtonElement;
}

/** 建出与现状 group-chat-galgame.html:147-187 逐字一致的 DOM 结构。 */
export function mountShell(root: HTMLElement): Shell {
  root.innerHTML = `
    <div id="title" class="screen">
      <div class="t-kicker">GALGAME DEMO · 恋爱模拟 ADV</div>
      <h1>😂群聊</h1>
      <div class="t-sub">全 群 攻 陷 计 划</div>
      <p class="t-tag">—— 第 81 位群友的攻略日志 ——</p>
      <div class="t-btns">
        <button id="btnStart" class="btn primary">开始游戏</button>
        <button id="btnBgmTitle" class="btn">🔊 音乐：开</button>
        <button id="btnAbout" class="btn">关于 / 素材</button>
      </div>
      <div class="t-foot">单文件可玩 · 无需联网 · 内置合成 BGM</div>
    </div>

    <div id="game" class="screen hidden">
      <div class="topbar">
        <div class="tb-left">
          <div class="tb-title">😂群聊</div>
          <div class="tb-meta">成员 <b id="mCount">81</b> · 水群值 <b id="mWater">0</b></div>
        </div>
        <div class="tb-right">
          <button id="btnMembers" class="mini">群成员</button>
          <button id="btnRepeat" class="mini">复读</button>
          <button id="btnFast" class="mini">快进</button>
          <button id="btnBgm" class="mini">🔊</button>
        </div>
      </div>
      <div id="chat" class="chat"></div>
      <div id="composer" class="composer"><div class="c-idle">正在加载群聊……</div></div>
    </div>

    <div id="stageSil"></div>
    <div id="toasts"></div>

    <div id="drawer" class="drawer">
      <div class="dr-h"><b>群成员</b><button class="mini" id="btnCloseDr">关闭</button></div>
      <div class="dr-list" id="drList"></div>
    </div>

    <div id="overlay" class="overlay hidden"><div class="ov" id="ovCard"></div></div>
  `;

  const need = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`缺少元素 #${id}`);
    return el as T;
  };

  return {
    title: need('title'), game: need('game'), chat: need('chat'), composer: need('composer'),
    drawer: need('drawer'), drList: need('drList'), overlay: need('overlay'),
    ovCard: need('ovCard'), toasts: need('toasts'), stageSil: need('stageSil'),
    mCount: need('mCount'), mWater: need('mWater'),
    btnStart: need<HTMLButtonElement>('btnStart'), btnAbout: need<HTMLButtonElement>('btnAbout'),
    btnBgmTitle: need<HTMLButtonElement>('btnBgmTitle'), btnMembers: need<HTMLButtonElement>('btnMembers'),
    btnCloseDr: need<HTMLButtonElement>('btnCloseDr'), btnRepeat: need<HTMLButtonElement>('btnRepeat'),
    btnFast: need<HTMLButtonElement>('btnFast'), btnBgm: need<HTMLButtonElement>('btnBgm'),
  };
}
```

- [ ] **Step 2: 搬 CSS**

把 `group-chat-galgame.html:7-145` 的 `<style>` 内容**原样**拆到：
- `src/styles/tokens.css` —— `:root` 变量、`*`、`html,body`、`.screen`、`.hidden`、`button`
- `src/styles/title.css` —— `#title` 一节
- `src/styles/chat.css` —— `.topbar` / `.chat` / `.msg` / `.sys` / `.note` / `.card` / `.composer` / `.choice` / `.c-idle`
- `src/styles/chrome.css` —— `#stageSil` / `.drawer` / `#toasts` / `.toast` / `.overlay` / `.ov` / `a` / `@media`

在 `src/main.ts` 顶部按顺序 `import './styles/tokens.css'` 等（顺序影响层叠，保持源码中的先后）。

- [ ] **Step 3: 写测试**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountShell } from '../src/ui/shell';

describe('UI 外壳', () => {
  it('建出全部关键元素', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const s = mountShell(root);
    expect(s.chat.id).toBe('chat');
    expect(s.composer.id).toBe('composer');
    expect(s.drList.id).toBe('drList');
    expect(s.ovCard.id).toBe('ovCard');
    expect(s.btnStart.textContent).toBe('开始游戏');
  });

  it('class 名与现状一致（供 CSS 无改动迁移）', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountShell(root);
    for (const sel of ['.screen', '.topbar', '.chat', '.composer', '.drawer', '.overlay', '.btn.primary', '.mini']) {
      expect(document.querySelector(sel), `缺少 ${sel}`).not.toBeNull();
    }
  });

  it('游戏界面初始隐藏', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const s = mountShell(root);
    expect(s.game.classList.contains('hidden')).toBe(true);
  });
});
```

- [ ] **Step 4: 安装 jsdom 并运行测试**

Run: `npm i -D jsdom && npm test -- tests/shell.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/ui/shell.ts src/styles tests/shell.test.ts package.json package-lock.json
git commit -m "feat(ui): DOM 外壳与样式（结构与现状一致）"
```

---

### Task 13: 立绘与音频搬运

**Files:**
- Create: `src/ui/silhouettes.ts`, `src/audio/bgm.ts`
- Test: `tests/silhouettes.test.ts`

**Interfaces:**
- Consumes: `CharKey`、`CharTable`、`SilhouetteShape`（Task 2）；`CHARS`（Task 3）
- Produces: `sil(key, size, chars): string`、`BGM`、`sfx(kind)`

**搬运源**：`sil()` 在 `group-chat-galgame.html:223-248`；`BGM` 在 `:250-323`；`sfx()` 在 `:849-860`。**逻辑逐字搬运**，仅把对全局 `CHARS` 的引用改为参数传入。

- [ ] **Step 1: 写 `src/ui/silhouettes.ts`**

把 `sil` 的 `CHARS[key]` 改为参数：`export function sil(key: CharKey, size: number, chars: CharTable): string`。其余 SVG 生成逻辑**一字不改**（含 `shape` 的 14 个分支与 `dot` 兜底）。

- [ ] **Step 2: 写 `src/audio/bgm.ts`**

把 `BGM` IIFE 与 `sfx` 原样搬入，加 `export`。`BGM` 内部对 `TR` 音轨表的引用不变。

- [ ] **Step 3: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { sil } from '../src/ui/silhouettes';
import { CHARS } from '../src/content/characters';

describe('立绘生成', () => {
  it('返回合法 SVG', () => {
    const svg = sil('nanao', 76, CHARS);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('width="76"');
  });

  it('使用角色的主题色', () => {
    expect(sil('nanao', 76, CHARS)).toContain('#ff6ec7');
    expect(sil('yu', 76, CHARS)).toContain('#5ce1e6');
  });

  it('每个角色都能生成且不含 undefined', () => {
    for (const key of Object.keys(CHARS) as (keyof typeof CHARS)[]) {
      const svg = sil(key, 76, CHARS);
      expect(svg, key).not.toContain('undefined');
      expect(svg, key).not.toContain('NaN');
    }
  });

  it('14 种 shape 都有独立剪影', () => {
    const shapes = new Set(Object.values(CHARS).map(c => c.shape));
    expect(shapes.size).toBeGreaterThanOrEqual(14);
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/silhouettes.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/ui/silhouettes.ts src/audio/bgm.ts tests/silhouettes.test.ts
git commit -m "feat(ui): 搬运 SVG 立绘与 Web Audio 合成音轨"
```

---

### Task 14: 聊天流与浮层

**Files:**
- Create: `src/ui/chat.ts`, `src/ui/toasts.ts`
- Test: `tests/chat.test.ts`

**Interfaces:**
- Consumes: `Speaker`、`CharKey`、`CharTable`、`AffToastItem`（Task 2）；`sil`（Task 13）
- Produces: `createChatView(shell, chars): ChatView`（提供 `say/sys/note/card/clear`）、`createToasts(shell): Toasts`（提供 `toast(msg)`、`affToast(items)`）

**搬运源**：`pushMsg` `:674-687`、`pushSys` `:689-692`、`pushNote` `:693-696`、`pushCard` `:697-703`、`toast` `:668-671`、`applyEff` 的浮层文案 `:710-713`、`scroll` `:667`、`setStage` `:672`。

- [ ] **Step 1: 写 `src/ui/toasts.ts`**

```ts
import type { AffToastItem, CharTable } from '../engine/types';

export interface Toasts {
  toast(msg: string): void;
  affToast(items: readonly AffToastItem[], chars: CharTable): void;
}

export function createToasts(host: HTMLElement): Toasts {
  function push(msg: string): void {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    host.appendChild(d);
    setTimeout(() => d.remove(), 1750);
  }
  return {
    toast: push,
    affToast(items, chars) {
      if (items.length === 0) return;
      const parts = items.map(({ who, delta }) => {
        const c = chars[who];
        return delta > 0 ? `❤ ${c.name} +${delta}` : `💔 ${c.name} ${delta}`;
      });
      push(parts.join('　'));
    },
  };
}
```

- [ ] **Step 2: 写 `src/ui/chat.ts`**

```ts
import type { CharKey, CharTable, Speaker } from '../engine/types';
import { sil } from './silhouettes';

export interface ChatView {
  say(who: Speaker, text: string): void;
  sys(text: string): void;
  note(text: string): void;
  card(who: CharKey): void;
  clear(): void;
}

export function createChatView(
  chat: HTMLElement,
  stageSil: HTMLElement,
  chars: CharTable,
): ChatView {
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  const setStage = (key: CharKey | null) => {
    stageSil.innerHTML = key ? sil(key, 520, chars) : '';
  };

  return {
    say(who, text) {
      const me = who === 'me';
      const c = me ? null : chars[who as CharKey];
      const wrap = document.createElement('div');
      wrap.className = 'msg' + (me ? ' me' : '');
      wrap.innerHTML = me
        ? '<div class="body"><div class="bub"></div></div>'
        : `<div class="av" style="background:${hex2rgba(c!.color, 0.14)};border-color:${hex2rgba(c!.color, 0.4)}">${c!.emoji}</div>
           <div class="body"><div class="nm">${esc(c!.name)}<span class="role">${esc(c!.role)}</span></div><div class="bub"></div></div>`;
      wrap.querySelector('.bub')!.textContent = text;
      chat.appendChild(wrap);
      scroll();
    },

    sys(text) {
      const d = document.createElement('div');
      d.className = 'sys';
      d.innerHTML = `<span>${esc(text)}</span>`;
      chat.appendChild(d);
      scroll();
    },

    note(text) {
      const d = document.createElement('div');
      d.className = 'note';
      d.textContent = text;
      chat.appendChild(d);
      scroll();
    },

    card(who) {
      const c = chars[who];
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<div class="sil">${sil(who, 76, chars)}</div>
        <div class="cinfo"><h4>${esc(c.name)}<span style="font-size:11px;color:var(--dim)">${esc(c.sub)}</span></h4>
        <div class="r">${esc(c.role)}</div><p>${esc(c.desc)}</p></div>`;
      chat.appendChild(d);
      scroll();
      setStage(who);
    },

    clear() {
      chat.innerHTML = '';
      setStage(null);
    },
  };
}

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string
  ));
}

export function hex2rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
```

> `esc` 与 `hex2rgba` 也用于 `drawer.ts` / `overlay.ts`，从 `chat.ts` 导出复用。

- [ ] **Step 3: 写测试**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createChatView, esc } from '../src/ui/chat';
import { createToasts } from '../src/ui/toasts';
import { CHARS } from '../src/content/characters';

const mk = () => {
  const chat = document.createElement('div');
  const sil = document.createElement('div');
  document.body.append(chat, sil);
  return { chat, sil, view: createChatView(chat, sil, CHARS) };
};

describe('聊天流', () => {
  it('他人消息渲染头像与角色名', () => {
    const { chat, view } = mk();
    view.say('yu', '新人 你玩机械动力吗');
    expect(chat.querySelector('.msg .nm')!.textContent).toContain('一条鱼');
    expect(chat.querySelector('.msg .bub')!.textContent).toBe('新人 你玩机械动力吗');
  });

  it('玩家消息用 me 类且无头像', () => {
    const { chat, view } = mk();
    view.say('me', '🐱');
    const msg = chat.querySelector('.msg')!;
    expect(msg.classList.contains('me')).toBe(true);
    expect(msg.querySelector('.av')).toBeNull();
  });

  it('转义 HTML，不注入标签', () => {
    const { chat, view } = mk();
    view.say('yu', '<img src=x onerror=1>');
    expect(chat.querySelector('.bub')!.textContent).toBe('<img src=x onerror=1>');
    expect(chat.querySelector('.bub img')).toBeNull();
  });

  it('卡片渲染角色简介并更新舞台立绘', () => {
    const { chat, sil, view } = mk();
    view.card('shisuan');
    expect(chat.querySelector('.card .cinfo p')!.textContent).toContain('社交渠道');
    expect(sil.innerHTML).toContain('<svg');
  });

  it('clear 清空聊天流与立绘', () => {
    const { chat, sil, view } = mk();
    view.say('yu', 'x');
    view.card('yu');
    view.clear();
    expect(chat.innerHTML).toBe('');
    expect(sil.innerHTML).toBe('');
  });
});

describe('浮层', () => {
  it('正向好感显示 ❤ +N', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createToasts(host).affToast([{ who: 'nanao', delta: 2 }], CHARS);
    expect(host.querySelector('.toast')!.textContent).toBe('❤ 闹七 +2');
  });

  it('负向好感显示 💔', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createToasts(host).affToast([{ who: 'g', delta: -1 }], CHARS);
    expect(host.querySelector('.toast')!.textContent).toBe('💔 G -1');
  });

  it('空数组不产生浮层', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createToasts(host).affToast([], CHARS);
    expect(host.querySelector('.toast')).toBeNull();
  });
});

describe('esc', () => {
  it('转义四个危险字符', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/chat.test.ts`
Expected: PASS（9 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/ui/chat.ts src/ui/toasts.ts tests/chat.test.ts
git commit -m "feat(ui): 聊天流渲染与浮层"
```

---

### Task 15: 选项、枢纽与成员抽屉

**Files:**
- Create: `src/ui/composer.ts`, `src/ui/drawer.ts`
- Test: `tests/composer.test.ts`

**Interfaces:**
- Consumes: `ChoiceOption`、`HubOption`、`CharKey`、`CharTable`、`GameState`（Task 2）；`HERO_KEYS`（Task 3）；`stageOf`（Task 5）；`esc`、`hex2rgba`（Task 14）；`sil`（Task 13）
- Produces: `createComposer(shell): Composer`（`askChoice`、`askHub`、`idle`）、`renderMembers(drList, chars, state): void`

**搬运源**：`renderChoice` `:737-751`、`renderHub` `:752-767`、`renderMembers` `:717-729`。

- [ ] **Step 1: 写 `src/ui/composer.ts`**

```ts
import type { ChoiceOption, HubOption } from '../engine/types';

export interface Composer {
  askChoice(prompt: string, options: readonly ChoiceOption[]): Promise<number>;
  askHub(prompt: string, options: readonly HubOption[]): Promise<number>;
  idle(): void;
}

export function createComposer(host: HTMLElement): Composer {
  const idle = () => { host.innerHTML = '<div class="c-idle">……</div>'; };

  function render(prompt: string, buttons: { label: string; pick: () => void }[]): void {
    host.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'c-prompt';
    p.textContent = prompt;
    host.appendChild(p);
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'choice';
      el.textContent = b.label;
      el.onclick = () => { idle(); b.pick(); };
      host.appendChild(el);
    }
  }

  return {
    idle,
    askChoice(prompt, options) {
      return new Promise(resolve => {
        render(prompt, options.map((o, i) => ({ label: o.label, pick: () => resolve(i) })));
      });
    },
    askHub(prompt, options) {
      return new Promise(resolve => {
        render(prompt, options.map((o, i) => ({ label: o.label, pick: () => resolve(i) })));
      });
    },
  };
}
```

> **注意**：`askHub` 收到的 `options` 已由引擎过滤掉已触发的 `once` 项，因此这里不再过滤——索引与引擎侧一致。这是与现状的关键差异（现状在渲染时才过滤），也是修复「用按钮文字当去重键」的前提。

- [ ] **Step 2: 写 `src/ui/drawer.ts`**

```ts
import type { CharKey, CharTable, GameState } from '../engine/types';
import { HERO_KEYS } from '../content/characters';
import { stageOf } from '../engine/effects';
import { esc, hex2rgba } from './chat';

/** 源：group-chat-galgame.html:717-729 */
export function renderMembers(host: HTMLElement, chars: CharTable, state: GameState): void {
  const rows = HERO_KEYS.map(k => {
    const c = chars[k];
    const a = state.aff[k] ?? 0;
    const pct = Math.min(100, a / 8 * 100);
    return `<div class="dr-row">
      <div class="av" style="background:${hex2rgba(c.color, 0.14)};border-color:${hex2rgba(c.color, 0.4)}">${c.emoji}</div>
      <div class="dr-mid"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.role)}</div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="dr-stage">${stageOf(a)}</div></div>`;
  }).join('');

  host.innerHTML = rows + `<div class="dr-row" style="opacity:.7">
      <div class="av">🧑🔧</div><div class="dr-mid"><div class="t">根哥 · aka · 蘑菇汤</div>
      <div class="s">助攻 / 反派 · 暂未开放攻略</div></div></div>`;
}
```

- [ ] **Step 3: 写测试**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createComposer } from '../src/ui/composer';
import { renderMembers } from '../src/ui/drawer';
import { createInitialState } from '../src/engine/effects';
import { CHARS, HERO_KEYS } from '../src/content/characters';

describe('选项渲染', () => {
  it('渲染提示语与按钮，点击后 resolve 对应索引', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const c = createComposer(host);
    const p = c.askChoice('说点什么', [
      { label: 'A', goto: 'x' }, { label: 'B', goto: 'x' },
    ]);
    expect(host.querySelector('.c-prompt')!.textContent).toBe('说点什么');
    const btns = host.querySelectorAll<HTMLButtonElement>('.choice');
    expect(btns).toHaveLength(2);
    btns[1]!.click();
    await expect(p).resolves.toBe(1);
    expect(host.querySelector('.c-idle')).not.toBeNull();
  });

  it('hub 只渲染引擎传入的（已过滤）选项', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const c = createComposer(host);
    const p = c.askHub('去哪', [{ id: 'main', label: '推进主线', goto: 'x' }]);
    expect(host.querySelectorAll('.choice')).toHaveLength(1);
    host.querySelector<HTMLButtonElement>('.choice')!.click();
    await expect(p).resolves.toBe(0);
  });

  it('按钮文字用于展示，不作为任何键', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createComposer(host).askHub('p', [{ id: 's_mc', label: 'MC', once: true, goto: 'x' }]);
    expect(host.querySelector<HTMLButtonElement>('.choice')!.textContent).toBe('MC');
  });
});

describe('成员抽屉', () => {
  it('渲染全部可攻略角色的好感条与阶段', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const s = createInitialState();
    s.aff.nanao = 7;
    renderMembers(host, CHARS, s);
    const rows = host.querySelectorAll('.dr-row');
    expect(rows).toHaveLength(HERO_KEYS.length + 1); // +1 是助攻/反派占位行
    const first = rows[0]!;
    expect(first.querySelector('.t')!.textContent).toBe('闹七');
    expect(first.querySelector('.dr-stage')!.textContent).toBe('沦陷');
    expect(first.querySelector<HTMLElement>('.bar i')!.style.width).toBe('87.5%');
  });

  it('末行是助攻/反派占位', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderMembers(host, CHARS, createInitialState());
    const last = host.querySelector('.dr-row:last-child')!;
    expect(last.textContent).toContain('蘑菇汤');
    expect(last.textContent).toContain('暂未开放攻略');
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/composer.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/ui/composer.ts src/ui/drawer.ts tests/composer.test.ts
git commit -m "feat(ui): 选项/枢纽渲染与成员抽屉"
```

---

### Task 16: 结局弹窗与关于页

**Files:**
- Create: `src/ui/overlay.ts`
- Test: `tests/overlay.test.ts`

**Interfaces:**
- Consumes: `BeId`、`EndingResolution`、`Session`、`CharTable`、`EndingData`（Task 2）；`BEDATA`、`ENDING`（Task 4）；`HERO_KEYS`（Task 3）；`stageOf`（Task 5）；`esc`（Task 14）
- Produces: `createOverlay(shell, chars): Overlay`（`showBE`、`showEnding`、`showAbout`、`close`、`isOpen`）

**搬运源**：`openOverlay` `:791-795`、`closeOverlay` `:796`、`showBE` `:807-813`、`showEnding` `:814-831`、`showAbout` `:832-847`。

- [ ] **Step 1: 写 `src/ui/overlay.ts`**

```ts
import type { BeId, CharTable, EndingResolution, Session } from '../engine/types';
import { BEDATA, ENDING } from '../content/endings';
import { HERO_KEYS } from '../content/characters';
import { stageOf } from '../engine/effects';
import { esc } from './chat';

export interface Overlay {
  showBE(id: BeId): void;
  showEnding(resolution: EndingResolution, session: Session): void;
  showAbout(onStart: () => void): void;
  close(): void;
  isOpen(): boolean;
  /** 弹窗里的「从头再来 / 返回标题」由外部注入 */
  onRestart: () => void;
  onBackToTitle: () => void;
}

export function createOverlay(
  overlay: HTMLElement,
  ovCard: HTMLElement,
  chars: CharTable,
): Overlay {
  const api: Overlay = {
    onRestart: () => {},
    onBackToTitle: () => {},
    isOpen: () => !overlay.classList.contains('hidden'),
    close: () => { overlay.classList.add('hidden'); },
    showBE(id) { open(beHtml(id), 'be-ov'); },
    showEnding(resolution, session) { open(endingHtml(resolution, session, chars), 'end-ov'); },
    showAbout(onStart) { open(aboutHtml(), ''); wireAbout(onStart); },
  };

  function open(html: string, cls: string): void {
    ovCard.className = 'ov' + (cls ? ' ' + cls : '');
    ovCard.innerHTML = html;
    overlay.classList.remove('hidden');
    wireRestart();
  }

  function wireRestart(): void {
    const r = document.getElementById('ovRestart');
    const t = document.getElementById('ovTitle');
    if (r) r.onclick = () => { api.close(); api.onRestart(); };
    if (t) t.onclick = () => { api.close(); api.onBackToTitle(); };
  }

  function wireAbout(onStart: () => void): void {
    const a = document.getElementById('ovClose');
    const b = document.getElementById('ovClose2');
    if (a) a.onclick = () => { api.close(); onStart(); };
    if (b) b.onclick = () => api.close();
  }

  const restartBtns = () => `<div class="btns">
    <button class="btn primary" id="ovRestart">从头再来</button>
    <button class="btn" id="ovTitle">返回标题</button></div>`;

  /** 源：:807-813 */
  function beHtml(id: BeId): string {
    const b = BEDATA[id];
    return `<div class="tag">${esc(b.tag)}</div><h2>${esc(b.title)}</h2>
      <p>${esc(b.text)}</p>${restartBtns()}`;
  }

  /** 源：:814-831。结局由引擎判定后传入，此处只负责展示。 */
  function endingHtml(resolution: EndingResolution, session: Session, c: CharTable): string {
    if (resolution.kind === 'be') return beHtml(resolution.id);

    const e = ENDING[resolution.key] ?? ENDING.nanao!;
    const sum = HERO_KEYS
      .map(k => `${c[k].name}：<b>${stageOf(session.state.aff[k] ?? 0)}</b>`)
      .join('　');
    return `<div class="tag">END · 路线序章</div><h2>${esc(e.title)}</h2>
      <p>${esc(e.text)}</p>
      <div class="stat-sum">当前沦陷度<br>${sum}<br><br>
      <span style="color:var(--dim)">水群值：<b>${session.state.water}</b> ｜ 群成员：<b>${session.state.members}</b></span></div>
      ${restartBtns()}
      <p style="margin-top:16px;font-size:12px;color:var(--dim)">※ 本条为路线序章，个人线好结局按企划要求暂未撰写。游戏内可触发 9 个 Bad End。</p>`;
  }

  /** 源：:832-847 */
  function aboutHtml(): string {
    return `<div class="tag">ABOUT</div><h2>关于 &amp; 素材</h2>
      <p>《😂群聊 · 全群攻陷计划》单文件可玩 Demo，无需服务器、无需联网。</p>
      <p style="margin-top:12px"><b style="color:var(--cyan)">立绘</b>：CSS / SVG 现场绘制的半透明纯色剪影，不含外部图片。</p>
      <p style="margin-top:10px"><b style="color:var(--cyan)">BGM</b>：内置 Web Audio 实时合成，免版权、离线可播。若替换为真实开源曲目，可参考下列来源并保留署名：</p>
      <p style="margin-top:10px">
        · <a href="https://dova-s.jp/en/" target="_blank">DOVA-SYNDROME</a> 免费 BGM，可商用、无需署名<br>
        · <a href="https://opengameart.org/content/yoiyami-core-theme-%E2%80%93-deep-blue-ambient-piano" target="_blank">OpenGameArt · Yoiyami Core Theme（CC0）</a><br>
        · <a href="https://potat0master.itch.io/free-background-music-for-visual-novels-bgm-pack-1" target="_blank">Potat0Master · Free VN BGM Pack</a>
      </p>
      <p style="margin-top:12px;color:var(--dim);font-size:12.5px">玩法提示：顶部「复读」可涨水群值，但同一句话连续刷屏 3 次会被禁言。</p>
      <div class="btns"><button class="btn primary" id="ovClose">开始游戏</button>
      <button class="btn" id="ovClose2">返回</button></div>`;
  }

  return api;
}
```

- [ ] **Step 2: 写测试**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createOverlay } from '../src/ui/overlay';
import { createInitialState } from '../src/engine/effects';
import { CHARS } from '../src/content/characters';

const mk = () => {
  const overlay = document.createElement('div');
  overlay.className = 'overlay hidden';
  const card = document.createElement('div');
  card.id = 'ovCard';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return { ov: createOverlay(overlay, card, CHARS), overlay, card };
};

const session = (aff: Record<string, number> = {}) => ({
  state: { ...createInitialState(), aff: { ...createInitialState().aff, ...aff } as never },
  ip: 0, history: [],
});

describe('结局弹窗', () => {
  it('BE 弹窗显示标题与正文，并带 be-ov 样式', () => {
    const { ov, card } = mk();
    ov.showBE('BE01');
    expect(ov.isOpen()).toBe(true);
    expect(card.className).toContain('be-ov');
    expect(card.querySelector('h2')!.textContent).toBe('BE-01 老傻子');
  });

  it('路线结局显示沦陷度与水群值', () => {
    const { ov, card } = mk();
    ov.showEnding({ kind: 'route', key: 'yu' }, session({ yu: 6, nanao: 1 }));
    expect(card.className).toContain('end-ov');
    expect(card.querySelector('.stat-sum')!.textContent).toContain('一条鱼：宝宝');
    expect(card.querySelector('.stat-sum')!.textContent).toContain('水群值：0');
  });

  it('结局判定为 be 时复用 BE 弹窗', () => {
    const { ov, card } = mk();
    ov.showEnding({ kind: 'be', id: 'BE23' }, session());
    expect(card.className).toContain('be-ov');
    expect(card.querySelector('h2')!.textContent).toContain('第 81 人');
  });

  it('路线结局文案含 9 个 Bad End 的说明', () => {
    const { ov, card } = mk();
    ov.showEnding({ kind: 'route', key: 'nanao' }, session({ nanao: 8 }));
    expect(card.textContent).toContain('9 个 Bad End');
  });

  it('关闭后 isOpen 为 false', () => {
    const { ov } = mk();
    ov.showBE('BE02');
    ov.close();
    expect(ov.isOpen()).toBe(false);
  });

  it('「从头再来」触发 onRestart 回调', () => {
    const { ov, card } = mk();
    let restarted = false;
    ov.onRestart = () => { restarted = true; };
    ov.showBE('BE05');
    card.querySelector<HTMLButtonElement>('#ovRestart')!.click();
    expect(restarted).toBe(true);
  });

  it('关于页含三个 BGM 素材来源', () => {
    const { ov, card } = mk();
    ov.showAbout(() => {});
    expect(card.querySelectorAll('a')).toHaveLength(3);
    expect(card.textContent).toContain('无需服务器、无需联网');
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- tests/overlay.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 4: Commit**

```bash
git add src/ui/overlay.ts tests/overlay.test.ts
git commit -m "feat(ui): 结局/关于弹窗"
```

---

### Task 17: 装配、驱动与等价性验收

**Files:**
- Create: `src/ui/renderer.ts`, `src/main.ts`
- Test: `tests/equivalence/walkthrough.test.ts`, `tests/build-assets.test.ts`

**Interfaces:**
- Consumes: 全部前置任务
- Produces: 可运行的游戏；等价性快照测试；单文件产物断言

- [ ] **Step 1: 写 `src/ui/renderer.ts`（把 UI 组装成 `Renderer`）**

```ts
import type { DelayPolicy, Renderer, Session } from '../engine/types';
import type { ChatView } from './chat';
import type { Composer } from './composer';
import type { Overlay } from './overlay';
import type { Toasts } from './toasts';
import { BGM, sfx } from '../audio/bgm';
import { CHARS } from '../content/characters';

export interface RendererDeps {
  chat: ChatView;
  composer: Composer;
  overlay: Overlay;
  toasts: Toasts;
  delays: DelayPolicy;
}

export function createRenderer(deps: RendererDeps): Renderer {
  const { chat, composer, overlay, toasts, delays } = deps;

  return {
    delays,

    async say(who, text) { chat.say(who, text); sfx('msg'); },
    async sys(text) { chat.sys(text); },
    async note(text) { chat.note(text); },
    async card(who) { chat.card(who); sfx('card'); },

    bgm(track) { BGM.set(track); },
    affToast(items) { toasts.affToast(items, CHARS); },

    toast(text) { toasts.toast(text); },

    askChoice(prompt, options) { return composer.askChoice(prompt, options); },
    askHub(prompt, options) { return composer.askHub(prompt, options); },

    async showBE(id) { BGM.set('tension'); overlay.showBE(id); },
    async showEnding(resolution, session) { BGM.set('warm'); overlay.showEnding(resolution, session); },
  };
}
```

- [ ] **Step 2: 写 `src/main.ts`（启动装配 + 复读/快进/抽屉等外围交互）**

```ts
import './styles/tokens.css';
import './styles/title.css';
import './styles/chat.css';
import './styles/chrome.css';

import { mountShell } from './ui/shell';
import { createChatView } from './ui/chat';
import { createComposer } from './ui/composer';
import { createOverlay } from './ui/overlay';
import { createToasts } from './ui/toasts';
import { createRenderer } from './ui/renderer';
import { renderMembers } from './ui/drawer';
import { CHARS } from './content/characters';
import { SCRIPT, LABELS } from './content/chapters';
import { BEDATA } from './content/endings';
import { applyRepeat, createInitialState } from './engine/effects';
import { run } from './engine/runner';
import { BGM } from './audio/bgm';
import type { DelayPolicy, Session } from './engine/types';

const root = document.getElementById('app');
if (!root) throw new Error('缺少挂载点 #app');

const shell = mountShell(root);
const chat = createChatView(shell.chat, shell.stageSil, CHARS);
const composer = createComposer(shell.composer);
const overlay = createOverlay(shell.overlay, shell.ovCard, CHARS);
const toasts = createToasts(shell.toasts);

/** 可变对象，快进开关直接改 fast 字段，Renderer 每次读取时即时生效。 */
const delays: DelayPolicy = { me: 280, msg: 520, sys: 560, note: 680, card: 760, fast: false };

let session: Session = { state: createInitialState(), ip: 0, history: [] };
let running = false;

const renderer = createRenderer({ chat, composer, overlay, toasts, delays });

function updateTop(): void {
  shell.mCount.textContent = String(session.state.members);
  shell.mWater.textContent = String(session.state.water);
}

async function startGame(): Promise<void> {
  shell.title.classList.add('hidden');
  shell.game.classList.remove('hidden');
  session = { state: createInitialState(), ip: 0, history: [] };
  chat.clear();
  composer.idle();
  updateTop();
  renderMembers(shell.drList, CHARS, session.state);
  BGM.set('chat');
  BGM.start('chat');
  running = true;
  await run(session, { script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA }, renderer);
  running = false;
}

function backToTitle(): void {
  overlay.close();
  shell.game.classList.add('hidden');
  shell.title.classList.remove('hidden');
  shell.stageSil.innerHTML = '';
}

overlay.onRestart = () => { void startGame(); };
overlay.onBackToTitle = backToTitle;

shell.btnStart.onclick = () => { BGM.start('chat'); void startGame(); };
shell.btnAbout.onclick = () => overlay.showAbout(() => { void startGame(); });
shell.btnBgmTitle.onclick = () => {
  const on = BGM.toggle();
  shell.btnBgmTitle.textContent = '🔊 音乐：' + (on ? '开' : '关');
};
shell.btnBgm.onclick = () => {
  const on = BGM.toggle();
  shell.btnBgm.textContent = on ? '🔊' : '🔇';
};
shell.btnMembers.onclick = () => {
  renderMembers(shell.drList, CHARS, session.state);
  shell.drawer.classList.add('open');
};
shell.btnCloseDr.onclick = () => shell.drawer.classList.remove('open');
shell.btnFast.onclick = () => {
  delays.fast = !delays.fast;
  shell.btnFast.textContent = delays.fast ? '快进:开' : '快进';
  toasts.toast(delays.fast ? '已开启快进' : '已关闭快进');
};

/** 复读：全部逻辑在 applyRepeat 里，这里只负责展示与 BE24 分支。 */
shell.btnRepeat.onclick = () => {
  if (!running) { toasts.toast('还没有可以复读的消息'); return; }

  const result = applyRepeat(session);
  if (result.outcome === 'empty' || result.spoken === undefined) {
    toasts.toast('还没有可以复读的消息');
    return;
  }

  session = result.session;
  chat.say('me', result.spoken);
  updateTop();

  if (result.outcome === 'banned') { BGM.set('tension'); overlay.showBE('BE24'); return; }
  if (result.outcome === 'warn') toasts.toast('再复读一次 要被禁言了');
  else toasts.toast('复读成功  +1 水群值');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    shell.drawer.classList.remove('open');
    overlay.close();
  }
});

renderMembers(shell.drList, CHARS, session.state);
```

> **复读被抽成 `applyRepeat` 的意义**：现状这段逻辑埋在事件回调里，无法测试。
> 抽出后「连续复读 3 次才禁言、中间来新消息要归零」这条规则第一次有了测试保护（Task 5 Step 5）。

- [ ] **Step 3: 写等价性走查测试**

```ts
import { describe, expect, it } from 'vitest';
import { run } from '../src/engine/runner';
import { createInitialState } from '../src/engine/effects';
import { SCRIPT, LABELS } from '../src/content/chapters';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import { FakeRenderer } from './fake-renderer';
import type { Session } from '../src/engine/types';

const env = { script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA };
const fresh = (): Session => ({ state: createInitialState(), ip: 0, history: [] });

async function play(choiceAnswers: number[], hubAnswers: number[]) {
  const r = new FakeRenderer();
  r.choiceAnswers = choiceAnswers;
  r.hubAnswers = hubAnswers;
  const s = fresh();
  await run(s, env, r);
  return { r, s };
}

describe('等价性走查', () => {
  it('正常通关（序章选 0，第一章全选 0，走完 6 条支线后推进主线）', async () => {
    const { r, s } = await play([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
    expect(r.calls.at(-1)!.t).toBe('ending');
    // 6 条支线各触发一次后，第 7 次 hub 只剩「推进主线」
    expect(s.state.hub['s_mc']).toBe(true);
    expect(s.state.hub['main']).toBeUndefined();
  });

  it('第一章选「你谁啊 凭什么命令我」触发 BE01', async () => {
    const { r } = await play([0, 2], []);
    expect(r.calls.at(-1)).toEqual({ t: 'be', id: 'BE01' });
  });

  it('第一章选「给你们讲个黄段子」触发 BE05', async () => {
    const { r } = await play([0, 0, 0, 2], []);
    expect(r.calls.at(-1)).toEqual({ t: 'be', id: 'BE05' });
  });

  it('蘑菇汤支线选「好像是有点」触发 BE20', async () => {
    const { r } = await play([0, 0, 0, 0, 0], [5]);
    expect(r.calls.at(-1)).toEqual({ t: 'be', id: 'BE20' });
  });

  it('全程低好感 + 放鸽子 → BE10', async () => {
    const { r } = await play([1, 1, 2, 1, 1, 0, 1], [0, 0, 0, 0, 0, 0, 0]);
    const last = r.calls.at(-1)!;
    expect(last.t === 'be' || last.t === 'ending').toBe(true);
  });

  it('完整渲染序列快照（防未来回归）', async () => {
    const { r } = await play([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
    expect(r.calls.map(c => c.t)).toMatchSnapshot();
  });
});
```

> 前 5 条用例钉住**行为**（走哪条分支、触发哪个 BE），最后一条钉住**完整调用序列**。
> 快照首次运行会生成 `tests/equivalence/__snapshots__/`，之后任何行为漂移都会让它失败。

- [ ] **Step 4: 写单文件产物断言**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIST = 'dist/index.html';

describe.skipIf(!existsSync(DIST))('单文件产物', () => {
  const html = () => readFileSync(DIST, 'utf8');

  it('不含任何外部脚本或样式引用', () => {
    expect(html()).not.toMatch(/<script[^>]+src=/i);
    expect(html()).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it('JS 与 CSS 已内联', () => {
    expect(html()).toMatch(/<script[^>]*>/i);
    expect(html()).toMatch(/<style/i);
  });

  it('体积在合理范围（内联后通常 100–400 KB）', () => {
    expect(html().length).toBeGreaterThan(20_000);
    expect(html().length).toBeLessThan(2_000_000);
  });
});
```

- [ ] **Step 5: 跑全量测试与类型检查**

Run: `npm run typecheck && npm test`
Expected: 全部 PASS

- [ ] **Step 6: 构建并验证产物**

Run: `npm run build`
Expected: `dist/index.html` 生成；随后 `npm test -- tests/build-assets.test.ts` 通过

- [ ] **Step 7: 手工等价性验收（必做，不可跳过）**

1. 用浏览器打开**旧版** `group-chat-galgame.html`，走一条固定路径，记录：开场消息顺序、每个选项的好感度浮层文案、结局文案
2. 用 `npm run dev`（或打开 `dist/index.html`）走**完全相同的选项路径**
3. 逐项对照：消息顺序、浮层文案、成员抽屉数值、结局页文案**必须完全一致**
4. 至少覆盖：正常通关 / 一条支线 / 一个 BE / 复读三次触发 BE24

- [ ] **Step 8: 交回审阅前的最终提交**

```bash
git add -A
git commit -m "feat: 装配运行时并完成阶段 1 等价重构

- src/ui/renderer.ts 把 UI 组装成 Renderer
- src/main.ts 启动装配、复读/快进/抽屉/快捷键
- 复读改为从 history 取末条，不再依赖 DOM 反查
- 等价性走查测试 + 渲染序列快照 + 单文件产物断言

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 阶段 1 完成标准

全部勾选后，阶段 1 才算完成：

- [ ] `npm run typecheck` 无错误
- [ ] `npm test` 全绿
- [ ] `npm run check:script` 通过
- [ ] `npm run build` 产出单文件 `dist/index.html`，无外部引用
- [ ] **手工等价性验收**：旧版与新版本在相同选项路径下表现一致（消息顺序 / 浮层文案 / 抽屉数值 / 结局文案）
- [ ] 旧文件 `group-chat-galgame.html` **仍在仓库中且未被修改**（阶段 3 结束后再决定去留）

## 后续阶段（不在本计划内）

- **阶段 2**：存档 / 读档 / 回想 / 设置；Pages 构建
- **阶段 3**：前端优化（用 `frontend-design` 技能做设计重做：排版层级、动效节奏、移动端手感、响应式、无障碍）
- **阶段 4**：人设档案（`docs/persona/`，已 gitignore）

