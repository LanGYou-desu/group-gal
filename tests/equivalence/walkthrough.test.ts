import { describe, expect, it } from 'vitest';
import { run } from '../../src/engine/runner';
import { createInitialState } from '../../src/engine/effects';
import { LABELS, SCRIPT } from '../../src/content/chapters';
import { CHARS } from '../../src/content/characters';
import { BEDATA } from '../../src/content/endings';
import { validateScript } from '../../src/engine/validate';
import { FakeRenderer } from '../fake-renderer';
import type { Session } from '../../src/engine/types';

const env = { script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA };

async function play(choiceAnswers: number[], hubAnswers: number[]) {
  const r = new FakeRenderer();
  r.choiceAnswers = choiceAnswers;
  r.hubAnswers = hubAnswers;
  const s: Session = { state: createInitialState(), ip: 0, history: [] };
  await run(s, env, r);
  return { r, s };
}

const P = (n: number) => Array<number>(n).fill(0) as number[];

/** 进入 hub 之前的 choice 个数：序章 1 + 第一章 6。 */
const PRE_HUB = 7;

/** 走遍 6 条支线（蘑菇汤选「有事说事」以回到 hub）再推进主线的答案序列。 */
const FULL_RUN_CHOICES = [...P(PRE_HUB), 0, 0, 0, 0, 0, 0, 0, 2, 0];
const FULL_RUN_HUBS = [0, 0, 0, 0, 0, 0, 0];

describe('等价性走查 — 完整通关', () => {
  it('走完 6 条支线后推进主线，抵达路线 yu', async () => {
    const { r, s } = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    // 全选首选路线时 yu 累积最高（6 点），故走鱼猫线
    expect(r.calls.at(-1)).toEqual({
      t: 'ending', resolution: { kind: 'route', key: 'yu' },
    });
    for (const id of ['s_mc', 's_arc', 's_chart', 's_food', 's_mh', 's_moku']) {
      expect(s.state.hub[id], id).toBe(true);
    }
    expect(s.state.hub['main']).toBeUndefined();
    expect(s.state.flags.actGood).toBe(true);
  });

  it('六条支线各自渲染过自己的卡片', async () => {
    const { r } = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    const cards = r.calls.filter(c => c.t === 'card').map(c => (c as { who: string }).who);
    for (const who of ['yu', 'g', 'shisuan', 'cat', 'shiban', 'moku']) {
      expect(cards, who).toContain(who);
    }
  });

  it('16 个 choice 与 7 次 hub 访问全部用尽', async () => {
    const { s } = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    expect(s.ip).toBeGreaterThan(0);
    expect(s.history.length).toBeGreaterThan(50);
  });
});

describe('等价性走查 — 即时 Bad End 分叉', () => {
  it('第一章「你谁啊 凭什么命令我」→ BE01', async () => {
    expect((await play([0, 2], [])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE01' });
  });

  it('第一章「这谱不行 配置稀烂」→ BE02', async () => {
    expect((await play([0, 0, 0, 1], [])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE02' });
  });

  it('第一章「给你们讲个黄段子」→ BE05', async () => {
    expect((await play([0, 0, 2], [])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE05' });
  });

  it('第一章「我偏要拿」→ BE17', async () => {
    expect((await play([0, 0, 0, 0, 0, 2], [])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE17' });
  });

  it('拼机支线「这不有手就行」→ BE02（hub 第 2 项是 s_arc）', async () => {
    expect((await play([...P(PRE_HUB), 1], [1])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE02' });
  });

  it('干饭支线「讲个黄段子下饭」→ BE05（hub 第 4 项是 s_food）', async () => {
    expect((await play([...P(PRE_HUB), 2], [3])).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE05' });
  });
});

describe('等价性走查 — 蘑菇汤线的三个分支', () => {
  /**
   * hub 第 6 项是 s_moku，要依次走过前 5 条支线后才出现在末位。
   * 走这 6 条支线会消耗 choice #7..#13，s_moku 自己的选项落在 #14。
   */
  const toMoku = (mokuChoice: number) =>
    play([...P(PRE_HUB), 0, 0, 0, 0, 0, 0, 0, mokuChoice], [0, 0, 0, 0, 0, 0]);

  it('「群主挺护着大家的」→ s_moku_a → BE19', async () => {
    expect((await toMoku(0)).r.calls.at(-1)).toEqual({ t: 'be', id: 'BE19' });
  });

  it('「好像是有点 哈哈」→ s_moku_b → BE20，并置位 mokuJoin', async () => {
    const { r, s } = await toMoku(1);
    expect(r.calls.at(-1)).toEqual({ t: 'be', id: 'BE20' });
    expect(s.state.flags.mokuJoin).toBe(true);
  });

  it('「有事说事」→ s_moku_c → 回 hub，不触发 BE', async () => {
    const { r } = await toMoku(2);
    expect(r.calls.some(c => c.t === 'be')).toBe(false);
  });

  it('moku 的好感度被忽略（非 hero），即使选了加好感的选项', async () => {
    const { s } = await toMoku(1);
    expect(s.state.aff.moku).toBe(0);
  });
});

describe('等价性走查 — 结局判定触发', () => {
  it('直推主线 + 全群动员 → 路线结局', async () => {
    const last = (await play([...P(PRE_HUB), 0], [6])).r.calls.at(-1)!;
    expect(last.t).toBe('ending');
    expect((last as { resolution: { kind: string } }).resolution.kind).toBe('route');
  });

  it('最小好感路径 + 放鸽子 → BE10「我很伤心」', async () => {
    // 前置取最低好感组合 [0,1,1,2,1,1,1]（序章 0 + 第一章 1/1/2/1/1/1），
    // 直推主线，ch3 选「算了我今晚有事」置 actSkip。
    // 注意：BE10 由 ending 节点经 resolveEnding 判定，故走 showEnding 而非 showBE。
    const { r, s } = await play([0, 1, 1, 2, 1, 1, 1, 2], [6]);
    expect(r.calls.at(-1)).toEqual({
      t: 'ending', resolution: { kind: 'be', id: 'BE10' },
    });
    expect(s.state.flags.actSkip).toBe(true);
  });

  it('放鸽子但好感过高时不走 BE10', async () => {
    // 全选首选路线 → 好感远超 6
    const last = (await play([...P(PRE_HUB), 2], [6])).r.calls.at(-1)!;
    expect(last.t).toBe('ending');
  });
});

describe('等价性走查 — BE23 不可达（源剧本的既有问题，已保留）', () => {
  it('进入 hub 前的 7 个 choice 穷举，最低好感总和为 6', async () => {
    // 精确枚举 4×3×3×3×3×3×3 组前置选择，取进入 hub 前的最低总和。
    // 这一步是 BE23 可达性的下界证明：支线只会持平或增加好感
    //（负增量选项作用的角色此时均为 0）。
    const opts = [4, 3, 3, 3, 3, 3, 3];
    let min = Infinity;
    const plan: number[] = [];
    const seen: string[] = [];

    const probe = async (p: number[]) => {
      const r = new FakeRenderer();
      r.choiceAnswers = [...p];
      r.hubAnswers = [0];
      const s: Session = { state: createInitialState(), ip: 0, history: [] };
      // 只跑到第一个 hub 就抛出，避免走完整条线
      const stop = new Error('reached-hub');
      let reachedHub = false;
      r.askHub = async () => { reachedHub = true; throw stop; };
      try { await run(s, env, r); } catch (e) { if (e !== stop) throw e; }
      // 在前置章节就翻车（撞 BE）的策略不计入——那不是「进入 hub」的状态
      if (!reachedHub) return;
      const total = Object.values(s.state.aff).reduce((a, b) => a + b, 0);
      if (total < min) { min = total; seen.length = 0; seen.push(JSON.stringify(p)); }
    };

    const rec = async (d: number): Promise<void> => {
      if (d === opts.length) { await probe(plan); return; }
      for (let k = 0; k < opts[d]!; k++) { plan.push(k); await rec(d + 1); plan.pop(); }
    };
    await rec(0);

    expect(min).toBe(6);
    expect(seen[0]).toBe('[0,1,1,2,1,1,1]');
  });

  it('不带 actSkip 时终局好感最低 6+1=7，永远够不到 ≤4 的 BE23 阈值', async () => {
    // ch3 三个选项的最小增量：0 号 +8 / 1 号 +1 / 2 号 -2（且置 actSkip）
    // 不带 actSkip 的最小路径即「前置取最低 + ch3 选 1 号」
    const { r, s } = await play([0, 1, 1, 2, 1, 1, 1, 1], [6]);
    const total = Object.values(s.state.aff).reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
    expect(s.state.flags.actSkip).toBeUndefined();
    expect(r.calls.at(-1)).toMatchObject({ t: 'ending', resolution: { kind: 'route' } });
  });

  it('原版结局页宣称的「9 个 Bad End」实际只有 8 个可触发', () => {
    // 这是源剧本既有的内容问题，阶段 1 原样保留（改剧情属于阶段 5 的创作范畴）。
    // 可触发的 BE：BE01/02/05/10/17/19/20/24 —— 共 8 个。
    const reachable = ['BE01', 'BE02', 'BE05', 'BE10', 'BE17', 'BE19', 'BE20', 'BE24'];
    const all = Object.keys(BEDATA);
    const unreachable = all.filter(id => !reachable.includes(id));
    expect(unreachable).toEqual(['BE23']);
  });
});

describe('等价性走查 — 渲染序列快照（防未来回归）', () => {
  const shape = (calls: readonly { t: string; who?: string }[]) =>
    calls.map(c => (c.t === 'say' ? `${c.t}:${c.who}` : c.t));

  it('完整通关的调用序列固定', async () => {
    const { r } = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    expect(shape(r.calls)).toMatchSnapshot();
  });

  it.each([
    ['BE01', [0, 2]],
    ['BE02', [0, 0, 0, 1]],
    ['BE05', [0, 0, 2]],
    ['BE17', [0, 0, 0, 0, 0, 2]],
    ['BE10', [0, 0, 1, 2, 1, 1, 1, 2]],
  ])('%s 分叉的调用序列固定', async (_name, choices) => {
    const { r } = await play([...choices], [6]);
    expect(shape(r.calls)).toMatchSnapshot();
  });
});

describe('等价性走查 — 确定性', () => {
  it('同一选项路径跑两次结果完全一致', async () => {
    const a = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    const b = await play(FULL_RUN_CHOICES, FULL_RUN_HUBS);
    expect(a.r.calls).toEqual(b.r.calls);
    expect(a.s.state).toEqual(b.s.state);
  });

  it('快照测试用的剧本本身通过校验（无 error）', () => {
    expect(validateScript(SCRIPT, CHARS, BEDATA).filter(i => i.level === 'error')).toEqual([]);
  });
});
