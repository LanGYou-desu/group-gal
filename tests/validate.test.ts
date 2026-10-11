import { describe, expect, it } from 'vitest';
import { buildLabelIndex, formatIssues, validateScript } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import type { Script } from '../src/engine/types';

const ok = (script: Script) => validateScript(script, CHARS, BEDATA);
const errors = (script: Script) => ok(script).filter(i => i.level === 'error');
const warns = (script: Script) => ok(script).filter(i => i.level === 'warn');

describe('label 索引', () => {
  it('收集全部 label 的位置', () => {
    const idx = buildLabelIndex([
      { kind: 'label', name: 'a' },
      { kind: 'say', who: 'yu', text: 'x' },
      { kind: 'label', name: 'b' },
    ]);
    expect(idx).toEqual({ a: 0, b: 2 });
  });
});

describe('剧本校验 — 跳转', () => {
  it('合法剧本无 error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'say', who: 'yu', text: 'hi' },
    ])).toEqual([]);
  });

  it('goto 目标不存在 → error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'goto', label: 'nope' },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'goto-unknown' }));
  });

  it('choice 与 hub 的 goto 同样被校验', () => {
    const issues = errors([
      { kind: 'label', name: 'start' },
      { kind: 'choice', prompt: 'p', options: [{ label: 'x', goto: 'nope' }] },
      { kind: 'hub', prompt: 'p', options: [{ id: 'i', label: 'y', goto: 'nope2' }] },
    ]);
    expect(issues.filter(i => i.code === 'goto-unknown')).toHaveLength(2);
  });
});

describe('剧本校验 — 引用完整性', () => {
  it('角色键不存在 → error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'say', who: 'nobody' as never, text: 'x' },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'char-unknown' }));
  });

  it('card 的角色键同样被校验', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'card', who: 'nobody' as never },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'char-unknown' }));
  });

  it('say 的 who 为 me 时不报错（玩家自己）', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'say', who: 'me', text: 'x' },
    ])).toEqual([]);
  });

  it('重复 label → error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'label', name: 'start' },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'label-duplicate' }));
  });

  it('BE 缺少文本 → error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'be', id: 'BE99' as never },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'be-unknown' }));
  });

  it('hub 选项 id 重复 → error', () => {
    expect(errors([
      { kind: 'label', name: 'start' },
      { kind: 'hub', prompt: 'p', options: [
        { id: 'dup', label: 'x', goto: 'start' },
        { id: 'dup', label: 'y', goto: 'start' },
      ] },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'hub-id-duplicate' }));
  });

  it('起始节点不是 start 标签 → error', () => {
    expect(errors([
      { kind: 'say', who: 'yu', text: 'x' },
      { kind: 'label', name: 'start' },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'start-not-first' }));
  });

  it('剧本缺少 start 标签 → error', () => {
    expect(errors([
      { kind: 'label', name: 'other' },
    ])).toContainEqual(expect.objectContaining({ level: 'error', code: 'start-missing' }));
  });
});

describe('剧本校验 — 可达性', () => {
  it('终止节点之后的节点不可达 → warn', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'ending' },
      { kind: 'say', who: 'yu', text: '永远不会播到' },
    ])).toContainEqual(expect.objectContaining({ level: 'warn', code: 'unreachable' }));
  });

  it('be 节点之后的节点同样不可达 → warn', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'be', id: 'BE01' },
      { kind: 'sys', text: '永远不会播到' },
    ])).toContainEqual(expect.objectContaining({ level: 'warn', code: 'unreachable' }));
  });

  it('被 goto 引用的标签是可达的，不误报', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'goto', label: 'target' },
      { kind: 'label', name: 'target' },
      { kind: 'ending' },
    ]).filter(i => i.code === 'unreachable')).toEqual([]);
  });

  it('顺序直落的节点不会误报', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'say', who: 'yu', text: 'a' },
      { kind: 'sys', text: 'b' },
      { kind: 'note', text: 'c' },
      { kind: 'ending' },
    ]).filter(i => i.code === 'unreachable')).toEqual([]);
  });
});

describe('剧本校验 — flag', () => {
  it('设置了但从未读取的 flag → warn', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'set', flag: 'sheiTrap' },
    ])).toContainEqual(expect.objectContaining({ level: 'warn', code: 'flag-unused' }));
  });

  it('actGood / actSkip 由引擎结局判定读取，不报 warn', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'set', flag: 'actGood' },
      { kind: 'set', flag: 'actSkip' },
    ]).filter(i => i.code === 'flag-unused')).toEqual([]);
  });

  it('选项里的 set 也计入', () => {
    expect(warns([
      { kind: 'label', name: 'start' },
      { kind: 'choice', prompt: 'p', options: [{ label: 'x', set: 'mokuJoin', goto: 'start' }] },
    ])).toContainEqual(expect.objectContaining({ level: 'warn', code: 'flag-unused' }));
  });
});

describe('报告格式化', () => {
  it('错误与警告前缀不同，且带节点位置', () => {
    const out = formatIssues([
      { level: 'error', code: 'goto-unknown', message: '目标不存在：x', index: 3 },
      { level: 'warn', code: 'unreachable', message: '节点不可达' },
    ]);
    expect(out).toContain('✗');
    expect(out).toContain('⚠');
    expect(out).toContain('（节点 #3）');
    expect(out).toContain('目标不存在：x');
  });
});
