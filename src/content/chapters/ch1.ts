import type { Script } from '../../engine/types';

/** 逐字搬运自 group-chat-galgame.html:351-425。 */
export const CH1: Script = [
  { kind: 'label', name: 'intro_done' },
  { kind: 'say', who: 'nanao', text: '行 待着吧' },
  { kind: 'card', who: 'nanao' },
  { kind: 'say', who: 'nanao', text: '先说好 这周 MC 服开新地 谁不来我解散群' },
  { kind: 'say', who: 'yu', text: '我要挖矿 谁跟我搭机械动力' },
  { kind: 'say', who: 'cat', text: '我陪鱼' },
  { kind: 'choice', prompt: '怎么接', options: [
    { label: '我也来 顺便帮你把地铁修到矿区', eff: { nanao: 2, yu: 1 }, goto: 'ch1a' },
    { label: '我音游都打不过 还是别拖后腿了', eff: { nanao: -1, shei: 1 }, goto: 'ch1a' },
    { label: '你谁啊 凭什么命令我', goto: 'BE01' },
  ] },

  { kind: 'label', name: 'ch1a' },
  { kind: 'say', who: 'shisuan', text: '群主先别解散 我把那首谱写完就来' },
  { kind: 'say', who: 'g', text: '你那谱写了半年了吧' },
  { kind: 'say', who: 'shisuan', text: '快了快了' },
  { kind: 'note', text: '—— 群友情报 · 解锁 ——' },
  { kind: 'card', who: 'yu' },
  { kind: 'say', who: 'yu', text: '新人 你玩机械动力吗' },
  { kind: 'card', who: 'cat' },
  { kind: 'say', who: 'cat', text: '说清楚点 别带歪我家鱼' },
  { kind: 'choice', prompt: '怎么回', options: [
    { label: '玩的 我能给你搭个自动农场', eff: { yu: 2, cat: 1 }, goto: 'ch1b' },
    { label: '黄油猫姐姐好凶哦', eff: { cat: 2 }, goto: 'ch1b' },
    { label: '给你们讲个黄段子', goto: 'BE05' },
  ] },

  { kind: 'label', name: 'ch1b' },
  { kind: 'card', who: 'g' },
  { kind: 'say', who: 'g', text: '新谱 定数 12 谁打谁骂' },
  { kind: 'say', who: 'nanao', text: '发我看看' },
  { kind: 'say', who: 'g', text: '你先别抢我风头' },
  { kind: 'choice', prompt: '评价这张谱', options: [
    { label: '这个配置 尾杀肯定绝赞', eff: { g: 2, nanao: 1 }, goto: 'ch1c' },
    { label: '这谱不行 配置稀烂', goto: 'BE02' },
    { label: '我根本打不了 你们太强了', eff: { shei: 1 }, goto: 'ch1c' },
  ] },

  { kind: 'label', name: 'ch1c' },
  { kind: 'bgm', track: 'night' },
  { kind: 'sys', text: '时间跳到 00:47' },
  { kind: 'say', who: 'shisuan', text: '信这个真实消息 不如信我是男娘' },
  { kind: 'say', who: 'shisuan', text: '我的社交渠道 几乎全在这个群里了' },
  { kind: 'card', who: 'shisuan' },
  { kind: 'choice', prompt: '深夜 回石蒜', options: [
    { label: '那周末一起吃个饭吧 现实里的那种', eff: { shisuan: 2 }, goto: 'ch1d' },
    { label: '哈哈哈哈哈哈', eff: { shisuan: -1 }, goto: 'ch1d' },
    { label: '我也差不多 我社恐', eff: { shisuan: 1 }, goto: 'ch1d' },
  ] },

  { kind: 'label', name: 'ch1d' },
  { kind: 'bgm', track: 'chat' },
  { kind: 'card', who: 'tttt' },
  { kind: 'say', who: 'tttt', text: '面包是我的' },
  { kind: 'say', who: 'tttt', text: '允许你出了吗' },
  { kind: 'choice', prompt: 'Tttt 在护食', options: [
    { label: '面包分你一半', eff: { tttt: 2 }, goto: 'ch1e' },
    { label: '面包是谁啊', eff: { tttt: 0 }, goto: 'ch1e' },
    { label: '我偏要拿', goto: 'BE17' },
  ] },

  { kind: 'label', name: 'ch1e' },
  { kind: 'card', who: 'shei' },
  { kind: 'say', who: 'shei', text: '这破群我可以做成 galgame' },
  { kind: 'say', who: 'shei', text: '我已经在攻略你们了 你是我的第七个存档' },
  { kind: 'choice', prompt: '……', options: [
    { label: '那我反过来攻略你', eff: { shei: 2 }, goto: 'ch1f' },
    { label: '先观望一下', say: '…', eff: { shei: 1 }, goto: 'ch1f' },
    { label: '行啊 我愿意当你的攻略对象', set: 'sheiTrap', eff: { shei: 1 }, goto: 'ch1f' },
  ] },

  { kind: 'label', name: 'ch1f' },
  { kind: 'note', text: '—— 第二章 · 群里的日常 ——' },
  { kind: 'note', text: '白天上课 晚上开黑 你在群里混熟了几天。今晚 去哪边？' },
  { kind: 'goto', label: 'hub' },
];
