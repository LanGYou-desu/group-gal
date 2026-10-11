import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION, applyEff, applyRepeat, createInitialState, stageOf,
} from '../src/engine/effects';
import { CHARS, HERO_KEYS } from '../src/content/characters';
import type { Session } from '../src/engine/types';

describe('初始状态', () => {
  it('所有可攻略角色好感度为 0，其余字段为初始值', () => {
    const s = createInitialState();
    for (const k of HERO_KEYS) expect(s.aff[k], k).toBe(0);
    expect(s.water).toBe(0);
    expect(s.members).toBe(81);
    expect(s.flags).toEqual({});
    expect(s.hub).toEqual({});
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('好感度结算', () => {
  it('累加并回报浮层项', () => {
    const { state, toasts } = applyEff(createInitialState(), { nanao: 2, yu: 1 }, CHARS);
    expect(state.aff.nanao).toBe(2);
    expect(state.aff.yu).toBe(1);
    expect(toasts).toEqual([{ who: 'nanao', delta: 2 }, { who: 'yu', delta: 1 }]);
  });

  it('下限为 0', () => {
    const { state } = applyEff(createInitialState(), { nanao: -5 }, CHARS);
    expect(state.aff.nanao).toBe(0);
  });

  it('好感度为 0 时的负向 eff 仍产生浮层，但数值不变（现状行为，刻意保留）', () => {
    const { state, toasts } = applyEff(createInitialState(), { nanao: -1 }, CHARS);
    expect(state.aff.nanao).toBe(0);
    expect(toasts).toEqual([{ who: 'nanao', delta: -1 }]);
  });

  it('触底时浮层报告原始 delta 而非实际增量（现状行为，刻意保留）', () => {
    const s1 = applyEff(createInitialState(), { nanao: 1 }, CHARS).state;
    const { state, toasts } = applyEff(s1, { nanao: -3 }, CHARS);
    expect(state.aff.nanao).toBe(0);
    expect(toasts).toEqual([{ who: 'nanao', delta: -3 }]);
  });

  it('eff 为 0 时不产生浮层也不改变状态', () => {
    const s0 = createInitialState();
    const { state, toasts } = applyEff(s0, { nanao: 0 }, CHARS);
    expect(state.aff.nanao).toBe(0);
    expect(toasts).toEqual([]);
  });

  it('非 hero 角色的 eff 被忽略（如 moku）', () => {
    const { state, toasts } = applyEff(createInitialState(), { moku: 3 }, CHARS);
    expect(state.aff.moku).toBe(0);
    expect(toasts).toEqual([]);
  });

  it('不修改传入的 state（纯函数）', () => {
    const s0 = createInitialState();
    applyEff(s0, { nanao: 3 }, CHARS);
    expect(s0.aff.nanao).toBe(0);
  });

  it('eff 为 undefined 时原样返回', () => {
    const s0 = createInitialState();
    const { state, toasts } = applyEff(s0, undefined, CHARS);
    expect(state).toBe(s0);
    expect(toasts).toEqual([]);
  });
});

describe('阶段计算', () => {
  it.each<[number, string]>([
    [0, '无视'], [1, '眼熟'], [2, '眼熟'], [3, '嘴替'],
    [4, '嘴替'], [5, '宝宝'], [6, '宝宝'], [7, '沦陷'], [99, '沦陷'],
  ])('%i → %s', (aff, expected) => {
    expect(stageOf(aff)).toBe(expected);
  });
});

describe('复读与水群值（Review Focus #2：连续性语义）', () => {
  const sess = (history: Session['history']): Session => ({
    state: createInitialState(), ip: 0, history,
  });
  const yu = { kind: 'say', who: 'yu', text: '新人？' } as const;

  it('无历史时返回 empty，不产生任何变化', () => {
    const r = applyRepeat(sess([]));
    expect(r.outcome).toBe('empty');
    expect(r.session.state.water).toBe(0);
    expect(r.spoken).toBeUndefined();
  });

  it('首次复读：水群值 +1，提示成功', () => {
    const r = applyRepeat(sess([yu]));
    expect(r.outcome).toBe('ok');
    expect(r.session.state.water).toBe(1);
    expect(r.session.state.repeatN).toBe(1);
    expect(r.spoken).toBe('新人？');
  });

  it('复读会把玩家消息追加进 history', () => {
    const r = applyRepeat(sess([yu]));
    expect(r.session.history.at(-1)).toEqual({ kind: 'say', who: 'me', text: '新人？' });
  });

  it('连续第二次：提示将被禁言', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    expect(r2.outcome).toBe('warn');
    expect(r2.session.state.repeatN).toBe(2);
  });

  it('连续第三次：banned（调用方据此触发 BE24）', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    const r3 = applyRepeat(r2.session);
    expect(r3.outcome).toBe('banned');
    expect(r3.session.state.water).toBe(3);
  });

  it('中间插入他人新消息后，连续性归零', () => {
    const r1 = applyRepeat(sess([yu]));
    const r2 = applyRepeat(r1.session);
    expect(r2.session.state.repeatN).toBe(2);

    const withNew: Session = {
      ...r2.session,
      history: [...r2.session.history, { kind: 'say', who: 'g', text: '新谱' }],
    };
    const r3 = applyRepeat(withNew);
    expect(r3.outcome).toBe('ok');
    expect(r3.session.state.repeatN).toBe(1);
    expect(r3.spoken).toBe('新谱');
  });

  it('复读的是最后一条他人消息，不取自己的', () => {
    const r = applyRepeat(sess([yu, { kind: 'say', who: 'me', text: '我说的话' }]));
    expect(r.spoken).toBe('新人？');
  });

  it('系统消息与旁白不参与复读', () => {
    const r = applyRepeat(sess([
      yu, { kind: 'sys', text: '成员 80 → 81' }, { kind: 'note', text: '旁白' },
    ]));
    expect(r.spoken).toBe('新人？');
  });
});
