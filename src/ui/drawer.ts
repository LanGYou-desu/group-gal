import type { CharTable, GameState } from '../engine/types';
import { HERO_KEYS } from '../content/characters';
import { stageOf } from '../engine/effects';
import { esc, hex2rgba } from './chat';

/**
 * 群成员抽屉。逐字搬运自 group-chat-galgame.html:717-729。
 *
 * 好感度条宽度 = min(100, aff/8*100)；
 * 阶段文字由 stageOf 给出（无视 / 眼熟 / 嘴替 / 宝宝 / 沦陷）。
 * 末行是固定的助攻/反派占位（根哥 · aka · 蘑菇汤），不参与攻略。
 */
export function renderMembers(host: HTMLElement, chars: CharTable, state: GameState): void {
  const rows = HERO_KEYS.map(k => {
    const c = chars[k];
    const a = state.aff[k] ?? 0;
    const pct = Math.min(100, a / 8 * 100);
    return `<div class="dr-row">
      <div class="av" style="background:${hex2rgba(c.color, 0.14)};border-color:${hex2rgba(c.color, 0.4)}">${c.emoji}</div>
      <div class="dr-mid"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.role)}</div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="dr-stage">${stageOf(a)}</div></div>`;
  }).join('');

  host.innerHTML = rows + `<div class="dr-row" style="opacity:.7">
      <div class="av">🧑‍🔧</div><div class="dr-mid"><div class="t">根哥 · aka · 蘑菇汤</div>
      <div class="s">助攻 / 反派 · 暂未开放攻略</div></div></div>`;
}
