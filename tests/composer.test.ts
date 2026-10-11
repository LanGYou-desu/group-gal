// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createComposer } from '../src/ui/composer';
import { renderMembers } from '../src/ui/drawer';
import { createInitialState } from '../src/engine/effects';
import { CHARS, HERO_KEYS } from '../src/content/characters';
import type { GameState } from '../src/engine/types';

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

describe('选项渲染', () => {
  it('渲染提示语与按钮', () => {
    void createComposer(host).askChoice('说点什么', [
      { label: 'A', goto: 'x' }, { label: 'B', goto: 'x' },
    ]);
    expect(host.querySelector('.c-prompt')!.textContent).toBe('说点什么');
    expect(host.querySelectorAll('.choice')).toHaveLength(2);
    expect(host.querySelector<HTMLButtonElement>('.choice')!.textContent).toBe('A');
  });

  it('点击后 resolve 对应索引，并切回 idle', async () => {
    const p = createComposer(host).askChoice('p', [
      { label: 'A', goto: 'x' }, { label: 'B', goto: 'x' }, { label: 'C', goto: 'x' },
    ]);
    host.querySelectorAll<HTMLButtonElement>('.choice')[2]!.click();
    await expect(p).resolves.toBe(2);
    expect(host.querySelector('.c-idle')).not.toBeNull();
  });

  it('每次渲染前清空上一次的按钮', async () => {
    const c = createComposer(host);
    void c.askChoice('p', [{ label: 'A', goto: 'x' }, { label: 'B', goto: 'x' }]);
    void c.askChoice('q', [{ label: 'C', goto: 'x' }]);
    expect(host.querySelectorAll('.choice')).toHaveLength(1);
    expect(host.querySelector('.c-prompt')!.textContent).toBe('q');
  });

  it('hub 只渲染传入的（已由引擎过滤）选项', async () => {
    const p = createComposer(host).askHub('去哪', [{ id: 'main', label: '推进主线', goto: 'x' }]);
    expect(host.querySelectorAll('.choice')).toHaveLength(1);
    host.querySelector<HTMLButtonElement>('.choice')!.click();
    await expect(p).resolves.toBe(0);
  });

  it('按钮文字仅用于展示，不作为任何键', () => {
    void createComposer(host).askHub('p', [
      { id: 's_mc', label: 'MC', once: true, goto: 'x' },
      { id: 'main', label: '推进主线', goto: 'x' },
    ]);
    expect([...host.querySelectorAll<HTMLButtonElement>('.choice')].map(b => b.textContent))
      .toEqual(['MC', '推进主线']);
  });

  it('idle 直接渲染等待态', () => {
    createComposer(host).idle();
    expect(host.querySelector('.c-idle')!.textContent).toBe('……');
  });

  it('选项文字作为 textContent 设置，不解析 HTML', () => {
    void createComposer(host).askChoice('p', [{ label: '<b>x</b>', goto: 'x' }]);
    const btn = host.querySelector('.choice')!;
    expect(btn.textContent).toBe('<b>x</b>');
    expect(btn.querySelector('b')).toBeNull();
  });
});

describe('成员抽屉', () => {
  const withAff = (aff: Partial<GameState['aff']>): GameState => {
    const s = createInitialState();
    return { ...s, aff: { ...s.aff, ...aff } };
  };

  it('渲染全部可攻略角色，外加一行助攻/反派占位', () => {
    renderMembers(host, CHARS, createInitialState());
    expect(host.querySelectorAll('.dr-row')).toHaveLength(HERO_KEYS.length + 1);
  });

  it('按 HERO_KEYS 顺序渲染，第一行是闹七', () => {
    renderMembers(host, CHARS, createInitialState());
    const names = [...host.querySelectorAll('.dr-mid .t')].map(t => t.textContent);
    expect(names.slice(0, HERO_KEYS.length)).toEqual([
      '闹七', '一条鱼', '黄油猫', 'G', '石蒜', 'Tttt', '誰',
      '石斑鱼', 'taffy', '30586', '面包',
    ]);
  });

  it('好感度条宽度为 a/8，上限 100%', () => {
    renderMembers(host, CHARS, withAff({ nanao: 7, yu: 8, cat: 10 }));
    const bars = host.querySelectorAll<HTMLElement>('.bar i');
    expect(bars[0]!.style.width).toBe('87.5%');
    expect(bars[1]!.style.width).toBe('100%');
    expect(bars[2]!.style.width).toBe('100%');
  });

  it('阶段文字随好感度变化', () => {
    renderMembers(host, CHARS, withAff({ nanao: 0, yu: 1, cat: 3, g: 5, shisuan: 7 }));
    const stages = [...host.querySelectorAll('.dr-stage')].map(e => e.textContent);
    expect(stages.slice(0, 5)).toEqual(['无视', '眼熟', '嘴替', '宝宝', '沦陷']);
  });

  it('每个角色行显示头像、名字与定位', () => {
    renderMembers(host, CHARS, createInitialState());
    const first = host.querySelector('.dr-row')!;
    expect(first.querySelector('.av')!.textContent).toBe('👑');
    expect(first.querySelector('.dr-mid .t')!.textContent).toBe('闹七');
    expect(first.querySelector('.dr-mid .s')!.textContent).toBe('傲娇暴君');
  });

  it('末行是助攻/反派占位', () => {
    renderMembers(host, CHARS, createInitialState());
    const last = host.querySelector('.dr-row:last-child')!;
    expect(last.textContent).toContain('根哥 · aka · 蘑菇汤');
    expect(last.textContent).toContain('暂未开放攻略');
  });

  it('重复渲染不残留旧行', () => {
    renderMembers(host, CHARS, createInitialState());
    renderMembers(host, CHARS, createInitialState());
    expect(host.querySelectorAll('.dr-row')).toHaveLength(HERO_KEYS.length + 1);
  });
});
