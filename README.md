# 😂群聊 · 全群攻陷计划

把真实 QQ 音游群二创成 galgame 的同人作品。你作为第 81 位群友入群，在一群嘴硬心软的人中间选择怎么说话。

- **原版**：`group-chat-galgame.html` —— 907 行单文件，双击即玩、离线可玩
- **重构版**：`src/` —— Vite + TypeScript，模块化，带测试与剧本校验

重构版在阶段 1 与旧版**行为完全一致**；**阶段 5 起是刻意的创作变更**——台词按人设档案重写，并新增一条支线让 BE23 变成可达。当前保证的是：**已有分支的走向、结局判定、结算数值与旧版一致**（自动化比对见「等价性」一节），文本不再逐字相同。

---

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 + HMR
npm run build        # 产出单个 HTML：dist/index.html
```

`dist/index.html` 是**自包含单文件**——无外部脚本、无外部样式、无外部资源。双击即可离线游玩，也可以直接发给别人。

## 在线试玩

推送到 `main` 后，GitHub Actions 会自动构建并部署到 GitHub Pages：

```
https://<你的用户名>.github.io/group-gal/
```

首次启用：仓库 **Settings → Pages → Source** 选 **GitHub Actions**。

> ⚠️ 仓库**根目录的 `index.html` 是 Vite 的开发入口**，只有 `<div id="app">` 加一行
> 模块引用——它必须经 `npm run dev` 或构建才能运行。**直接双击打开会显示一段提示而不是游戏**。
> 想立刻玩：上面那个 Pages 链接，或仓库里的 `group-chat-galgame.html`（原版单文件，双击即玩）。

## 全部命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite 开发服务器，改代码即时生效 |
| `npm run build` | 先跑剧本校验，再打包成单文件 `dist/index.html` |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | 全部测试（383 个用例） |
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

当前输出：**206 个节点，0 错误，0 警告**（阶段 5 已清掉 3 组死标签与 2 个只写不读的标记）。

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

阶段 1 重构的第一原则是**行为不变**；**阶段 5 起部分让位于刻意的创作变更**（用户授权按人设档案改写台词）。当前验证方式：

1. **自动化剧本走查**（`tests/equivalence/walkthrough.test.ts`）：用固定的选项序列跑完整张图，比对渲染序列快照（阶段 5 已重新冻结）。覆盖完整通关、全部即时 BE 分叉、蘑菇汤线三分支，以及新增的 BE23 / BE24 分叉。
2. **与旧版并排比对**（`tests/equivalence/old-vs-new.test.ts`）：**只对结构断言**——同一路径下两边抵达同一个结局（路线 key / BE 编号），新版剧本的节点数 / 标签数 / 分支数冻结，结局集合不变。**不再逐字比对文本**：阶段 5 就是有意要改台词。
3. `tests/chapters*.test.ts` 里的**逐字抽查**守住的是**新版自身**的文案（口癖修订后已更新）。

> 一句话：**阶段 5 起，新版不再与旧版逐字一致**；保证的是分支结构、结局判定与结算数值一致。

---

## 已知问题

阶段 1–5 记录过的问题**均已在阶段 5 解决**：

| 问题 | 阶段 5 的处理 |
|---|---|
| **BE23「第 81 人」不可达** | 新增 hub 支线 `s_quiet`「今晚谁也不找 一个人挂机潜水」——**唯一会降低好感**的路线。在前置最低好感（总分 6）下选它再走主线，总分压到 ≤4，BE23 可触发。结局页宣称的「9 个 Bad End」现在名副其实 |
| **3 组死标签** | `BE19` / `BE20` 改为从蘑菇汤线的 a/b 分支 `goto` 到第三章的对应标签；新增的潜水线用 `goto BE24` 承载「复读刷屏被禁言」。三者都成了真实分支落点 |
| **2 个只写不读的标记** | 剧本语言没有条件节点，标记无法在剧本内被读取；阶段 5 把它们换成**真实分支**：`sheiTrap` → 新增专属分支 `ch1_shei_trap`（接受誰的攻略邀请真的多出一段戏），`mokuJoin` → 直接走向 `s_moku_b` 同化结局。`check:script` 现在 0 警告 |

## 后续计划

| 阶段 | 内容 |
|---|---|
| ~~1~~ | ~~等价重构：单文件 → Vite + TypeScript~~ ✅ |
| ~~2~~ | ~~VN 标配功能：存档 / 读档 / 回想 / 设置~~ ✅ |
| ~~3~~ | ~~前端优化：排版层级、动效节奏、移动端手感、无障碍~~ ✅ |
| ~~4~~ | ~~人设档案（从群聊记录分析报告提炼，存放于 `docs/persona/`，**已 gitignore**）~~ ✅ |
| ~~5~~ | ~~台词修订：按人设档案统一各角色口癖，并补全上述死内容~~ ✅ |

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
