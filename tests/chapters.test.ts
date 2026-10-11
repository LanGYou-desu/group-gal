import { describe, expect, it } from 'vitest';
import { PROLOGUE } from '../src/content/chapters/prologue';
import { CH1 } from '../src/content/chapters/ch1';
import { CHARS } from '../src/content/characters';
import type { Node } from '../src/engine/types';

const says = (script: readonly Node[]) =>
  script.filter(n => n.kind === 'say').map(n => (n as { text: string }).text);

describe('序章（源 :331-349）', () => {
  it('以 start 标签开头', () => {
    expect(PROLOGUE[0]).toEqual({ kind: 'label', name: 'start' });
  });

  it('节点数为 14', () => {
    expect(PROLOGUE).toHaveLength(14);
  });

  it('开场有恰好三条「新人？」（复读梗）', () => {
    expect(says(PROLOGUE).filter(t => t === '新人？')).toHaveLength(3);
  });

  it('首个 choice 有 4 个选项，且全部指向 intro_done', () => {
    const c = PROLOGUE.find(n => n.kind === 'choice');
    if (c?.kind !== 'choice') throw new Error('未找到 choice 节点');
    expect(c.prompt).toBe('说点什么');
    expect(c.options).toHaveLength(4);
    for (const o of c.options) expect(o.goto).toBe('intro_done');
  });

  it('第四个选项的 say 是猫猫头（与 t 不同）', () => {
    const c = PROLOGUE.find(n => n.kind === 'choice');
    if (c?.kind !== 'choice') throw new Error('unreachable');
    expect(c.options[3]).toEqual({
      label: '发个猫猫头', say: '🐱', eff: { cat: 1, nanao: 1 }, goto: 'intro_done',
    });
  });

  it('文案与源文件逐字一致（抽查）', () => {
    expect(PROLOGUE[1]).toEqual({ kind: 'sys', text: '「根哥」把你拉进了群聊 😂群聊' });
    expect(PROLOGUE[2]).toEqual({ kind: 'sys', text: '群成员 80 → 81' });
    expect(PROLOGUE[3]).toEqual({
      kind: 'note', text: '你还没来得及打招呼，屏幕已经被刷屏淹没了。',
    });
    expect(PROLOGUE[4]).toEqual({ kind: 'say', who: 'gen', text: '@全体成员 来活人了 都收着点' });
    expect(PROLOGUE[12]).toEqual({
      kind: 'say', who: 'nanao', text: '先说明 这儿嘴上没把门的 别玻璃心',
    });
    expect(PROLOGUE[13]!.kind).toBe('choice');
  });
});

describe('第一章（源 :351-425）', () => {
  it('以 intro_done 标签开头', () => {
    expect(CH1[0]).toEqual({ kind: 'label', name: 'intro_done' });
  });

  it('节点数为 45', () => {
    expect(CH1).toHaveLength(45);
  });

  it('以跳转 hub 收尾', () => {
    expect(CH1.at(-1)).toEqual({ kind: 'goto', label: 'hub' });
  });

  it('含 6 个 choice 节点', () => {
    expect(CH1.filter(n => n.kind === 'choice')).toHaveLength(6);
  });

  it('含 2 处 bgm 切换（night → chat）', () => {
    expect(CH1.filter(n => n.kind === 'bgm')).toEqual([
      { kind: 'bgm', track: 'night' },
      { kind: 'bgm', track: 'chat' },
    ]);
  });

  it('三个 BE 分叉指向 BE01 / BE05 / BE02', () => {
    const targets = CH1
      .filter((n): n is Extract<Node, { kind: 'choice' }> => n.kind === 'choice')
      .flatMap(n => n.options.map(o => o.goto));
    expect(targets).toContain('BE01');
    expect(targets).toContain('BE05');
    expect(targets).toContain('BE02');
  });

  it('sheiTrap 标记在誰的选项里被设置', () => {
    const c = CH1.filter(n => n.kind === 'choice').at(-1);
    if (c?.kind !== 'choice') throw new Error('unreachable');
    expect(c.options[2]).toEqual({
      label: '行啊 我愿意当你的攻略对象', set: 'sheiTrap', eff: { shei: 1 }, goto: 'ch1f',
    });
  });

  it('文案与源文件逐字一致（抽查）', () => {
    expect(says(CH1)).toContain('群主先别解散 我把那首谱写完就来');
    expect(says(CH1)).toContain('信这个真实消息 不如信我是男娘');
    expect(says(CH1)).toContain('我已经在攻略你们了 你是我的第七个存档');
    expect(CH1).toContainEqual({ kind: 'sys', text: '时间跳到 00:47' });
    expect(CH1).toContainEqual({ kind: 'note', text: '—— 群友情报 · 解锁 ——' });
    expect(CH1).toContainEqual({ kind: 'note', text: '—— 第二章 · 群里的日常 ——' });
  });
});

describe('序章与第一章 — 通用约束', () => {
  it('所有节点引用的角色键都存在于 CHARS', () => {
    for (const n of [...PROLOGUE, ...CH1]) {
      const who = n.kind === 'say' ? n.who : n.kind === 'card' ? n.who : null;
      if (who && who !== 'me') expect(CHARS[who], `节点引用 ${who}`).toBeDefined();
    }
  });

  it('不存在遗留的数组式节点（全部已转成判别联合）', () => {
    for (const n of [...PROLOGUE, ...CH1]) {
      expect(Array.isArray(n), JSON.stringify(n)).toBe(false);
      expect(typeof n.kind).toBe('string');
    }
  });

  it('所有 eff 的角色键都是合法的 CharKey', () => {
    const choices = [...PROLOGUE, ...CH1].filter(n => n.kind === 'choice');
    for (const c of choices) {
      if (c.kind !== 'choice') continue;
      for (const o of c.options) {
        for (const k of Object.keys(o.eff ?? {})) {
          expect(CHARS[k as keyof typeof CHARS], `eff 键 ${k}`).toBeDefined();
        }
      }
    }
  });
});
