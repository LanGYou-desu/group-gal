# 😂群聊 · 全群攻陷计划

把真实 QQ 音游群二创成 galgame 的同人作品。你作为第 81 位群友入群，在一群嘴硬心软的人中间选择怎么说话。

Vite + TypeScript 写成，剧本数据与引擎分离：`src/engine/` 零 DOM 依赖，全部副作用经注入的 `Renderer` 接口发生，因此**整张剧情图可以被无头测试**。附带一个剧本图校验器，剧本写坏则构建失败。

构建产物是**自包含单文件**（`dist/index.html`），双击即玩、离线可玩、可直接发给别人。

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
> 想立刻玩：用上面那个 Pages 链接，或从 Release 下载单文件，双击即玩。

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

## 剧本与验证

**剧本图校验器**（`npm run check:script`，也是 `npm run build` 的前置步骤）拦住：`goto` 指向不存在的 label、角色键拼错、Bad End 缺文本、label 重复、终止节点之后的死节点、设置了但从未被读取的标记。当前输出 **206 个节点 / 0 错误 / 0 警告**。

**自动化剧本走查**（`tests/equivalence/walkthrough.test.ts`）：用固定的选项序列跑完整张图，比对渲染序列快照。覆盖完整通关、全部即时 BE 分叉、蘑菇汤线三分支，以及 BE23 / BE24 的分叉。

**逐字抽查**（`tests/chapters*.test.ts`）：守住台词与人设口癖。

引擎与 DOM 解耦带来的一个直接好处：**剧情分支可以被无头跑通**，不需要浏览器。

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
