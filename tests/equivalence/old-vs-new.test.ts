// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { run } from '../../src/engine/runner';
import { createInitialState } from '../../src/engine/effects';
import { LABELS, SCRIPT } from '../../src/content/chapters';
import { CHARS } from '../../src/content/characters';
import { BEDATA } from '../../src/content/endings';
import { FakeRenderer, type Call } from '../fake-renderer';
import type { Session } from '../../src/engine/types';

/**
 * 真·新旧差分测试：**直接运行旧文件里的脚本**，与重构后的引擎逐项比对。
 *
 * 为什么需要它：此前的 `walkthrough.test.ts` 是「新版对自身快照」，
 * 无法发现新旧**同错**的对称搬运错误；`fake-renderer` 也不经过 main.ts 的接线。
 * 这里把仓库里未改动的 `group-chat-galgame.html` 原样载入 jsdom 跑起来，
 * 于是「行为与旧版一致」这个主张变成了仓库内可复跑的证据，而非账本里的文字。
 *
 * 旧脚本在 jsdom 下的降级是安全的：`ensure()` 在无 AudioContext 时直接 return，
 * `sfx` 有 try/catch。因此无须任何 shim。
 */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeout = 15_000, what = '条件'): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (cond()) return;
    await sleep(15);
  }
  throw new Error(`waitFor 超时：${what}`);
}

/** 在给定的 document 上按固定答案序列跑完整局，收集渲染序列与结局。 */
async function playInDom(doc: Document, answers: readonly number[]) {
  const seq: string[] = [];
  const seen = new Set<Element>();

  const collect = () => {
    for (const el of doc.querySelectorAll('#chat > *')) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.classList.contains('msg')) {
        const bub = el.querySelector('.bub')?.textContent ?? '';
        seq.push(el.classList.contains('me')
          ? `me:${bub}`
          : `${el.querySelector('.nm')?.textContent ?? ''}:${bub}`);
      } else if (el.classList.contains('sys')) seq.push(`sys:${el.textContent}`);
      else if (el.classList.contains('note')) seq.push(`note:${el.textContent}`);
      else if (el.classList.contains('card')) seq.push(`card:${el.querySelector('h4')?.textContent ?? ''}`);
    }
  };

  const ov = doc.getElementById('overlay')!;
  doc.getElementById('btnStart')!.click();
  await waitFor(() => doc.querySelectorAll('#composer .choice').length > 0 || !ov.classList.contains('hidden'));
  doc.getElementById('btnFast')!.click();

  let guard = 0, pick = 0;
  while (guard++ < 4000) {
    collect();
    if (!ov.classList.contains('hidden')) break;
    const btns = doc.querySelectorAll<HTMLButtonElement>('#composer .choice');
    if (btns.length > 0) {
      btns[Math.min(answers[pick] ?? 0, btns.length - 1)]!.click();
      pick++;
      await sleep(20);
    } else {
      await sleep(10);
    }
  }
  collect();

  return {
    seq,
    clicks: pick,
    title: doc.getElementById('ovCard')?.querySelector('h2')?.textContent ?? null,
    cls: doc.getElementById('ovCard')?.className ?? null,
  };
}

/** 把引擎的渲染调用还原成与 DOM 采集器同构的字符串序列。 */
function engineSeq(calls: readonly Call[]): string[] {
  const out: string[] = [];
  for (const c of calls) {
    if (c.t === 'say') {
      out.push(c.who === 'me' ? `me:${c.text}` : `${CHARS[c.who].name}${CHARS[c.who].role}:${c.text}`);
    } else if (c.t === 'sys') out.push(`sys:${c.text}`);
    else if (c.t === 'note') out.push(`note:${c.text}`);
    else if (c.t === 'card') out.push(`card:${CHARS[c.who].name}${CHARS[c.who].sub}`);
  }
  return out;
}

async function playEngine(
  choiceAnswers: readonly number[],
  hubAnswers: readonly number[] = [],
) {
  const r = new FakeRenderer();
  r.choiceAnswers = [...choiceAnswers];
  r.hubAnswers = [...hubAnswers];
  const s: Session = { state: createInitialState(), ip: 0, history: [] };
  await run(s, { script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA }, r);
  return { seq: engineSeq(r.calls), session: s };
}

/** 旧文件原样载入 jsdom。`beforeParse` 未做任何 shim——旧脚本自身能安全降级。 */
function loadOld(): Document {
  const html = readFileSync('group-chat-galgame.html', 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });
  return dom.window.document;
}

const P = (n: number) => Array<number>(n).fill(0) as number[];

/**
 * ⚠️ 两个索引空间不同，不可混用：
 * - **DOM 点击**是一条扁平序列——choice 与 hub 的按钮按出现顺序混在一个计数里
 * - **引擎层** `choiceAnswers` 与 `hubAnswers` 各自独立计数
 *
 * 完整通关路径两边的写法如下（结果完全相同，已在下面断言）。
 * 进入 hub 前有 7 个 choice，之后是 6 条支线（8 个 choice）与 7 次 hub。
 */
const PRE_HUB = 7;

/** DOM：第 21 次点击（下标 20）落在蘑菇汤支线的选项上，选第 3 项以回 hub。 */
const FULL_CLICKS_FLAT: number[] = (() => {
  const a = new Array<number>(30).fill(0);
  a[20] = 2;
  return a;
})();

/** 引擎：choice 下标 14 是蘑菇汤的选项；hub 全部选 0（依次走完 6 条支线再推进主线）。 */
const FULL_CHOICE_ANSWERS = [...P(PRE_HUB), 0, 0, 0, 0, 0, 0, 0, 2, 0];
const FULL_HUB_ANSWERS = P(PRE_HUB);

describe('新旧差分 —— 旧文件脚本 vs 重构引擎', () => {
  it('完整通关路径：渲染序列逐项一致', async () => {
    const oldR = await playInDom(loadOld(), FULL_CLICKS_FLAT);
    const newR = await playEngine(FULL_CHOICE_ANSWERS, FULL_HUB_ANSWERS);

    // 首个差异定位到具体下标，便于排错
    const n = Math.max(oldR.seq.length, newR.seq.length);
    const diffs: string[] = [];
    for (let i = 0; i < n; i++) {
      if (oldR.seq[i] !== newR.seq[i]) {
        diffs.push(`#${i} 旧=${oldR.seq[i] ?? '(无)'} 新=${newR.seq[i] ?? '(无)'}`);
      }
    }

    expect(diffs, diffs.join('\n')).toEqual([]);
    expect(oldR.seq.length).toBe(newR.seq.length);
    expect(oldR.clicks).toBe(23);
    expect(oldR.title).toBe('鱼猫线 · 第三把椅子');
  }, 60_000);

  it.each([
    ['BE01', [0, 2]],
    ['BE02', [0, 0, 0, 1]],
    ['BE05', [0, 0, 2]],
    ['BE17', [0, 0, 0, 0, 0, 2]],
  ])('%s 分叉路径：渲染序列与结局逐项一致', async (_name, answers) => {
    // 这些路径不经过 hub，扁平点击与 choice 下标恰好一致
    const oldR = await playInDom(loadOld(), answers);
    const newR = await playEngine(answers);
    expect(oldR.seq).toEqual(newR.seq);
    expect(oldR.clicks).toBe(newR.seq.filter(s => s.startsWith('me:')).length);
  }, 60_000);

  it('旧版引擎的结局页文案与新版逐字一致', async () => {
    const oldDoc = loadOld();
    await playInDom(oldDoc, [0, 2]);
    const oldTitle = oldDoc.getElementById('ovCard')?.querySelector('h2')?.textContent;
    const oldBody = oldDoc.getElementById('ovCard')?.querySelector('p')?.textContent;

    expect(oldTitle).toBe(BEDATA.BE01.title);
    expect(oldBody).toBe(BEDATA.BE01.text);
  }, 60_000);

  it('旧版的成员抽屉与新版渲染同一组数值', async () => {
    const oldDoc = loadOld();
    await playInDom(oldDoc, [0, 0, 0, 0, 0, 0]);
    oldDoc.getElementById('btnMembers')!.dispatchEvent(new Event('click'));

    const oldRows = [...oldDoc.querySelectorAll('#drList .dr-row .dr-mid .t')].map(e => e.textContent);
    expect(oldRows.slice(0, 11)).toEqual([
      '闹七', '一条鱼', '黄油猫', 'G', '石蒜', 'Tttt', '誰',
      '石斑鱼', 'taffy', '30586', '面包',
    ]);
    expect(oldDoc.querySelectorAll('#drList .dr-row')).toHaveLength(12);
  }, 60_000);
});

describe('新旧差分 —— 说明', () => {
  it('旧文件在仓库中保持未改动（本测试的前提）', () => {
    const html = readFileSync('group-chat-galgame.html', 'utf8');
    expect(html).toContain("const S = [");
    expect(html).toContain("['label','start']");
    expect(html).toContain('单文件可玩 · 无需联网 · 内置合成 BGM');
    // 未被阶段 1 触碰：仍是 907 行的原始形态
    expect(html.split('\n').length).toBeGreaterThan(900);
  });
});
