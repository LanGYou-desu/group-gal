// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createOverlay } from '../src/ui/overlay';
import { createInitialState } from '../src/engine/effects';
import { CHARS } from '../src/content/characters';
import type { Session } from '../src/engine/types';

let overlay: HTMLElement;
let card: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  overlay = document.createElement('div');
  overlay.className = 'overlay hidden';
  card = document.createElement('div');
  card.id = 'ovCard';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
});

const ov = () => createOverlay(overlay, card, CHARS);

const session = (aff: Partial<Record<string, number>> = {}, flags: Record<string, boolean> = {}): Session => {
  const base = createInitialState();
  return {
    state: { ...base, aff: { ...base.aff, ...aff } as never, flags: flags as never },
    ip: 0,
    history: [],
  };
};

describe('结局弹窗 — Bad End', () => {
  it('显示标题与正文，并带 be-ov 样式', () => {
    ov().showBE('BE01');
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(card.className).toContain('be-ov');
    expect(card.querySelector('h2')!.textContent).toBe('BE-01 老傻子');
    expect(card.querySelector('.tag')!.textContent).toBe('BAD END');
    expect(card.querySelector('p')!.textContent).toContain('第二天 你自己退了群');
  });

  it('带「从头再来」与「返回标题」两个按钮', () => {
    ov().showBE('BE02');
    expect(card.querySelector('#ovRestart')!.textContent).toBe('从头再来');
    expect(card.querySelector('#ovTitle')!.textContent).toBe('返回标题');
  });

  it('9 个 Bad End 都能渲染', () => {
    for (const id of ['BE01', 'BE02', 'BE05', 'BE10', 'BE17', 'BE19', 'BE20', 'BE23', 'BE24'] as const) {
      ov().showBE(id);
      expect(card.querySelector('h2')!.textContent, id).toBeTruthy();
      expect(card.querySelector('p')!.textContent!.length, id).toBeGreaterThan(20);
    }
  });
});

describe('结局弹窗 — 路线结局', () => {
  it('显示标题、正文与沦陷度汇总', () => {
    ov().showEnding({ kind: 'route', key: 'yu' }, session({ yu: 6, nanao: 1 }));
    expect(card.className).toContain('end-ov');
    expect(card.querySelector('h2')!.textContent).toBe('鱼猫线 · 第三把椅子');
    expect(card.querySelector('.tag')!.textContent).toBe('END · 路线序章');
    expect(card.querySelector('.stat-sum')!.textContent).toContain('一条鱼：宝宝');
    expect(card.querySelector('.stat-sum')!.textContent).toContain('闹七：眼熟');
  });

  it('汇总里显示水群值与群成员数', () => {
    const s = session({ nanao: 8 });
    const withWater: Session = { ...s, state: { ...s.state, water: 5, members: 82 } };
    ov().showEnding({ kind: 'route', key: 'nanao' }, withWater);
    const sum = card.querySelector('.stat-sum')!.textContent!;
    expect(sum).toContain('水群值：5');
    expect(sum).toContain('群成员：82');
  });

  it('汇总列出全部 11 个可攻略角色的沦陷度', () => {
    ov().showEnding({ kind: 'route', key: 'nanao' }, session({ nanao: 8 }));
    const sum = card.querySelector('.stat-sum')!.textContent!;
    for (const name of ['闹七', '一条鱼', '黄油猫', 'G', '石蒜', 'Tttt', '誰', '石斑鱼', 'taffy', '30586', '面包']) {
      expect(sum, name).toContain(name);
    }
  });

  it('带「个人线好结局暂未撰写」的说明与 9 个 Bad End 的提示', () => {
    ov().showEnding({ kind: 'route', key: 'nanao' }, session({ nanao: 8 }));
    expect(card.textContent).toContain('9 个 Bad End');
    expect(card.textContent).toContain('个人线好结局按企划要求暂未撰写');
  });

  it('判定为 be 时复用 Bad End 弹窗', () => {
    ov().showEnding({ kind: 'be', id: 'BE23' }, session());
    expect(card.className).toContain('be-ov');
    expect(card.querySelector('h2')!.textContent).toContain('第 81 人');
  });

  it('7 条路线结局都能渲染', () => {
    for (const key of ['nanao', 'yu', 'cat', 'g', 'shisuan', 'tttt', 'shei'] as const) {
      ov().showEnding({ kind: 'route', key }, session({ [key]: 8 }));
      expect(card.querySelector('h2')!.textContent, key).toBeTruthy();
    }
  });
});

describe('弹窗 — 交互与关于页', () => {
  it('关闭后 overlay 重新隐藏', () => {
    const o = ov();
    o.showBE('BE02');
    o.close();
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  it('「从头再来」触发 onRestart 回调', () => {
    const o = ov();
    let restarted = false;
    o.onRestart = () => { restarted = true; };
    o.showBE('BE05');
    card.querySelector<HTMLButtonElement>('#ovRestart')!.click();
    expect(restarted).toBe(true);
  });

  it('「返回标题」触发 onBackToTitle 回调', () => {
    const o = ov();
    let back = false;
    o.onBackToTitle = () => { back = true; };
    o.showBE('BE05');
    card.querySelector<HTMLButtonElement>('#ovTitle')!.click();
    expect(back).toBe(true);
  });

  it('重新打开会清掉上一次的样式类', () => {
    const o = ov();
    o.showBE('BE01');
    o.showEnding({ kind: 'route', key: 'nanao' }, session({ nanao: 8 }));
    expect(card.className).toContain('end-ov');
    expect(card.className).not.toContain('be-ov');
  });

  it('关于页含三个 BGM 素材来源与玩法提示', () => {
    const o = ov();
    o.showAbout(() => {});
    expect(card.querySelectorAll('a')).toHaveLength(3);
    expect(card.textContent).toContain('无需服务器、无需联网');
    expect(card.textContent).toContain('同一句话连续刷屏 3 次会被禁言');
  });

  it('关于页的「开始游戏」触发回调，「返回」只关闭', () => {
    const o = ov();
    let started = false;
    o.showAbout(() => { started = true; });

    card.querySelector<HTMLButtonElement>('#ovClose2')!.click();
    expect(started).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);

    o.showAbout(() => { started = true; });
    card.querySelector<HTMLButtonElement>('#ovClose')!.click();
    expect(started).toBe(true);
  });
});
