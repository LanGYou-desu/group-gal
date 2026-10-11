// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountShell } from '../src/ui/shell';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  root.id = 'app';
  document.body.appendChild(root);
});

describe('UI 外壳', () => {
  it('建出全部关键元素', () => {
    const s = mountShell(root);
    expect(s.chat.id).toBe('chat');
    expect(s.composer.id).toBe('composer');
    expect(s.drList.id).toBe('drList');
    expect(s.ovCard.id).toBe('ovCard');
    expect(s.title.id).toBe('title');
    expect(s.game.id).toBe('game');
    expect(s.btnStart.textContent).toBe('开始游戏');
  });

  it('class 名与现状一致（供 CSS 无改动迁移）', () => {
    mountShell(root);
    for (const sel of [
      '.screen', '.topbar', '.chat', '.composer', '.drawer', '.overlay',
      '.btn.primary', '.mini', '.t-kicker', '.tb-meta', '.dr-list',
    ]) {
      expect(document.querySelector(sel), `缺少 ${sel}`).not.toBeNull();
    }
  });

  it('游戏界面初始隐藏，标题界面可见', () => {
    const s = mountShell(root);
    expect(s.game.classList.contains('hidden')).toBe(true);
    expect(s.title.classList.contains('hidden')).toBe(false);
  });

  it('弹窗初始隐藏', () => {
    const s = mountShell(root);
    expect(s.overlay.classList.contains('hidden')).toBe(true);
  });

  it('文案与源文件逐字一致', () => {
    mountShell(root);
    expect(document.querySelector('.t-sub')!.textContent).toBe('全 群 攻 陷 计 划');
    expect(document.querySelector('.t-tag')!.textContent).toBe('—— 第 81 位群友的攻略日志 ——');
    expect(document.querySelector('.t-foot')!.textContent).toBe('单文件可玩 · 无需联网 · 内置合成 BGM');
    expect(document.querySelector('h1')!.textContent).toBe('😂群聊');
  });

  it('顶栏包含四个工具按钮', () => {
    mountShell(root);
    const ids = [...document.querySelectorAll('.tb-right .mini')].map(b => b.id);
    expect(ids).toEqual(['btnMembers', 'btnRepeat', 'btnFast', 'btnBgm']);
  });

  it('重复挂载不会残留旧节点', () => {
    mountShell(root);
    mountShell(root);
    expect(document.querySelectorAll('#chat')).toHaveLength(1);
    expect(document.querySelectorAll('#app > #title')).toHaveLength(1);
  });
});
