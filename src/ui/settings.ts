import type { DelayPolicy } from '../engine/types';
import { DEFAULT_SETTINGS, type SettingsData, type TextSpeed } from './storage';

/**
 * 设置面板。同样是内联二次确认，不用 `confirm()`。
 *
 * 注意设置与**快进**是两回事：文字速度是持久化的偏好，
 * 而快进是临时的、每局重置（阶段 1 已定，见 main.ts 的 startGame）。
 */
export interface SettingsHandlers {
  onChange(next: SettingsData): void;
  onClearSaves(): void;
}

/** 速度 → 计时。normal 必须与阶段 1 的现状默认值逐项一致，不改动既有节奏。 */
const SPEED_DELAYS: Record<TextSpeed, Pick<DelayPolicy, 'me' | 'msg' | 'sys' | 'note' | 'card'>> = {
  slow:   { me: 420, msg: 780, sys: 840, note: 1020, card: 1140 },
  normal: { me: 280, msg: 520, sys: 560, note: 680,  card: 760 },
  fast:   { me: 140, msg: 260, sys: 280, note: 340,  card: 380 },
};

export function delaysForSpeed(
  speed: TextSpeed,
): Pick<DelayPolicy, 'me' | 'msg' | 'sys' | 'note' | 'card'> {
  return SPEED_DELAYS[speed];
}

const SPEED_LABEL: Record<TextSpeed, string> = { slow: '慢', normal: '普通', fast: '快' };
const SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast'];

export function renderSettings(
  host: HTMLElement,
  current: SettingsData,
  handlers: SettingsHandlers,
): void {
  let confirmingClear = false;

  function draw(): void {
    host.innerHTML = '';

    /* ---- BGM ---- */
    const bgmRow = document.createElement('label');
    bgmRow.className = 'set-row';

    const bgm = document.createElement('input');
    bgm.type = 'checkbox';
    bgm.checked = current.bgm;
    bgm.dataset['setting'] = 'bgm';
    bgm.addEventListener('change', () => {
      current = { ...current, bgm: bgm.checked };
      handlers.onChange(current);
    });

    const bgmText = document.createElement('span');
    bgmText.textContent = '背景音乐';
    bgmRow.append(bgm, bgmText);
    host.appendChild(bgmRow);

    /* ---- 文字速度 ---- */
    const speedRow = document.createElement('div');
    speedRow.className = 'set-row';

    const speedLabel = document.createElement('span');
    speedLabel.textContent = '文字速度';
    speedRow.appendChild(speedLabel);

    const group = document.createElement('div');
    group.className = 'set-speeds';
    for (const s of SPEEDS) {
      const b = document.createElement('button');
      b.className = 'mini';
      b.textContent = SPEED_LABEL[s];
      b.dataset['speed'] = s;
      b.setAttribute('aria-pressed', String(current.speed === s));
      b.addEventListener('click', () => {
        current = { ...current, speed: s };
        handlers.onChange(current);
        draw();
      });
      group.appendChild(b);
    }
    speedRow.appendChild(group);
    host.appendChild(speedRow);

    /* ---- 说明 ---- */
    const hint = document.createElement('p');
    hint.className = 'set-hint';
    hint.textContent = '「快进」是临时开关，每局重新开始时自动关闭，与这里的设置无关。';
    host.appendChild(hint);

    /* ---- 清除存档 ---- */
    const danger = document.createElement('div');
    danger.className = 'set-row';

    if (confirmingClear) {
      const q = document.createElement('span');
      q.textContent = '确认清除全部存档？此操作不可撤销。';
      danger.appendChild(q);

      const yes = document.createElement('button');
      yes.className = 'mini danger';
      yes.textContent = '确认清除';
      yes.dataset['action'] = 'clear-confirm';
      yes.addEventListener('click', () => {
        confirmingClear = false;
        handlers.onClearSaves();
        draw();
      });
      danger.appendChild(yes);

      const no = document.createElement('button');
      no.className = 'mini';
      no.textContent = '取消';
      no.dataset['action'] = 'clear-cancel';
      no.addEventListener('click', () => { confirmingClear = false; draw(); });
      danger.appendChild(no);
    } else {
      const btn = document.createElement('button');
      btn.className = 'mini danger';
      btn.textContent = '清除全部存档';
      btn.dataset['action'] = 'clear';
      btn.addEventListener('click', () => { confirmingClear = true; draw(); });
      danger.appendChild(btn);
    }

    host.appendChild(danger);
  }

  draw();
}

export { DEFAULT_SETTINGS };
