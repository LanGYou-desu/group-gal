import type { CharTable, LogEntry } from '../engine/types';
import { esc } from './chat';

/**
 * 回想（backlog）。复用抽屉样式，把 `history` 渲染成可滚动的过往记录。
 *
 * 历史是引擎侧维护的 `Session.history`——阶段 1 把它从「只存在于 DOM」
 * 变成了可序列化的数据，这里正是它的第一个消费者。
 */
export function renderBacklog(
  host: HTMLElement,
  history: readonly LogEntry[],
  chars: CharTable,
): void {
  if (history.length === 0) {
    host.innerHTML = '<div class="c-idle">还没有可回想的内容</div>';
    return;
  }

  host.innerHTML = history.map(e => {
    if (e.kind === 'sys') {
      return `<div class="sys" data-log="sys"><span>${esc(e.text)}</span></div>`;
    }
    if (e.kind === 'note') {
      return `<div class="note" data-log="note">${esc(e.text)}</div>`;
    }
    if (e.who === 'me') {
      return `<div class="msg me" data-log="me"><div class="body">
        <div class="nm">我</div><div class="bub">${esc(e.text)}</div></div></div>`;
    }
    const c = chars[e.who];
    return `<div class="msg" data-log="say" style="--speaker:${c.color}"><div class="body">
      <div class="nm" style="color:${c.color}">${esc(c.name)}</div>
      <div class="bub">${esc(e.text)}</div></div></div>`;
  }).join('');

  // 默认定位到最后一条
  host.scrollTop = host.scrollHeight;
}
