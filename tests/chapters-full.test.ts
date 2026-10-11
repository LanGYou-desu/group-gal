import { describe, expect, it } from 'vitest';
import { LABELS, SCRIPT } from '../src/content/chapters';
import { validateScript } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import type { Node } from '../src/engine/types';

const issues = validateScript(SCRIPT, CHARS, BEDATA);
const errors = issues.filter(i => i.level === 'error');
const warns = issues.filter(i => i.level === 'warn');

describe('全剧本 — 校验', () => {
  it('无校验错误', () => {
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it('不可达的恰好是 BE19 / BE20 / BE24 三组死节点（源文件里就是死代码）', () => {
    const unreachable = warns.filter(i => i.code === 'unreachable');
    expect(unreachable).toHaveLength(6);

    const nodes = unreachable.map(i => SCRIPT[i.index!]!);
    const names = nodes
      .filter((n): n is Extract<Node, { kind: 'label' }> => n.kind === 'label')
      .map(n => n.name);
    expect(names.sort()).toEqual(['BE19', 'BE20', 'BE24']);
    expect(nodes.filter(n => n.kind === 'be')).toHaveLength(3);

    // 原因：s_moku 的 a/b 分支用内联 be 节点终止，BE24 只由 main.ts 的复读逻辑直接触发，
    // 三者的标签从未被任何 goto 引用。保留原样以维持与源文件的等价性。
  });

  it('唯一另一类警告是「设置了但从未读取」的标记', () => {
    const others = warns.filter(i => i.code !== 'unreachable');
    expect(others.every(i => i.code === 'flag-unused')).toBe(true);
    const flags = others.map(i => i.message.split('：')[1]).sort();
    expect(flags).toEqual(['mokuJoin', 'sheiTrap']);
  });
});

describe('全剧本 — 规模', () => {
  it('共 185 个节点', () => {
    expect(SCRIPT).toHaveLength(185);
  });

  it('共 34 个 label', () => {
    expect(Object.keys(LABELS)).toHaveLength(34);
  });

  it('16 个 choice 节点', () => {
    expect(SCRIPT.filter(n => n.kind === 'choice')).toHaveLength(16);
  });

  it('恰好 1 个 hub 与 1 个 ending', () => {
    expect(SCRIPT.filter(n => n.kind === 'hub')).toHaveLength(1);
    expect(SCRIPT.filter(n => n.kind === 'ending')).toHaveLength(1);
  });

  it('节点数与现状源文件的节点数一致', () => {
    // 源文件 S 数组：序章 14 + 第一章 45 + 支线 92 + 第三章与结局标签 34
    expect(SCRIPT).toHaveLength(14 + 45 + 92 + 34);
  });
});

describe('全剧本 — 起点与结局', () => {
  it('start 位于第 0 个节点', () => {
    expect(LABELS['start']).toBe(0);
    expect(SCRIPT[0]).toEqual({ kind: 'label', name: 'start' });
  });

  it('7 个 BE 标签全部存在且有对应 be 节点', () => {
    for (const id of ['BE01', 'BE02', 'BE05', 'BE17', 'BE19', 'BE20', 'BE24']) {
      expect(LABELS[id], `缺少 label ${id}`).toBeDefined();
      expect(SCRIPT.some(n => n.kind === 'be' && n.id === id), `缺少 be 节点 ${id}`).toBe(true);
    }
  });

  it('BE10 与 BE23 不在剧本里（只由结局判定触发）', () => {
    expect(LABELS['BE10']).toBeUndefined();
    expect(LABELS['BE23']).toBeUndefined();
    expect(SCRIPT.some(n => n.kind === 'be' && (n.id === 'BE10' || n.id === 'BE23'))).toBe(false);
  });

  it('结局标签区的 7 组 label+be 结构完整', () => {
    const tail = SCRIPT.slice(-14);
    for (let i = 0; i < 14; i += 2) {
      const label = tail[i]!;
      const be = tail[i + 1]!;
      expect(label.kind).toBe('label');
      expect(be.kind).toBe('be');
      expect((be as Extract<Node, { kind: 'be' }>).id).toBe(
        (label as Extract<Node, { kind: 'label' }>).name,
      );
    }
  });

  it('剧本以 ending 之前的 note 收束（第三章结尾）', () => {
    const idx = SCRIPT.findIndex(n => n.kind === 'ending');
    expect(SCRIPT[idx - 1]).toEqual({ kind: 'note', text: '闹七第一次没有说 我很伤心。' });
  });
});

describe('全剧本 — 拼装顺序', () => {
  it('顺序为 序章 → 第一章 → 支线 → 第三章', () => {
    expect(LABELS['start']).toBeLessThan(LABELS['intro_done']!);
    expect(LABELS['intro_done']).toBeLessThan(LABELS['hub']!);
    expect(LABELS['hub']).toBeLessThan(LABELS['ch3']!);
  });

  it('所有 goto 目标都能解析（校验器的核心保证）', () => {
    const bad: string[] = [];
    for (const n of SCRIPT) {
      const targets = n.kind === 'goto' ? [n.label]
        : n.kind === 'choice' || n.kind === 'hub' ? n.options.map(o => o.goto)
        : [];
      for (const t of targets) if (!(t in LABELS)) bad.push(t);
    }
    expect(bad).toEqual([]);
  });
});
