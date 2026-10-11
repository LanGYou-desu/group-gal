# 😂群聊 · 全群攻陷计划

把真实 QQ 音游群二创成 galgame 的同人作品。你作为第 81 位群友入群，在一群嘴硬心软的人中间选择怎么说话。

- **原版**：`group-chat-galgame.html` —— 907 行单文件，双击即玩、离线可玩
- **重构版**：`src/` —— Vite + TypeScript，模块化，带测试与剧本校验

两版当前**行为完全一致**（已用自动化比对验证，见「等价性」一节）。

---

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 + HMR
npm run build        # 产出单个 HTML：dist/index.html
```

`dist/index.html` 是**自包含单文件**——无外部脚本、无外部样式、无外部资源。双击即可离线游玩，也可以直接发给别人。

## 全部命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite 开发服务器，改代码即时生效 |
| `npm run build` | 先跑剧本校验，再打包成单文件 `dist/index.html` |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | 全部测试（254 个用例） |
| `npm run test:watch` | 测试监听模式 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run check:script` | **只跑剧本校验**（见下） |

## 剧本校验：写坏剧情不会等到玩家踩到

`npm run check:script` 会在**构建前**检查整张剧情图，`npm run build` 也把它作为前置步骤。它拦得住：

- `goto` 指向不存在的 label（原版的这处缺陷会让玩家莫名其妙通关）
- 引用了不存在的角色键
- Bad End 缺文本、label 重复、hub 选项 id 重复
- 起始节点不是 `start`
- 终止节点之后的死节点（警告）
- 设置了但从未被读取的标记（警告）

当前输出：**185 个节点，0 错误，8 警告**（8 条都是源剧本的既有问题，见「已知问题」）。

---

## 目录结构

```
src/
├─ engine/           # 纯逻辑，零 DOM —— 可无头测试
│  ├─ types.ts       # 剧本节点判别联合、角色、状态、Renderer 接口
│  ├─ runner.ts      # 解释器
│  ├─ effects.ts     # 好感度结算、阶段计算、复读
│  ├─ ending.ts      # 结局判定
│  ├─ validate.ts    # 剧本图校验器
│  └─ validate.cli.ts
├─ content/          # 剧情数据 —— 加内容只动这里
│  ├─ characters.ts  # 14 个角色
│  ├─ endings.ts     # 9 个 Bad End + 7 条路线结局
│  └─ chapters/      # prologue / ch1 / hub / ch3 / index
├─ ui/               # DOM 渲染层
│  ├─ shell.ts       # 外壳 DOM 结构
│  ├─ chat.ts        # 聊天流（消息/系统/旁白/卡片）
│  ├─ composer.ts    # 选项与枢纽按钮
│  ├─ drawer.ts      # 群成员抽屉
│  ├─ overlay.ts     # 结局/关于弹窗
│  ├─ toasts.ts      # 浮层提示
│  ├─ silhouettes.ts # SVG 剪影立绘
│  └─ renderer.ts    # 把上面各块组装成引擎所需的 Renderer
├─ audio/bgm.ts      # Web Audio 实时合成 BGM 与音效
├─ styles/           # tokens / title / chat / chrome
└─ main.ts           # 启动装配
```

### 设计要点：引擎不含一行 DOM

`src/engine/` 通过注入的 `Renderer` 接口驱动界面。生产环境注入真实 DOM 实现；测试注入 `tests/fake-renderer.ts`（记录调用序列），于是**整张剧情图可以被无头跑通**——这是原版单文件做不到的。

### 加剧情

1. 在 `src/content/chapters/` 新建或编辑章节文件
2. 在 `chapters/index.ts` 登记
3. 跑 `npm run check:script` 确认跳转全部可解析
4. 跑 `npm test`

⚠️ **章节拼接顺序即执行顺序**——label 存的是绝对下标，调整顺序会改变跳转行为。

---

## 等价性

重构的第一原则是**行为不变**。验证方式有两层：

1. **自动化剧本走查**（`tests/equivalence/`）：用固定的选项序列跑完整张图，比对渲染序列快照。覆盖完整通关、全部即时 BE 分叉、蘑菇汤线三分支。
2. **与旧版并排比对**：同一选项路径下，旧版 `group-chat-galgame.html` 与新版 `dist/index.html` 的渲染序列、结算数值、结局文案必须逐项一致。

`tests/chapters*.test.ts` 里还有**逐字抽查**，直接守住「不重写文案」这条约束。

---

## 已知问题

这些是**源剧本的既有问题**，重构阶段原样保留（改动剧情属于后续创作范畴）：

| 问题 | 说明 |
|---|---|
| **BE23「第 81 人」不可达** | 结局页宣称「可触发 9 个 Bad End」，实际只有 8 个。精确枚举序章+第一章全部 2916 组选项后，进入支线枢纽时的最低好感总和为 6，而不带「放鸽子」标记的终局最低总和为 7 —— 永远够不到 BE23 要求的 ≤4 |
| **3 组死标签** | `BE19` / `BE20` 的标签从不被 `goto` 引用（蘑菇汤线的 a/b 分支用内联 `be` 节点终止）；`BE24` 的标签只由复读逻辑直接触发 |
| **2 个只写不读的标记** | `sheiTrap` 与 `mokuJoin` 被设置但没有任何分支读取 |

## 后续计划

| 阶段 | 内容 |
|---|---|
| ~~1~~ | ~~等价重构：单文件 → Vite + TypeScript~~ ✅ |
| 2 | VN 标配功能：存档 / 读档 / 回想 / 设置 |
| 3 | 前端优化：排版层级、动效节奏、移动端手感、无障碍 |
| 4 | 人设档案（从群聊记录分析报告提炼，存放于 `docs/persona/`，**已 gitignore**） |
| 5 | 台词修订：按人设档案统一各角色口癖，并补全上述死内容 |

设计与计划文档在 `docs/superpowers/`。

---

## 关于素材

- **立绘**：CSS / SVG 现场绘制的半透明纯色剪影，不含外部图片
- **BGM**：内置 Web Audio 实时合成，免版权、离线可播

若要替换为真实开源曲目，可参考并保留署名：

- [DOVA-SYNDROME](https://dova-s.jp/en/) —— 免费 BGM，可商用、无需署名
- [OpenGameArt · Yoiyami Core Theme（CC0）](https://opengameart.org/content/yoiyami-core-theme-%E2%80%93-deep-blue-ambient-piano)
- [Potat0Master · Free VN BGM Pack](https://potat0master.itch.io/free-background-music-for-visual-novels-bgm-pack-1)

## 仓库与同步

这是 [`Whomever404/group-gal`](https://github.com/Whomever404/group-gal) 的 fork。`origin` 指向自己的 fork，`upstream` 指向原仓库（**已设为只读**，防止误推）。

```bash
git fetch upstream
git log --oneline HEAD..upstream/main     # 看原仓库有没有新提交
git merge upstream/main                   # 合进来
```

## 开发环境

- Node.js ≥ 20（开发时使用 v24）
- 仓库统一 **UTF-8 无 BOM + LF**（见 `.gitattributes` 与 `.editorconfig`）
