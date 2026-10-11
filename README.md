# group-gal

😂😂😂😂😂😂

把两批真实 QQ 群聊记录（`members.zip`，5,325 条 / 52 名发言者）与一份成员画像分析报告（`report.pdf`）
改编成的**单文件离线 Galgame**：《全员问题儿童！😂群聊攻略录》。

## 快速开始

```bash
# 直接双击打开即可玩（无需服务器）：
#   group-chat-galgame-v1.html

# 或起本地服务器：
python3 -m http.server 8931   # → http://localhost:8931/group-chat-galgame-v1.html
```

- 共通线「入群七日」→ 15 条角色线 → **23 个坏结局 + 15 个好结局**，全部可回收
- 玩法：点击 / 空格推进，`A` 自动播放，`S` 文字速度，`Esc` 关闭弹窗；顶栏可看「群成员羁绊」与「复读」彩蛋

## 文件

| 文件 | 说明 |
|------|------|
| `group-chat-galgame-v1.html` | ★ v1.0 完整版（两版合并 + 缺陷修复） |
| `group-chat-galgame.html` | 版本一：v0.2 可玩 Demo |
| `啥子豆包版本.html` | 版本二：豆包版 v1.0 |
| `members.zip` / `report.pdf` | 群聊记录 / 综合分析报告 |
| `docs/` | Code Wiki（架构、引擎、剧本 DSL、运行方式、素材管线、版本合并说明） |
| `tools/validate.js` | 剧本完整性 + 全路线可达性校验（`node tools/validate.js`，零依赖） |
| `tools/smoke-test.js` | jsdom 端到端冒烟测试（`npm i -D jsdom && node tools/smoke-test.js`） |

> 所有角色均为基于群聊行为特征的二次虚构，与现实人物无关。