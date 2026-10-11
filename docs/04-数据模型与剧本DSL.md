# 04 · 数据模型与剧本 DSL

> 以 [group-chat-galgame-v1.html](../group-chat-galgame-v1.html) 的格式为准；文末对照 v0.2 与素材文件格式。

## 1. 角色元数据 `CH`

```js
const CH = {
  naoqi:{n:"闹七",e:"🐺",c:"#ff5d73",h:"long",  sub:"Null7 · 群主 / 服主 / 知名谱师"},
  ...
  you  :{n:"我",e:"🙂",c:"#7d8fa8",h:"short",sub:"普通大学生"}
};
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `n` | string | 群昵称（气泡、名字牌、结局卡使用） |
| `e` | string | 头像 emoji（气泡头像、抽屉、名字牌） |
| `c` | string | 主题色（头像边框、名字颜色、立绘填充） |
| `h` | string | 发型变体 key，对应 `HAIR` 表（`long/side/spike/wolf/bun/braid/hood/hood2/cat/ghost/tail/tail2/short/cap/short2`） |
| `sub` | string | 群名片/人设一行说明（抽屉专用，源自 `report.pdf` 与聊天记录） |

**全部 18 位角色**（含玩家）：

| key | 昵称 | 人设（`sub`） | 是否可攻略 |
|-----|------|--------------|-----------|
| `naoqi` | 闹七 | Null7 · 群主 / 服主 / 知名谱师 | ✅ 主线 |
| `fish` | 一条鱼 | 机械动力工厂主 | ✅ |
| `g` | G | Lriltu | ✅ |
| `suan` | 石蒜 | 注意不是 taffy | ✅ |
| `tttt` | tttt | 审计席冷面鉴定官 | ✅ |
| `dan` | 蛋蛋 | 又名「誰」 | ✅ |
| `gen` | 根哥 | Unity 实训开发 | ✅ |
| `aka` | aka | 渠道女王 | ✅ |
| `mian` | 面包 | 盘的速 · 键鼠交互 | ✅ |
| `n305` | 30586 | V 我 50 | ✅ |
| `butter` | 黄油猫 | 黄段子永动机 · 隐藏女主（DAY5 解锁） | ✅ 隐藏 |
| `obra` | Obra Dinn | 幽灵成员 | ✅ |
| `lusi` | 露丝 | 攒钱战士 | ✅ |
| `liuli` | 墨染琉璃 | 全群唯一正常人 | ✅ |
| `ban` | 石斑鱼 | 🪨🦓🐟 | ✅ |
| `taffy` | taffy | 看我落地水！ | ✖ 配角 |
| `moku` | 蘑菇汤 | 藤原氏 · 群规挑战者 | ✖ 反派（际遇章） |
| `you` | 我 | 普通大学生 | — 玩家 |

## 2. 剧本节点 `NODES`

每个节点是一个对象，键为节点 id（字符串）。**节点类型由出现的字段组合决定**，无独立 `type` 字段。

### 2.1 字段总表

| 字段 | 类型 | 说明 |
|------|------|------|
| `m` | `"chat"` \| `"avg"` | 呈现模式。chat=手机群聊界面；avg=立绘+背景+对话框。缺省按 chat 处理（`node.m==="chat"` 判断） |
| `b` | `[key, text][]` | **chat 模式台词**。`key` 为角色 key；`"#"` 表示系统提示行（居中胶囊，不占阅读停顿） |
| `l` | `[key\|null, text][]` | **AVG 模式台词**。`null` 为旁白（灰字）；`"#"` 也按旁白处理 |
| `o` | `[text, goto, fx?][]` | **选项**。三项数组：按钮文字、跳转目标、可选的加成 `fx` |
| `next` | string | 播完后跳转的下一节点（无 `o`/非 branch 时显示「点击继续 ▼」） |
| `fx` | object | **节点级**加成（进入节点即结算一次，受 `fxDone` 保护） |
| `bg` | string | AVG 背景（`room/lab/arcade/dusk/night/mc/fest/white`，对应 CSS `.bg-*`） |
| `bgm` | string | 切换 BGM 曲目（`title/daily/night/tense/end`） |
| `d` | string | 顶栏"日签"文案（如 `DAY 3`、`闹七线`） |
| `c` | string\|null | 指定立绘角色 key；`null`=无立绘；缺省时自动取本句说话人 |
| `j` | `"branch"` | 特殊节点：播完后执行分岔判定（第 7 日 `d7b` 专用） |

### 2.2 加成 `fx` 结构

```js
{a:{naoqi:2,fish:1},   // 羁绊：角色 key → 增减值（支持负值）
 s:{z:2,r:1},          // 资质：z 真诚 / r 嘴臭 / m 卖弱 / q 空気（顶栏闪烁）
 f:"butterUnlocked"}   // 剧情 flag：置 true
```

### 2.3 最小写法示例

```js
// 聊天三连 + 选项
d1a:{m:"chat",d:"DAY 1",
 b:[["#","你被拉入群组「😂群聊」"],
    ["naoqi","新人！！！"],
    ["g","草 新人快跑"]],
 o:[["「……谁？」","d1_b1",{a:{dan:2},s:{z:1}}],
    ["（沉默是金，先观察）","d1_b3",{s:{q:1}}]]},

// AVG 独白节点
d4_a4:{m:"avg",bg:"arcade",c:"ban",
 l:[[null,"怪猎集会所的角落..."],
    ["ban","……下位二油，来一个吗。0 氪。"]],
 next:"d4z"},

// 结局跳转（协议字符串）
d5_x:{m:"avg",bg:"dusk",c:"butter", l:[...], next:"__end_adult"},
```

### 2.4 跳转目标协议

| 目标写法 | 含义 |
|---------|------|
| `"d1c"` 等 id | 普通节点 |
| `"__end_<key>"` | 直接进入坏结局卡（`ENDINGS[key]`），如 `__end_nq1` |
| `"__ge_<key>"` | 直接进入好结局卡（`NODES["ge_"+key]`），如 `__ge_naoqi`（一般由角色线末尾使用） |

### 2.5 节点分区（主版本 131 个节点）

| 分区 | 前缀/示例 | 说明 |
|------|----------|------|
| 序章 | `start` | 被拉进群 |
| 共通线七日 | `d1a~d1z` … `d7a/d7b` | DAY2「弱音潮」、DAY3「零分与辈分」、DAY4「深夜故事会」、DAY5「群名片真相」、DAY6「方块开服日」 |
| 蘑菇汤际遇 | `mx1/mx2` | DAY6 深夜，群规挑战者登场（完整版新增） |
| 15 条角色线 | `r_nq*/r_f*/r_g*/r_s*/r_t*/r_d*/r_gen*/r_aka*/r_m*/r_305*/r_b*/r_o*/r_lusi*/r_liuli*/r_ban*` | 每条线 2~4 个节点，末尾收束到 `__ge_*` 或 `__end_*` |
| GE 小剧场 | `ge_<key>` × 15 | 好结局卡引用的尾声文本（末条旁白作为卡面摘要） |

## 3. 结局系统

```js
const ENDINGS = {  // 23 个坏结局（完整版）：key -> {name, who, desc}
  nq1:{name:"禁言刑 END",who:"闹七",desc:"..."},
  ..., 
  moku1:{name:"被挂 END",who:"蘑菇汤",...}, moku2:{...},
  adult:{name:"成年话题 END",who:"黄油猫",...},
  fz:{name:"刷屏禁言 END",who:"群规",...},
  pass:{name:"第 81 人 END",who:"全群",...}
};
const GE_SLOTS = ["naoqi","fish","g","suan","tttt","dan","gen","aka","mian","n305","butter","obra","lusi","liuli","ban"]; // 15 个 GE 槽位
```

**23 个 BE 一览**（归属 → 名称 → 触发点）：

| who | name | 触发 |
|-----|------|------|
| 闹七 | 禁言刑 END / 解散式 END | 闹七线 `r_nqf` 两个错误选项 |
| 一条鱼 | 已读不回 / 群名片战争 | 鱼线 `r_f3`、`r_ff` |
| G | 亲子鉴定败诉 / 多出来的爹 | G 线 `r_g3`、`r_gf` |
| 石蒜 | 庶流出奔 / 认错人 | 石蒜线 `r_s3`、`r_sf` |
| tttt | 零分评价 / 全麦误会 | tttt 线 `r_t3`、`r_tf` |
| 蛋蛋 | Token 破产 / 精灵代餐 | 蛋蛋线 `r_d3` |
| 根哥 | 编译错误 END | 根哥线 `r_gen1`、`r_gen3` |
| aka | 渠道断裂 END | aka 线 `r_aka1` |
| 面包 | 图片无法显示 END | 面包线 `r_m1` |
| 30586 | 活动取消 END | 30586 线 `r_3051` |
| 黄油猫 | 永恒旋转 END | 黄油猫线 `r_b1` |
| Obra Dinn | 无人赴会 END | Obra 线 `r_o1` |
| 蘑菇汤 | 被挂 / 同化 END | 际遇章 `mx1` 前两个选项 |
| 黄油猫 | 成年话题 END | DAY5 `d5a` 讲黄段子 |
| 群规 | 刷屏禁言 END | 复读同一句 3 次 |
| 全群 | 第 81 人 END | 第 7 日「空気」≥3 |

## 4. 全局状态对象 `S`

字段表见 [03-核心引擎与关键函数 §4](./03-核心引擎与关键函数.md#4-状态与存档)。要点：羁绊在 `S.a`、资质在 `S.s`、剧情 flag 在 `S.f`、回收进度在 `S.unlocked`、分岔快照在 `S.cp`。

## 5. v0.2 数据格式对照（`group-chat-galgame.html`）

| 概念 | v0.2 | 主版本 |
|------|------|--------|
| 角色 | `CHARS`（14 位，含 `hero` 标记；`shape` 决定立绘配件） | `CH`（18 位，`h` 发型变体） |
| 剧本 | `S` 数组（185 行），首元素为节点类型标签 | `NODES` 对象（131 节点），字段驱动 |
| 节点类型 | `label/msg/sys/note/card/choice/hub/jump/bgm/aff/set/be/ending` | 由 `m/b/l/o/next/j` 组合表达 |
| 分支 | `hub` 节点（`once` 选项去重） | `j:"branch"` + `pickRoute()` |
| 坏结局 | `BEDATA`（9 条 `{tag,title,text}`） | `ENDINGS`（23 条 `{name,who,desc}`） |
| 好结局 | `ENDING`（7 条路线序章） | `NODES.ge_*`（15 条完整 GE） |
| 播放 | `async play()` + `await wait(ms)` | `phase` 状态机 + 定时器令牌 |
| 状态 | `state={aff,flags,water,members,hub,lastRepeat,repeatN}`（不持久） | `S`（localStorage 持久化） |

## 6. 素材文件格式（`members.zip` 内 52 个 `.md`）

```markdown
# 群名片或昵称 (QQ号)

群名片 xxx · 角色 owner/admin/member/bot · N 条
10-08 14:33 ~ 10-10 23:27

- `10-08 14:33`  消息文本
- `10-08 14:37`  [图片](https://multimedia.nt.qq.com.cn/...) ……
- `10-08 15:05`  ↳ 回复 某人：回复内容
- `10-08 15:29`  [合并转发]
- `10-08 18:53`  [表情 {'faceIndex': 76, ...}]
```

要点：①文件名即 QQ 号，同名成员用"曾用名/现用名"归并；②图片带腾讯多媒体直链但**游戏不引用**；③时间精确到分钟，同一分钟相同内容会被归档合并；④角色字段区分 owner/admin/member/bot，是报告分层与游戏"权力结构"设定的依据。