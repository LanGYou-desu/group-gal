// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 驱动真实 main.ts 的集成测试。
 *
 * 这一层是「装配接线」——恰恰是引擎单测（applyRepeat 链式传参天然自洽）与
 * FakeRenderer 走查（不经过 main.ts）结构性覆盖不到的地方。
 * 下面这条用例钉住的是一个真实回归：applyRepeat 返回新对象、而 run() 持有旧引用，
 * 导致首次复读之后两者分叉。
 */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeout = 10_000, what = '条件'): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (cond()) return;
    await sleep(20);
  }
  throw new Error(`waitFor 超时：${what}`);
}

const otherMsgs = (): string[] =>
  [...document.querySelectorAll('#chat .msg:not(.me) .bub')].map(b => b.textContent ?? '');

const meMsgs = (): string[] =>
  [...document.querySelectorAll('#chat .msg.me .bub')].map(b => b.textContent ?? '');

const choiceCount = (): number => document.querySelectorAll('#composer .choice').length;

const click = (id: string): void => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 #${id}`);
  el.click();
};

async function boot(): Promise<void> {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main');
  click('btnStart');
  // 立刻开快进：按钮在 mountShell 时就已存在，先开可让开场十余条消息快速刷完
  click('btnFast');
  await waitFor(() => choiceCount() > 0, 10_000, '开场选择的出现');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('main.ts 装配接线', () => {
  it('复读始终读到最新的他人消息（复读后 session 引用不得被替换）', async () => {
    await boot();

    // 此刻 runner 停在开场选择上，聊天流是静止的——可以安全取「最新一条」
    const first = otherMsgs().at(-1)!;
    expect(first).toBeTruthy();

    click('btnRepeat');
    await waitFor(() => meMsgs().length >= 1, 3000, '第一次复读的消息');
    expect(meMsgs().at(-1)).toBe(first);

    // 推进一屏：选一个选项，runner 继续跑到下一个选择处再停下
    document.querySelectorAll<HTMLButtonElement>('#composer .choice')[0]!.click();
    await waitFor(() => choiceCount() > 0, 10_000, '第二个选择的出现');

    const fresh = otherMsgs().at(-1)!;
    expect(fresh, '推进后应出现新的他人消息').not.toBe(first);

    // 关键断言：第二次复读必须取新的那条。
    // session 引用若被复读替换，这里会复读 first（历史被冻结在首次复读的时刻）。
    click('btnRepeat');
    await waitFor(() => meMsgs().length >= 2, 3000, '第二次复读的消息');
    expect(meMsgs().at(-1)).toBe(fresh);
  });

  it('开局即可打开成员抽屉且渲染 11 名可攻略角色', async () => {
    await boot();
    click('btnMembers');
    expect(document.querySelectorAll('#drList .dr-row')).toHaveLength(12); // 11 + 助攻反派占位
  });

  it('复读三次同一句话触发 BE24 禁言', async () => {
    await boot();
    const target = otherMsgs().at(-1)!;

    for (let i = 0; i < 3; i++) {
      click('btnRepeat');
      await waitFor(() => meMsgs().length >= i + 1, 3000, `第 ${i + 1} 次复读`);
      expect(meMsgs().at(-1)).toBe(target);
    }

    await waitFor(
      () => !document.getElementById('overlay')!.classList.contains('hidden'),
      5000, 'BE24 弹窗',
    );
    expect(document.getElementById('ovCard')!.querySelector('h2')!.textContent).toContain('BE-24');
  });
});
