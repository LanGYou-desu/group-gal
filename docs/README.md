# Code Wiki · group-gal

> 《😂群聊攻略录》—— 基于真实 QQ 群聊记录与成员画像报告改编的 **单文件离线 Galgame**。
> 本 Wiki 覆盖仓库全部资产：两个版本的游戏 HTML、成员聊天记录、分析报告，以及合并后的 **v1.0 完整版**。

---

## 1. 项目一句话

把 5,325 条 QQ 群聊记录（52 名发言者 / 80 人名册）与一份成员画像分析报告，改写成一款
**双击即玩、无需联网、零外部依赖**的聊天流 Galgame：共通线「入群七日」→ 15 条角色线 → 23 个坏结局。

## 2. 文档地图

| # | 文档 | 内容 |
|---|------|------|
| 01 | [项目总览](./01-项目总览.md) | 项目定位、仓库文件清单、三个 HTML 版本的关系、快速开始 |
| 02 | [整体架构](./02-整体架构.md) | 五层架构（数据/剧本/引擎/渲染/音频）、模块职责、数据流、两版架构对比 |
| 03 | [核心引擎与关键函数](./03-核心引擎与关键函数.md) | 阶段状态机、节点播放循环、打字机、分支判定、结局卡、存档、音频引擎、函数速查表 |
| 04 | [数据模型与剧本 DSL](./04-数据模型与剧本DSL.md) | 角色元数据 CH、剧本节点 NODES、结局表、状态对象 S、两版数据格式对照、成员记录格式 |
| 05 | [依赖关系与运行方式](./05-依赖关系与运行方式.md) | 运行时/开发依赖、三种运行方式、键位表、校验脚本、常见问题 |
| 06 | [参考素材与内容管线](./06-参考素材与内容管线.md) | members.zip / report.pdf 解读、角色映射表、群文化 → 游戏机制映射、内容生产流程 |
| 07 | [版本对比与 v1.0 合并说明](./07-版本对比与v1.0合并说明.md) | v0.2 / 豆包版 / 完整版对比、移植清单、修复的 3 个缺陷、结局总表 |

## 3. 仓库文件一览

```
/workspace
├── README.md                      # 仓库根说明（指向本 Wiki）
├── group-chat-galgame.html        # 版本一：v0.2 可玩 Demo（907 行）
├── 啥子豆包版本.html               # 版本二：豆包版 v1.0（1741 行）
├── group-chat-galgame-v1.html     # v1.0 合并版（1911 行，豆包剧情为底 + 机制合并）
├── group-chat-galgame-v2.html     # ★ v2.0 完整版（1975 行，剧情全部重写）
├── members.zip                    # 52 份按 QQ 号归档的群聊记录（原始导出）
├── dialogues/                     # 按人拆分后的对话集（52 个 <昵称>_<QQ>.md + INDEX.md）
├── report.pdf                     # 两批群聊记录综合分析报告（23 页）
├── skills/
│   ├── immortal-skill/            # 数字永生框架（vendored：SKILL.md / personas / prompts / recipes / kit）
│   └── immortals/                 # ★ 20 位群友的人设包（SKILL.md + 三维度 + conflicts + manifest）
│       ├── README.md              # 人设档案室索引
│       └── _evidence/             # 蒸馏用「语料摘要」（工作材料）
├── tools/
│   ├── validate.js                # 剧本完整性 + 全路线可达性校验（node，零依赖）
│   ├── smoke-test.js              # jsdom 端到端冒烟测试（可选，需 jsdom）
│   ├── split-dialogues.py         # members.zip → dialogues/ 按人拆分脚本
│   ├── mine-persona-evidence.py   # dialogues/ → _evidence/ 语料摘要（高频短语/主题/互动）
│   ├── verify-personas.py         # 人设包质检（结构 / 证据纪律 / 引文真实性 / 脱敏）
│   └── audit-quotes.py            # 引文来源审计（省略号分段核验，0 风险为准）
└── docs/                          # 本 Code Wiki
```

## 4. 快速开始

| 我想… | 怎么做 |
|-------|--------|
| 直接玩 | 双击 `group-chat-galgame-v2.html`（或任意版本 HTML），浏览器打开即玩，无需服务器 |
| 在本地服务器上玩 | `python3 -m http.server 8931` → 访问 `http://localhost:8931/group-chat-galgame-v2.html` |
| 看游戏怎么实现 | 先读 [02-整体架构](./02-整体架构.md)，再读 [03-核心引擎与关键函数](./03-核心引擎与关键函数.md) |
| 写新剧情 | 读 [04-数据模型与剧本 DSL](./04-数据模型与剧本DSL.md) 的「节点速查」一节 |
| 校验剧本修改没写坏 | `node tools/validate.js`（脚本与说明见 [05-依赖关系与运行方式](./05-依赖关系与运行方式.md#6-剧本校验脚本)） |
| 跑一遍端到端冒烟 | `npm i -D jsdom && node tools/smoke-test.js`（覆盖分岔/通关/复读/抽屉/回收室/hub 支线） |
| 看群友人设档案 | [skills/immortals/README.md](../skills/immortals/README.md)（20 位群友的语料蒸馏人设包） |
| 复制一位群友来对戏 | 把 `skills/immortals/<slug>/` 放进 agent 技能目录，或直接投喂 `SKILL.md` + 维度文件 |

## 5. 版本速查

| 版本 | 文件 | 引擎特征 | 剧本来源 | 结局 |
|------|------|---------|---------|------|
| v0.2 Demo | `group-chat-galgame.html` | 数组剧本 + async 线性播放；复读/水群值/成员抽屉 | 原作 | 7 线序章 + 9 BE |
| 豆包版 v1.0 | `啥子豆包版本.html` | 节点图 + 打字机 + 手动/自动 + 存档 + 回收室 | 豆包创作（含 3 处缺陷） | 15 线 + 18 BE |
| v1.0 合并版 | `group-chat-galgame-v1.html` | 豆包版引擎 + v0.2 机制合并 + 全缺陷修复 | 豆包剧情为底 | 15 线 + 23 BE |
| **v2.0 完整版** | `group-chat-galgame-v2.html` | v1 引擎 + hub 一次性支线 + 配件立绘 | **全部重写**（v0.2 世界观 + 真实语料；零引用豆包台词） | **15 线 + 23 BE（全可达）** |