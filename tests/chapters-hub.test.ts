import { describe, expect, it } from 'vitest';
import { HUB } from '../src/content/chapters/hub';
import { CHARS } from '../src/content/characters';
import type { Node } from '../src/engine/types';

const labelAt = (name: string) => HUB.findIndex(n => n.kind === 'label' && n.name === name);
const choicesOf = (script: readonly Node[]) =>
  script.filter((n): n is Extract<Node, { kind: 'choice' }> => n.kind === 'choice');

describe('支线枢纽（源 :427-437）', () => {
  it('以 hub 标签开头', () => {
    expect(HUB[0]).toEqual({ kind: 'label', name: 'hub' });
  });

  it('有恰好 1 个 hub 节点，带 7 个选项', () => {
    const hubs = HUB.filter(n => n.kind === 'hub');
    expect(hubs).toHaveLength(1);
    if (hubs[0]?.kind !== 'hub') throw new Error('unreachable');
    expect(hubs[0].options).toHaveLength(7);
    expect(hubs[0].prompt).toBe('今晚去哪边混？');
  });

  it('hub 选项 id 与计划的稳定键映射表一致', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('unreachable');
    expect(h.options.map(o => o.id)).toEqual([
      's_mc', 's_arc', 's_chart', 's_food', 's_mh', 's_moku', 'main',
    ]);
  });

  it('6 条支线标了 once，主线没有', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('unreachable');
    for (const o of h.options) {
      if (o.id === 'main') expect(o.once, 'main 不应是 once').toBeUndefined();
      else expect(o.once, `${o.id} 应是 once`).toBe(true);
    }
  });

  it('hub 的 goto 目标与选项 id 对应一致', () => {
    const h = HUB.find(n => n.kind === 'hub');
    if (h?.kind !== 'hub') throw new Error('unreachable');
    for (const o of h.options) {
      if (o.id === 'main') expect(o.goto).toBe('ch3');
      else expect(o.goto).toBe(o.id);
    }
  });
});

describe('支线搬运 — 结构', () => {
  it('节点数为 92', () => {
    expect(HUB).toHaveLength(92);
  });

  it('含 8 个 choice 节点', () => {
    expect(choicesOf(HUB)).toHaveLength(8);
  });

  it('含 6 处 bgm 切换', () => {
    expect(HUB.filter(n => n.kind === 'bgm').map(n => (n as { track: string }).track))
      .toEqual(['chat', 'chat', 'night', 'chat', 'chat', 'tension']);
  });

  it('六条支线标签全部存在', () => {
    for (const l of ['s_mc', 's_arc', 's_chart', 's_food', 's_mh', 's_moku']) {
      expect(labelAt(l), `缺少 label ${l}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('五条支线以 jump hub 收尾（蘑菇汤线的 c 分支也是）', () => {
    for (const l of ['s_mc3', 's_arc3', 's_chart2', 's_food2', 's_mh2', 's_moku_c']) {
      const at = labelAt(l);
      const tail = HUB.slice(at).find(n => n.kind === 'goto' || n.kind === 'be');
      expect(tail, `${l} 缺少收尾跳转`).toEqual({ kind: 'goto', label: 'hub' });
    }
  });
});

describe('支线搬运 — 蘑菇汤线（唯一以 BE 终止的支线）', () => {
  it('a 分支以 BE19 终止', () => {
    const at = labelAt('s_moku_a');
    expect(HUB.slice(at, at + 3)).toEqual([
      { kind: 'label', name: 's_moku_a' },
      { kind: 'say', who: 'moku', text: '护着？你也一样 天真得可怜' },
      { kind: 'say', who: 'moku', text: '那我先拿你开刀吧' },
    ]);
    expect(HUB[at + 3]).toEqual({ kind: 'be', id: 'BE19' });
  });

  it('b 分支以 BE20 终止，且带一条旁白', () => {
    const at = labelAt('s_moku_b');
    expect(HUB[at + 3]).toEqual({
      kind: 'note', text: '你开始学着 TA 的语气说话。你比谁都清楚这样不对。',
    });
    expect(HUB[at + 4]).toEqual({ kind: 'be', id: 'BE20' });
  });

  it('b 分支的选项设置了 mokuJoin 标记', () => {
    const c = choicesOf(HUB).find(
      x => x.options.some(o => o.set === 'mokuJoin'),
    );
    expect(c).toBeDefined();
    expect(c!.options[1]).toEqual({
      label: '好像是有点 哈哈', set: 'mokuJoin', eff: { moku: 1 }, goto: 's_moku_b',
    });
  });

  it('c 分支回到 hub', () => {
    const at = labelAt('s_moku_c');
    // label(0) say(1) say(2) say(3) note(4) goto(5)
    expect(HUB[at + 4]).toEqual({
      kind: 'note', text: '蘑菇汤把你从仇人名单上划掉了。这在群里是个没人达成过的成就。',
    });
    expect(HUB[at + 5]).toEqual({ kind: 'goto', label: 'hub' });
  });
});

describe('支线搬运 — 通用约束', () => {
  it('所有引用的角色键都存在于 CHARS', () => {
    for (const n of HUB) {
      const who = n.kind === 'say' ? n.who : n.kind === 'card' ? n.who : null;
      if (who && who !== 'me') expect(CHARS[who], `节点引用 ${who}`).toBeDefined();
    }
  });

  it('所有 eff 的角色键都是合法的 CharKey', () => {
    for (const c of choicesOf(HUB)) {
      for (const o of c.options) {
        for (const k of Object.keys(o.eff ?? {})) {
          expect(CHARS[k as keyof typeof CHARS], `eff 键 ${k}`).toBeDefined();
        }
      }
    }
  });

  it('文案与源文件逐字一致（抽查）', () => {
    const texts = HUB.filter(n => n.kind === 'say').map(n => (n as { text: string }).text);
    expect(texts).toContain('看我落地水');
    expect(texts).toContain('何时 mc 我等一晚上上了');
    expect(texts).toContain('来打猎 我最近菜到神他妈牛逼了');
    expect(texts).toContain('有没有不用 token 不用吃饭也能帮我干活的');
    // 「写谱有啥意思 打游戏不香吗」是选项按钮文字，不是 say 节点
    expect(choicesOf(HUB).flatMap(c => c.options.map(o => o.label)))
      .toContain('写谱有啥意思 打游戏不香吗');
    expect(HUB).toContainEqual({ kind: 'sys', text: 'taffy 掉进了虚空' });
    expect(HUB).toContainEqual({
      kind: 'note', text: '蘑菇汤把你从仇人名单上划掉了。这在群里是个没人达成过的成就。',
    });
  });
});
