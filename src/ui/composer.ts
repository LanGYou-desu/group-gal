import type { ChoiceOption, HubOption } from '../engine/types';

/**
 * 选项与枢纽按钮。逐字搬运自 group-chat-galgame.html:737-751（renderChoice）
 * 与 :752-767（renderHub）。
 *
 * 与现状的关键差异：**hub 的 once 过滤由引擎完成**，这里收到的已经是可用选项，
 * 因此索引与引擎侧天然一致。现状是在渲染时才过滤，这也是「用按钮文字当去重键」
 * 那个缺陷的温床——现在去重键是稳定 id，改文案不再丢进度。
 *
 * 按钮文字用 textContent 设置，不解析 HTML。
 */
export interface Composer {
  /** 渲染选项，返回被选中项的下标 */
  askChoice(prompt: string, options: readonly ChoiceOption[]): Promise<number>;
  /** 渲染枢纽选项（已由引擎过滤掉已触发的 once 项） */
  askHub(prompt: string, options: readonly HubOption[]): Promise<number>;
  /** 渲染等待态 */
  idle(): void;
}

export function createComposer(host: HTMLElement): Composer {
  const idle = (): void => {
    host.innerHTML = '<div class="c-idle">……</div>';
  };

  function render(
    prompt: string,
    entries: readonly { label: string; pick: () => void }[],
  ): void {
    host.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'c-prompt';
    p.textContent = prompt;
    host.appendChild(p);

    for (const e of entries) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = e.label;
      b.onclick = () => { idle(); e.pick(); };
      host.appendChild(b);
    }
  }

  function ask<T extends { label: string }>(
    prompt: string,
    options: readonly T[],
  ): Promise<number> {
    return new Promise(resolve => {
      render(prompt, options.map((o, i) => ({ label: o.label, pick: () => resolve(i) })));
    });
  }

  return {
    idle,
    askChoice: (prompt, options) => ask(prompt, options),
    askHub: (prompt, options) => ask(prompt, options),
  };
}
