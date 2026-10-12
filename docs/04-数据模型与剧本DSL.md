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
| `o` | `[text, goto, fx?, once?][]` | **选项**。按钮文字、跳转目标、可选加成 `fx`、可选一次性标记 `once`（v2 的支线 hub：做过的支线不再出现，见 §2.4） |
| `next` | string | 播完后跳转的下一节点（无 `o`/非 branch 时显示「点击继续 ▼」） |
| `fx` | object | **节点级**加成（进入节点即结算一次，受 `fxDone` 保护） |
| `bg` | string | AVG 背景（`room/lab/arcade/dusk/night/mc/fest/white`，对应 CSS `.bg-*`） |
| `bgm` | string | 切换 BGM 曲目（`title/daily/night/tense/end`） |
| `d` | string | 顶栏"日签"文案（如 `DAY 3`、`闹七线`） |
| `c` | string\|null | 指定立绘角色 key；`null`=无立绘；缺省时自动取本句说话人 |
| `j` | `"branch"` | 特殊节点：播完后执行分岔判定（v2 为 `e4`，v1 为 `d7b`） |
| `hub` | `true` | 标记该节点为「支线中枢」（v2 的 `hub` 节点）：选项中的 `once` 项可重复返回中枢、逐条消耗 |

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

### 2.4 支线 hub 与「一次性选项」（v2 新增）

```js
hub:{m:"chat",hub:true, d:"第二章 · 群日常",
 b:[["#","每个晚上，群里都有一件事正在发生——"]],
 o:[["🐟 一条鱼说要教我玩机械动力","s_mc1",null,"mc"],   // 第 4 位 "mc" = 一次性标记
    ["…（共 15 条支线）…","s_xxx1",null,"xxx"],
    ["▶ 不混了，推进主线","e1"]]},                         // 无标记 → 随时可推进
```

- 选项第 4 位是 `once` 键：点击后写入 `S.hubDone[key]=1` 并存档，之后 `showChoices()` 自动隐藏该项；
- 支线末尾统一 `next:"hub"` 返回中枢，因此可以自由安排体验顺序；
- 校验器（`tools/validate.js`）会把 hub 识别为「支线组」参与可达性搜索。

### 2.5 跳转目标协议

| 目标写法 | 含义 |
|---------|------|
| `"d1c"` 等 id | 普通节点 |
| `"__end_<key>"` | 直接进入坏结局卡（`ENDINGS[key]`），如 `__end_nq1` |
| `"__ge_<key>"` | 直接进入好结局卡（`NODES["ge_"+key]`），如 `__ge_naoqi`（一般由角色线末尾使用） |

### 2.6 节点分区

**v2.0 完整版（87 个节点）**：

| 分区 | 前缀/示例 | 说明 |
|------|----------|------|
| 序章 | `start` | 被根哥拉进群 |
| 第一章 新人报道 | `a1~a5` | 刷屏欢迎 / 群规三条 / 第一次选择 |
| 第二章 群日常 | `hub` + `s_*1/s_*2` ×15 | 支线中枢（一次性选项）+ 15 条支线 |
| 第三章 躲猫猫之夜 | `e1/e2a/e2x/e3` | 群活动（鸽了 → 我很伤心 BE） |
| 第四章 分岔 | `e4`（`j:"branch"`） | 按羁绊最高者进入角色线 |
| 15 条角色线 | `r_nao*/r_yu*/r_cat*/r_g*/r_ss*/r_t*/r_shei*/r_ban*/r_taf*/r_305*/r_bread*/r_mibu*/r_lin*/r_gen*/r_aka*` | 每条线 2 个节点，末尾收束到 `__ge_*` 或 `__end_*` |
| GE 小剧场 | `ge_<key>` × 15 | 好结局卡引用的尾声文本（末条旁白作为卡面摘要） |

**v1.0 合并版（131 个节点）**：`start` → `d1a…d7b`（入群七日）→ `mx1/mx2`（蘑菇汤际遇）→ 15 条角色线（`r_nq*/r_f*/…/r_ban*`）→ `ge_*`。两版节点命名不同，但引擎完全通用。

## 3. 结局系统

```js
const ENDINGS = {  // v2：23 个坏结局：key -> {name, who, desc}
  b01:{name:"老傻子 END",who:"全群",desc:"…"},      // 主线/群规类（沿用 v0.2 编号名）
  b02:{name:"越级骂谱 END",who:"G",…}, b05:{name:"成年话题 END",…},
  b10:{name:"我很伤心 END",…}, b17:{name:"面包没了 END",…},
  b19:{name:"被挂 END",…}, b20:{name:"同化 END",…},
  b24:{name:"刷屏 END",…}, b81:{name:"第 81 人 END",…},
  bn:{name:"群主辞职 END",who:"闹七",…},  by:{name:"3fps END",who:"一条鱼",…},
  bcat:{…}, bg:{…}, bss:{…}, bt:{…}, bshei:{…}, bban:{…}, btaf:{…},
  b305:{…}, bmibu:{…}, blin:{…}, bgen:{…}, baka:{…}   // 15 条角色线失败结局
};
const GE_SLOTS = ["nanao","yu","cat","g","shisuan","tttt","shei","shiban",
                  "taffy","c30586","mianbao","mibu","linxi","gen","aka"]; // 15 个 GE 槽位
```

**23 个 BE 触发点（v2）**：

| 触发位置 | 结局 |
|---------|------|
| 第一章 `a2` 顶撞群主（截图群主名片） | b01 老傻子 END |
| hub 支线「G 拼机」贬低谱面 | b02 越级骂谱 END |
| hub 支线「香骨鸡」讲黄段子 | b05 成年话题 END |
| 第三章 `e1` 鸽掉活动 | b10 我很伤心 END |
| hub 支线「蘑菇汤」替他说话 / 附和他 | b19 被挂 / b20 同化 END |
| 顶栏 📣 同一句复读 3 次 | b24 刷屏 END |
| 分岔时「空気」≥3 | b81 第 81 人 END |
| 15 条角色线各自的错误选项 | bn/by/bcat/bg/bss/bt/bshei/bban/btaf/b305/b17/bmibu/blin/bgen/baka |

> v1.0 合并版使用另一套 key（`nq1/f1/suan…`、`moku1/adult/fz/pass`），见 [07 §5](./07-版本对比与v1.0合并说明.md#5-v10-完整版结局总表23-be--15-ge)。

## 4. 全局状态对象 `S`

字段表见 [03-核心引擎与关键函数 §4](./03-核心引擎与关键函数.md#4-状态与存档)。要点：羁绊在 `S.a`、资质在 `S.s`、剧情 flag 在 `S.f`、节点级 fx 记账在 `S.fxDone`、支线一次性标记在 `S.hubDone`（v2）、回收进度在 `S.unlocked`、分岔快照在 `S.cp`。

## 5. v0.2 数据格式对照（`group-chat-galgame.html`）

| 概念 | v0.2 | v2.0 完整版 |
|------|------|------------|
| 角色 | `CHARS`（14 位，`hero` 标记；`shape` 决定立绘配件） | `CH`（17 位，`h` 配件键 + `ACC` 表） |
| 剧本 | `S` 数组（185 行），首元素为节点类型标签 | `NODES` 对象（87 节点），字段驱动 |
| 节点类型 | `label/msg/sys/note/card/choice/hub/jump/bgm/aff/set/be/ending` | 由 `m/b/l/o/next/j/hub` 组合表达 |
| 支线 hub | `hub` 节点（`once` 选项去重） | `hub:true` + 选项第 4 位 `once`（同一机制） |
| 分支 | —（按好感度选结局） | `j:"branch"` + `pickRoute()` |
| 坏结局 | `BEDATA`（9 条 `{tag,title,text}`） | `ENDINGS`（23 条 `{name,who,desc}`） |
| 好结局 | `ENDING`（7 条路线序章） | `NODES.ge_*`（15 条完整 GE） |
| 播放 | `async play()` + `await wait(ms)` | `phase` 状态机 + 定时器令牌 |
| 状态 | `state={aff,flags,water,...}`（不持久） | `S`（localStorage 持久化，键 `xqxq_gal_v2`） |

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