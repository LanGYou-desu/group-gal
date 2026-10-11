// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from '../src/ui/renderer';
import type { ChatView } from '../src/ui/chat';
import type { Composer } from '../src/ui/composer';
import type { Overlay } from '../src/ui/overlay';
import type { Toasts } from '../src/ui/toasts';
import type { DelayPolicy } from '../src/engine/types';

const delays: DelayPolicy = { me: 1, msg: 2, sys: 3, note: 4, card: 5, fast: false };

function harness() {
  const chat: ChatView = {
    say: vi.fn(), sys: vi.fn(), note: vi.fn(), card: vi.fn(), clear: vi.fn(),
  };
  const composer = {
    askChoice: vi.fn(async () => 1),
    askHub: vi.fn(async () => 0),
    idle: vi.fn(),
  } as unknown as Composer;
  const overlay = {
    showBE: vi.fn(), showEnding: vi.fn(), showAbout: vi.fn(),
    close: vi.fn(), isOpen: () => false,
    onRestart: () => {}, onBackToTitle: () => {},
  } as unknown as Overlay;
  const toasts = { toast: vi.fn(), affToast: vi.fn() } as unknown as Toasts;

  return { chat, composer, overlay, toasts, r: createRenderer({ chat, composer, overlay, toasts, delays }) };
}

describe('Renderer 装配', () => {
  it('透出传入的等待策略', () => {
    expect(harness().r.delays).toBe(delays);
  });

  it('say/sys/note/card 转发到聊天流', async () => {
    const { chat, r } = harness();
    await r.say('yu', '嗨');
    await r.sys('入群');
    await r.note('旁白');
    await r.card('nanao');
    expect(chat.say).toHaveBeenCalledWith('yu', '嗨');
    expect(chat.sys).toHaveBeenCalledWith('入群');
    expect(chat.note).toHaveBeenCalledWith('旁白');
    expect(chat.card).toHaveBeenCalledWith('nanao');
  });

  it('askChoice / askHub 转发到选项区', async () => {
    const { composer, r } = harness();
    await expect(r.askChoice('p', [{ label: 'A', goto: 'x' }])).resolves.toBe(1);
    await expect(r.askHub('q', [{ id: 'i', label: 'B', goto: 'x' }])).resolves.toBe(0);
    expect(composer.askChoice).toHaveBeenCalledOnce();
    expect(composer.askHub).toHaveBeenCalledOnce();
  });

  it('affToast 把角色表一起交给浮层（用于显示角色名）', () => {
    const { toasts, r } = harness();
    r.affToast([{ who: 'nanao', delta: 2 }]);
    expect(toasts.affToast).toHaveBeenCalledWith([{ who: 'nanao', delta: 2 }], expect.anything());
    const chars = (toasts.affToast as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![1];
    expect(chars).toHaveProperty('nanao.name', '闹七');
  });

  it('toast 转发普通提示', () => {
    const { toasts, r } = harness();
    r.toast('复读成功');
    expect(toasts.toast).toHaveBeenCalledWith('复读成功');
  });

  it('showBE 展示 BE 弹窗', async () => {
    const { overlay, r } = harness();
    await r.showBE('BE01');
    expect(overlay.showBE).toHaveBeenCalledWith('BE01');
  });

  it('showEnding 把引擎判定结果原样交给弹窗', async () => {
    const { overlay, r } = harness();
    const session = { state: null, ip: 0, history: [] } as never;
    await r.showEnding({ kind: 'route', key: 'yu' }, session);
    expect(overlay.showEnding).toHaveBeenCalledWith({ kind: 'route', key: 'yu' }, session);
  });

  it('bgm 切换不抛错（无 AudioContext 环境安全降级）', () => {
    expect(() => harness().r.bgm('night')).not.toThrow();
  });
});
