import type { Script } from '../../engine/types';

/** 逐字搬运自 group-chat-galgame.html:331-349。 */
export const PROLOGUE: Script = [
  { kind: 'label', name: 'start' },
  { kind: 'sys', text: '「根哥」把你拉进了群聊 😂群聊' },
  { kind: 'sys', text: '群成员 80 → 81' },
  { kind: 'note', text: '你还没来得及打招呼，屏幕已经被刷屏淹没了。' },
  { kind: 'say', who: 'gen', text: '@全体成员 来活人了 都收着点' },
  { kind: 'say', who: 'tttt', text: '新人？' },
  { kind: 'say', who: 'shisuan', text: '新人？' },
  { kind: 'say', who: 'yu', text: '新人？' },
  { kind: 'say', who: 'tttt', text: '复读机是吧' },
  { kind: 'say', who: 'cat', text: '行了行了 别把新人吓跑了' },
  { kind: 'say', who: 'g', text: '稀奇 这破群仨月没进过人了' },
  { kind: 'say', who: 'nanao', text: '来了个新的' },
  { kind: 'say', who: 'nanao', text: '先说明 这儿嘴上没把门的 别玻璃心' },
  { kind: 'choice', prompt: '说点什么', options: [
    { label: '音游萌新 求大佬带带', eff: { g: 1, shisuan: 1 }, goto: 'intro_done' },
    { label: '我 token 管够 谁要借号说话', eff: { nanao: 2, shei: 2 }, goto: 'intro_done' },
    { label: '打打 Arcaea 也就一菜鸡', eff: { nanao: 1, g: 1 }, goto: 'intro_done' },
    { label: '发个猫猫头', say: '🐱', eff: { cat: 1, nanao: 1 }, goto: 'intro_done' },
  ] },
];
