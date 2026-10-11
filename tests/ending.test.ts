import { describe, expect, it } from 'vitest';
import { resolveEnding } from '../src/engine/ending';
import { createInitialState } from '../src/engine/effects';
import type { AffDelta, GameState, Session } from '../src/engine/types';

function sessionWith(
  aff: AffDelta,
  flags: GameState['flags'] = {},
): Session {
  const base = createInitialState();
  return {
    state: { ...base, aff: { ...base.aff, ...aff }, flags },
    ip: 0,
    history: [],
  };
}

describe('结局判定（与现状 :814-821 一致）', () => {
  it('放鸽子且总分 ≤6 → BE10', () => {
    expect(resolveEnding(sessionWith({ nanao: 6 }, { actSkip: true })))
      .toEqual({ kind: 'be', id: 'BE10' });
  });

  it('放鸽子但总分 >6 → 不走 BE10', () => {
    expect(resolveEnding(sessionWith({ nanao: 7 }, { actSkip: true })).kind).toBe('route');
  });

  it('actSkip 的判定优先于总分阈值：总分 5 时仍走 BE10 而非路线', () => {
    expect(resolveEnding(sessionWith({ nanao: 3, yu: 2 }, { actSkip: true })))
      .toEqual({ kind: 'be', id: 'BE10' });
  });

  it('总分 ≤4 → BE23（第 81 人）', () => {
    expect(resolveEnding(sessionWith({ nanao: 2, yu: 2 })))
      .toEqual({ kind: 'be', id: 'BE23' });
  });

  it('总分恰好 4 → BE23（边界含等号）', () => {
    expect(resolveEnding(sessionWith({ nanao: 4 })))
      .toEqual({ kind: 'be', id: 'BE23' });
  });

  it('总分 5 → 不走 BE23', () => {
    expect(resolveEnding(sessionWith({ nanao: 3, yu: 2 })).kind).toBe('route');
  });

  it('取可攻略主角中好感度最高者', () => {
    expect(resolveEnding(sessionWith({ nanao: 2, yu: 5, cat: 3 })))
      .toEqual({ kind: 'route', key: 'yu' });
  });

  it('并列时取 MAIN_KEYS 中靠前者', () => {
    expect(resolveEnding(sessionWith({ yu: 5, cat: 5 })))
      .toEqual({ kind: 'route', key: 'yu' });
  });

  it('全部为 0 以外、只有一人有分时选该人', () => {
    expect(resolveEnding(sessionWith({ nanao: 7 })))
      .toEqual({ kind: 'route', key: 'nanao' });
  });

  it('总分不足 5 时不会走到路线，故此处必然有胜者', () => {
    // 只有非 MAIN_KEYS 的可攻略角色有分：总分 >4 但 MAIN_KEYS 全为 0
    // → 落到 MAIN_KEYS[0]，即 nanao（与现状一致）
    expect(resolveEnding(sessionWith({ shiban: 5, taffy: 1 })))
      .toEqual({ kind: 'route', key: 'nanao' });
  });

  it('总分只统计 HERO_KEYS，非可攻略角色的分不计入', () => {
    // moku 不是 hero，即便被赋值也不该影响总分
    expect(resolveEnding(sessionWith({ moku: 99 })))
      .toEqual({ kind: 'be', id: 'BE23' });
  });
});
