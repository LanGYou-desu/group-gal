import { describe, expect, it } from 'vitest';
import { run } from '../src/engine/runner';
import { createInitialState } from '../src/engine/effects';
import { buildLabelIndex } from '../src/engine/validate';
import { CHARS } from '../src/content/characters';
import { BEDATA } from '../src/content/endings';
import { FakeRenderer } from './fake-renderer';
import type { HubOption, Script, Session } from '../src/engine/types';

const env = (script: Script) => ({
  script, labels: buildLabelIndex(script), chars: CHARS, beData: BEDATA,
});

const fresh = (): Session => ({ state: createInitialState(), ip: 0, history: [] });

describe('解释器 — 节点分发', () => {
  it('顺序播放 say/sys/note/card', async () => {
    const r = new FakeRenderer();
    await run(fresh(), env([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'sys', text: '入群' },
      { kind: 'note', text: '旁白' },
      { kind: 'card', who: 'yu' },
    ]), r);
    expect(r.calls).toEqual([
      { t: 'say', who: 'yu', text: '嗨' },
      { t: 'sys', text: '入群' },
      { t: 'note', text: '旁白' },
      { t: 'card', who: 'yu' },
    ]);
  });

  it('把 say/sys/note 计入 history，card 不计入', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    await run(s, env([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'sys', text: '入群' },
      { kind: 'note', text: '旁白' },
      { kind: 'card', who: 'yu' },
    ]), r);
    expect(s.history).toEqual([
      { kind: 'say', who: 'yu', text: '嗨' },
      { kind: 'sys', text: '入群' },
      { kind: 'note', text: '旁白' },
    ]);
  });

  it('bgm 与 aff 节点生效', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    await run(s, env([
      { kind: 'bgm', track: 'night' },
      { kind: 'aff', eff: { yu: 3 } },
    ]), r);
    expect(r.calls).toContainEqual({ t: 'bgm', track: 'night' });
    expect(r.calls).toContainEqual({ t: 'affToast', items: [{ who: 'yu', delta: 3 }] });
    expect(s.state.aff.yu).toBe(3);
  });

  it('set 节点置位 flag', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    await run(s, env([{ kind: 'set', flag: 'actGood' }]), r);
    expect(s.state.flags.actGood).toBe(true);
  });

  it('label 节点不产生渲染调用', async () => {
    const r = new FakeRenderer();
    await run(fresh(), env([{ kind: 'label', name: 'start' }]), r);
    expect(r.calls).toEqual([]);
  });
});

describe('解释器 — choice', () => {
  const script: Script = [
    { kind: 'label', name: 'start' },
    { kind: 'choice', prompt: '说点什么', options: [
      { label: 'A', eff: { nanao: 1 }, goto: 'done' },
      { label: 'B', say: '😺', eff: { cat: 8 }, set: 'actGood', goto: 'done' },
    ] },
    { kind: 'label', name: 'done' },
    { kind: 'ending' },
  ];

  it('把选中项作为玩家消息发出，并应用 eff 与 set', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    r.choiceAnswers = [1];
    await run(s, env(script), r);

    expect(s.state.aff.cat).toBe(8);
    expect(s.state.flags.actGood).toBe(true);
    expect(r.calls).toContainEqual({ t: 'say', who: 'me', text: '😺' });
    expect(r.calls).toContainEqual({ t: 'affToast', items: [{ who: 'cat', delta: 8 }] });
    expect(r.calls.filter(c => c.t === 'ending')).toHaveLength(1);
  });

  it('选中项的消息同时进入 history', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    r.choiceAnswers = [1];
    await run(s, env(script), r);
    expect(s.history).toContainEqual({ kind: 'say', who: 'me', text: '😺' });
  });

  it('缺省 say 时用选项文字作为发出的消息', async () => {
    const r = new FakeRenderer();
    r.choiceAnswers = [0];
    await run(fresh(), env([
      { kind: 'choice', prompt: 'p', options: [{ label: '打打 Arcaea', goto: 'end' }] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);
    expect(r.calls).toContainEqual({ t: 'say', who: 'me', text: '打打 Arcaea' });
  });

  it('选择越界时回退到第 0 项（不崩）', async () => {
    const r = new FakeRenderer();
    r.choiceAnswers = [99];
    await run(fresh(), env(script), r);
    expect(r.calls).toContainEqual({ t: 'say', who: 'me', text: 'A' });
  });
});

describe('解释器 — hub', () => {
  const script: Script = [
    { kind: 'hub', prompt: '去哪', options: [
      { id: 'mc', label: 'MC', once: true, goto: 'end' },
      { id: 'main', label: '推进主线', goto: 'end' },
    ] },
    { kind: 'label', name: 'end' },
    { kind: 'ending' },
  ];

  it('已触发的 once 选项被引擎过滤掉，不传给渲染器', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    s.state.hub['mc'] = true;

    let received: readonly HubOption[] = [];
    r.askHub = async (_p, opts) => { received = opts; return 0; };

    await run(s, env(script), r);
    expect(received.map(o => o.id)).toEqual(['main']);
  });

  it('选中 once 选项后写入 state.hub', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    r.hubAnswers = [0];
    await run(s, env(script), r);
    expect(s.state.hub['mc']).toBe(true);
  });

  it('非 once 选项不写入 state.hub', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    s.state.hub['mc'] = true;
    r.hubAnswers = [0];
    await run(s, env(script), r);
    expect(s.state.hub['main']).toBeUndefined();
  });

  it('全部 once 选项走完后只剩非 once 选项（Review Focus #5）', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    s.state.hub['a'] = true;
    s.state.hub['b'] = true;

    let received: readonly HubOption[] = [];
    r.askHub = async (_p, opts) => { received = opts; return 0; };

    await run(s, env([
      { kind: 'hub', prompt: 'p', options: [
        { id: 'a', label: 'A', once: true, goto: 'end' },
        { id: 'b', label: 'B', once: true, goto: 'end' },
        { id: 'main', label: '推进主线', goto: 'end' },
      ] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);

    expect(received).toHaveLength(1);
    expect(received[0]!.id).toBe('main');
  });

  it('hub 选项的 eff 与 set 生效', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    r.hubAnswers = [0];
    await run(s, env([
      { kind: 'hub', prompt: 'p', options: [
        { id: 'a', label: 'A', eff: { yu: 2 }, set: 'actGood', goto: 'end' },
        { id: 'b', label: 'B', goto: 'end' },
      ] },
      { kind: 'label', name: 'end' },
      { kind: 'ending' },
    ]), r);
    expect(s.state.aff.yu).toBe(2);
    expect(s.state.flags.actGood).toBe(true);
  });
});

describe('解释器 — 终止与跳转', () => {
  it('goto 到不存在的 label 抛错，而不是静默结束（Review Focus #1）', async () => {
    const r = new FakeRenderer();
    await expect(run(fresh(), env([{ kind: 'goto', label: 'nope' }]), r))
      .rejects.toThrow(/未知 label/);
  });

  it('choice 的 goto 目标不存在时同样抛错', async () => {
    const r = new FakeRenderer();
    r.choiceAnswers = [0];
    await expect(run(fresh(), env([
      { kind: 'choice', prompt: 'p', options: [{ label: 'x', goto: 'nope' }] },
    ]), r)).rejects.toThrow(/未知 label/);
  });

  it('be 节点终止播放，后续节点不再执行', async () => {
    const r = new FakeRenderer();
    await run(fresh(), env([
      { kind: 'be', id: 'BE01' },
      { kind: 'say', who: 'yu', text: '不该出现' },
    ]), r);
    expect(r.calls).toEqual([{ t: 'be', id: 'BE01' }]);
  });

  it('be 节点的 id 缺文本时抛错', async () => {
    const r = new FakeRenderer();
    await expect(run(fresh(), env([{ kind: 'be', id: 'BE99' as never }]), r))
      .rejects.toThrow(/Bad End 缺少文本/);
  });

  it('ending 节点走结局判定', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    s.state.aff.nanao = 8;
    await run(s, env([{ kind: 'ending' }]), r);
    expect(r.calls.at(-1)).toEqual({ t: 'ending', resolution: { kind: 'route', key: 'nanao' } });
  });

  it('好感度不足时 ending 走 BE23', async () => {
    const r = new FakeRenderer();
    await run(fresh(), env([{ kind: 'ending' }]), r);
    expect(r.calls.at(-1)).toEqual({ t: 'ending', resolution: { kind: 'be', id: 'BE23' } });
  });

  it('goto 与 jump 语义一致（把 ip 移到目标）', async () => {
    const r = new FakeRenderer();
    await run(fresh(), env([
      { kind: 'label', name: 'start' },
      { kind: 'goto', label: 'tail' },
      { kind: 'say', who: 'yu', text: '被跳过' },
      { kind: 'label', name: 'tail' },
      { kind: 'say', who: 'yu', text: '到达' },
    ]), r);
    expect(r.calls).toEqual([{ t: 'say', who: 'yu', text: '到达' }]);
  });
});

describe('解释器 — 存档恢复与快进', () => {
  it('可从非零 ip 续跑（存档恢复的基础）', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    s.ip = 1;
    await run(s, env([
      { kind: 'say', who: 'yu', text: '第一句' },
      { kind: 'say', who: 'yu', text: '第二句' },
    ]), r);
    expect(r.calls).toEqual([{ t: 'say', who: 'yu', text: '第二句' }]);
  });

  it('跑完后 ip 停在剧本末尾', async () => {
    const r = new FakeRenderer();
    const s = fresh();
    const script: Script = [
      { kind: 'say', who: 'yu', text: 'a' },
      { kind: 'say', who: 'yu', text: 'b' },
    ];
    await run(s, env(script), r);
    expect(s.ip).toBe(script.length);
  });

  it('快进开启时长时间等待被钳制（Review Focus #4）', async () => {
    const r = new FakeRenderer();
    r.delays = { me: 5000, msg: 5000, sys: 5000, note: 5000, card: 5000, fast: true };
    const t0 = Date.now();
    await run(fresh(), env([{ kind: 'card', who: 'yu' }]), r);
    expect(Date.now() - t0).toBeLessThan(300);
  });

  it('快进关闭时按配置的时长等待', async () => {
    const r = new FakeRenderer();
    r.delays = { me: 0, msg: 0, sys: 0, note: 0, card: 120, fast: false };
    const t0 = Date.now();
    await run(fresh(), env([{ kind: 'card', who: 'yu' }]), r);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });
});
