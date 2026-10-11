import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Node, Renderer, Session } from '../src/engine/types';

describe('类型定义', () => {
  it('Node 是判别联合，kind 可收窄', () => {
    const n: Node = { kind: 'say', who: 'yu', text: 'hi' };
    if (n.kind === 'say') {
      expectTypeOf(n.who).toEqualTypeOf<
        | 'yu' | 'nanao' | 'cat' | 'g' | 'shisuan' | 'tttt'
        | 'shei' | 'shiban' | 'taffy' | 'c30586' | 'mianbao'
        | 'gen' | 'aka' | 'moku' | 'me'
      >();
      expectTypeOf(n.text).toEqualTypeOf<string>();
    }
  });

  it('Renderer 覆盖引擎全部副作用出口', () => {
    expectTypeOf<keyof Renderer>().toEqualTypeOf<
      | 'say' | 'sys' | 'note' | 'card' | 'bgm' | 'affToast' | 'toast'
      | 'askChoice' | 'askHub' | 'showBE' | 'showEnding' | 'delays'
    >();
  });

  it('Session 可被 JSON 往返', () => {
    const s: Session = {
      state: {
        schemaVersion: 1,
        aff: { nanao: 0 } as Session['state']['aff'],
        flags: {},
        water: 3,
        members: 81,
        hub: { s_mc: true },
        lastRepeat: '新人？',
        repeatN: 2,
      },
      ip: 42,
      history: [{ kind: 'say', who: 'yu', text: '新人？' }],
    };

    const back = JSON.parse(JSON.stringify(s)) as Session;

    expect(back).toEqual(s);
    expect(back.ip).toBe(42);
    expect(back.state.water).toBe(3);
    expect(back.state.hub['s_mc']).toBe(true);
    expect(back.history[0]).toEqual({ kind: 'say', who: 'yu', text: '新人？' });
  });
});
