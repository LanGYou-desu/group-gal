# group-gal 阶段 2–5 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在阶段 1 的等价重构之上，补齐 VN 标配功能、重做前端、产出人设档案并按档案修订台词。

**Architecture:** 沿用阶段 1 的分层——`src/engine/` 保持零 DOM，新功能一律「引擎侧纯逻辑 + 渲染器侧 DOM」两侧分离，引擎侧全部可测。

**Tech Stack:** 同阶段 1（Vite 7 · TypeScript 5 · Vitest 3 · vite-plugin-singlefile）

**Spec:** `docs/superpowers/specs/2026-10-11-group-gal-refactor-design.md`（§8 存档/回想、§10 人设档案、§11 阶段划分）

## Global Constraints

- `src/engine/` 不得出现任何 DOM API（`document` / `window` / `localStorage`）——**localStorage 的读写必须在 `src/ui/`**
- 所有新增用户可见文案用中文，风格与现有 UI 一致
- 转义纪律沿用阶段 1：来自存档/剧本的文本经 `esc()` 或 `textContent`
- 新增文件 UTF-8 无 BOM、LF、2 空格缩进
- 提交信息末尾附 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Review Focus

这几类是任务测试覆盖不到、但最可能让玩家踩坑的：

1. **损坏 / 手改过的存档** —— 反序列化必须挡住畸形数据（缺字段、类型错、`schemaVersion` 未来版本），不得让游戏白屏。**存档来自 localStorage，是可被用户编辑的不可信输入。**
2. **在选择点存档再读回** —— 必须恢复到「停在同一个选择前」，而不是跳过该选择或重复渲染已播内容。
3. **回想与实时聊天流的一致性** —— 读档后回想应包含读档前的历史，且不能与聊天流重复计数。
4. **删档后立即读档** —— 不得读到脏数据或抛错。
5. **文字速度设为「慢」后重开一局** —— 设置应当持久（存 localStorage），而**快进**应当每局重置（阶段 1 已定）。

---

## 阶段 2 · VN 标配功能

### Task 2.1: 存档序列化与迁移（引擎侧，零 DOM）

**Files:** Create `src/engine/persist.ts`；Test `tests/persist.test.ts`

**Interfaces:**
- Consumes: `Session`、`GameState`、`LogEntry`（`types.ts`）；`SCHEMA_VERSION`、`createInitialState`（`effects.ts`）
- Produces: `SAVE_VERSION`、`serializeSession(s): string`、`deserializeSession(raw: unknown): Session | null`、`migrateSave(raw: unknown): Session | null`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, expect, it } from 'vitest';
import { deserializeSession, serializeSession, migrateSave, SAVE_VERSION } from '../src/engine/persist';
import { createInitialState } from '../src/engine/effects';
import type { Session } from '../src/engine/types';

const sess = (): Session => ({ state: createInitialState(), ip: 42, history: [{ kind: 'say', who: 'yu', text: '嗨' }] });

describe('存档往返', () => {
  it('序列化后能原样反序列化', () => {
    const s = sess();
    expect(deserializeSession(JSON.parse(serializeSession(s)))).toEqual(s);
  });
  it('序列化结果是合法 JSON 且带版本号', () => {
    expect(JSON.parse(serializeSession(sess())).v).toBe(SAVE_VERSION);
  });
});

describe('存档防御（Review Focus #1：存档是可被手改的不可信输入）', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['字符串', 'nope'],
    ['数字', 123],
    ['空对象', {}],
    ['缺 state', { v: SAVE_VERSION, ip: 0, history: [] }],
    ['ip 是字符串', { v: SAVE_VERSION, ip: 'x', state: createInitialState(), history: [] }],
    ['history 不是数组', { v: SAVE_VERSION, ip: 0, state: createInitialState(), history: 'x' }],
    ['history 元素畸形', { v: SAVE_VERSION, ip: 0, state: createInitialState(), history: [{ nope: 1 }] }],
    ['aff 缺键', { v: SAVE_VERSION, ip: 0, history: [], state: { ...createInitialState(), aff: {} } }],
    ['flags 值是字符串', { v: SAVE_VERSION, ip: 0, history: [], state: { ...createInitialState(), flags: { actSkip: 'yes' } } }],
    ['ip 越界', { v: SAVE_VERSION, ip: 99999, state: createInitialState(), history: [] }],
  ])('%s → null（不抛错）', (_name, raw) => {
    expect(() => deserializeSession(raw)).not.toThrow();
    expect(deserializeSession(raw)).toBeNull();
  });

  it('来自未来的版本号 → null', () => {
    expect(deserializeSession({ v: SAVE_VERSION + 1, ip: 0, state: createInitialState(), history: [] })).toBeNull();
  });
});

describe('迁移', () => {
  it('当前版本的存档原样通过', () => {
    const s = sess();
    expect(migrateSave(JSON.parse(serializeSession(s)))).toEqual(s);
  });
  it('无版本号的裸会话对象视为 v1 接受', () => {
    expect(migrateSave(sess())).not.toBeNull();
  });
  it('无法迁移的输入返回 null', () => {
    expect(migrateSave({ v: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败** — `npx vitest run tests/persist.test.ts`，预期无法解析模块

- [ ] **Step 3: 实现 `src/engine/persist.ts`**

```ts
import type { CharKey, FlagKey, GameState, LogEntry, Session, Speaker } from './types';
import { HERO_KEYS } from '../content/characters';
import { SCHEMA_VERSION } from './effects';

export const SAVE_VERSION = 1;

export function serializeSession(s: Session): string {
  return JSON.stringify({ v: SAVE_VERSION, ip: s.ip, state: s.state, history: s.history });
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseHistory(raw: unknown): LogEntry[] | null { /* 逐条校验 kind/who/text */ }
function parseState(raw: unknown, scriptLength: number): GameState | null { /* 逐字段校验 */ }

/** 把不可信输入收窄成 Session；任何畸形一律返回 null，绝不抛错。 */
export function deserializeSession(raw: unknown, scriptLength = Number.MAX_SAFE_INTEGER): Session | null { ... }

export function migrateSave(raw: unknown, scriptLength = Number.MAX_SAFE_INTEGER): Session | null { ... }
```

要求：`deserializeSession` 对**任何**输入都不抛错；字段级校验（`aff` 必须含全部 `HERO_KEYS` 且值为有限非负数；`flags` 值是 boolean；`ip` 是 [0, scriptLength] 的整数；`history` 每项是合法 `LogEntry`）。

- [ ] **Step 4: 运行测试，确认通过**
- [ ] **Step 5: 补 Review Focus #1 的边界用例并跑全量** — 特别补「aff 含 NaN」「history 超长数组」
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(engine): 存档序列化与不可信输入的防御性反序列化"
```

---

### Task 2.2: 本地存档仓储（UI 侧，唯一碰 localStorage 的地方）

**Files:** Create `src/ui/storage.ts`；Test `tests/storage.test.ts`

**Interfaces:**
- Consumes: `persist.ts` 的 `serializeSession` / `deserializeSession`（Task 2.1）
- Produces: `SaveSlotId`、`listSlots(): SlotInfo[]`、`readSlot(id): Session | null`、`writeSlot(id, s): boolean`、`deleteSlot(id): void`、`readSettings() / writeSettings(partial)`、`SETTINGS_KEY`

- [ ] **Step 1: 写失败的测试**（含 localStorage 抛错时的降级：隐私模式下 setItem 会抛）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 实现** — 键名 `group-gal/save/<id>` 与 `group-gal/settings`；所有访问包 try/catch，失败时静默降级（返回 null / false），游戏不得因此崩
- [ ] **Step 4: 确认通过**
- [ ] **Step 5: Commit**

---

### Task 2.3: 回想（backlog）

**Files:** Create `src/ui/backlog.ts`；Test `tests/backlog.test.ts`

**Interfaces:**
- Consumes: `LogEntry[]`、`CharTable`、`esc`（`chat.ts`）
- Produces: `createBacklog(deps): Backlog`，含 `open(history)`、`close()`、`isOpen()`

- [ ] **Step 1–5: TDD 循环**
  要点：渲染全部 `LogEntry`；他人消息显示「角色名」+ 正文，玩家消息靠右，系统/旁白居中；
  空历史显示占位文案；**大量历史时可滚动且默认滚到底部**（Review Focus #3）
- [ ] **Step 6: Commit**

---

### Task 2.4: 存档槽界面

**Files:** Create `src/ui/saves.ts`；Test `tests/saves.test.ts`

**Interfaces:**
- Consumes: `storage.ts`（Task 2.2）、`Session`、`stageOf`、`HERO_KEYS`
- Produces: `createSaves(deps): Saves`，含 `open()`、`close()`、`onSave(slot)`、`onLoad(slot)`

- [ ] **Step 1–5: TDD 循环**
  要点：3 个手动槽 + 1 个自动存档；每槽显示「进度摘要」（是否为空、剧情指针、好感最高者、水群值）；
  **空槽不可读档**；删除需二次确认（内联确认，不用 `confirm()`——artifact/CSP 环境下不可靠）
- [ ] **Step 6: Commit**

---

### Task 2.5: 设置面板

**Files:** Create `src/ui/settings.ts`；Test `tests/settings.test.ts`

**Interfaces:**
- Produces: `createSettings(deps): Settings`，含 `open()`、`close()`、`onChange(settings)`、`DEFAULT_SETTINGS`、`SettingsData`

- [ ] **Step 1–5: TDD 循环**
  设置项：BGM 开关、文字速度（慢/普通/快 → `DelayPolicy` 预设）、清除全部存档
  （**Review Focus #5**：设置持久化，但 `fast` 每局重置——两者不可混淆）
- [ ] **Step 6: Commit**

---

### Task 2.6: 接线与自动存档

**Files:** Modify `src/ui/shell.ts`（顶栏按钮）、`src/main.ts`；Test `tests/main.test.ts` 追加

- [ ] **Step 1: 顶栏加「回想」「存档」「设置」三个按钮**（保持 `.mini` 风格），更新 `shell.test.ts` 的按钮清单断言
- [ ] **Step 2: main.ts 接线** —— 每次进入 `choice`/`hub` 节点前写自动存档（**Review Focus #2**：读档必须停在同一个选择前）
- [ ] **Step 3: 追加集成测试** —— 「开局 → 复读 → 存档 → 改状态 → 读档 → 状态回到存档点」；「回想包含读档前的历史」
- [ ] **Step 4: 全量验证**
```
npm test && npm run typecheck && npm run check:script && npm run build
```
- [ ] **Step 5: Commit**

---

## 阶段 3 · 前端优化

用 `frontend-design` 技能做一次设计重做。**不改变任何游戏逻辑**，只动 `src/styles/` 与 `src/ui/` 的呈现层。

- [ ] **Task 3.1:** 设计令牌与排版层级（字体阶梯、间距刻度、色彩对比度达到 WCAG AA）
- [ ] **Task 3.2:** 聊天流可读性（气泡节奏、长消息折行、时间戳可选）
- [ ] **Task 3.3:** 动效节奏（消息揭示、抽屉、弹窗）与 `prefers-reduced-motion` 支持
- [ ] **Task 3.4:** 移动端（安全区 `env(safe-area-inset-*)`、触控目标 ≥44px、软键盘不遮挡输入区）
- [ ] **Task 3.5:** 无障碍（焦点管理、键盘可达、`aria-live` 播报新消息、对比度复核）
- [ ] **Task 3.6:** 每次改动后跑 `npm test` 确认逻辑未受影响；截图对比并提交

## 阶段 4 · 人设档案

（已派给后台子代理）输出到 `docs/persona/`，**该目录已 gitignore**。

- [ ] **Task 4.1:** `README.md` 角色 ↔ 真实成员映射总表
- [ ] **Task 4.2:** 14 份角色档案（六段式，重点是第 4 段口头禅库）
- [ ] **Task 4.3:** `_group.md` 群整体档案
- [ ] **Task 4.4:** 抽查档案质量——口头禅是否真的可用于写作

## 阶段 5 · 台词修订与内容补全

**前提：阶段 4 的档案必须先完成。**

- [ ] **Task 5.1:** 按档案统一各角色口癖（**不动剧情走向、分支结构、结局判定、好感度数值**；保持温情二创基调）
- [ ] **Task 5.2:** **补全 BE23** —— 让它可达（例如给某条支线加一个低好感分支），改掉结局页「9 个 Bad End」的文案使其与实际一致
- [ ] **Task 5.3:** 清理 3 组死标签（BE19/BE20/BE24）—— 或在剧本中真正引用，或删除
- [ ] **Task 5.4:** 让 `sheiTrap` / `mokuJoin` 产生实际后果（补写分支），而不是只写不读
- [ ] **Task 5.5:** 每项改动后跑 `npm run check:script` + `npm test`，并**更新旧的等价性基线**（阶段 5 是刻意的行为变更，需要重新冻结快照）
- [ ] **Task 5.6:** 更新 README 的「已知问题」与「后续计划」

## 收尾

- [ ] 全量验证：`npm test && npm run typecheck && npm run check:script && npm run build`
- [ ] 更新 README（新功能、操作说明、已知问题）
- [ ] `git push` → PR #1 自动更新为包含全部阶段的完整 PR
