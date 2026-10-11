import type { CharKey, CharTable, Speaker } from '../engine/types';
import { sil } from './silhouettes';

/**
 * 聊天流渲染。逐字搬运自 group-chat-galgame.html:674-703 的
 * pushMsg / pushSys / pushNote / pushCard，以及 :667 scroll、:672 setStage。
 *
 * 与现状一致的行为细节：
 * - 他人消息：头像 + 角色名 + 角色定位 + 气泡；玩家消息：右侧渐变气泡，无头像
 * - 系统消息：居中胶囊；旁白：斜体居中
 * - 卡片：左立绘 + 右侧信息，并同步更新右下角舞台立绘
 *
 * 转义策略：所有来自剧本/角色的文本经 esc() 后拼入 innerHTML；
 * 消息正文用 textContent 直接赋值。剧本内容虽是本地数据，
 * 但保持转义可避免将来接入外部数据时留下注入面。
 */
export interface ChatView {
  say(who: Speaker, text: string): void;
  sys(text: string): void;
  note(text: string): void;
  card(who: CharKey): void;
  clear(): void;
}

export function createChatView(
  chat: HTMLElement,
  stageSil: HTMLElement,
  chars: CharTable,
): ChatView {
  const scroll = (): void => { chat.scrollTop = chat.scrollHeight; };

  const setStage = (key: CharKey | null): void => {
    stageSil.innerHTML = key ? sil(key, 520, chars) : '';
  };

  return {
    say(who, text) {
      const me = who === 'me';
      const c = me ? null : chars[who as CharKey];

      const wrap = document.createElement('div');
      wrap.className = 'msg' + (me ? ' me' : '');

      if (me || !c) {
        wrap.innerHTML = '<div class="body"><div class="bub"></div></div>';
      } else {
        wrap.innerHTML =
          `<div class="av" style="background:${hex2rgba(c.color, 0.14)};border-color:${hex2rgba(c.color, 0.4)}">${c.emoji}</div>
           <div class="body"><div class="nm">${esc(c.name)}<span class="role">${esc(c.role)}</span></div><div class="bub"></div></div>`;
      }

      wrap.querySelector('.bub')!.textContent = text;
      chat.appendChild(wrap);
      scroll();
    },

    sys(text) {
      const d = document.createElement('div');
      d.className = 'sys';
      d.innerHTML = `<span>${esc(text)}</span>`;
      chat.appendChild(d);
      scroll();
    },

    note(text) {
      const d = document.createElement('div');
      d.className = 'note';
      d.textContent = text;
      chat.appendChild(d);
      scroll();
    },

    card(who) {
      const c = chars[who];
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<div class="sil">${sil(who, 76, chars)}</div>
        <div class="cinfo"><h4>${esc(c.name)}<span style="font-size:11px;color:var(--dim)">${esc(c.sub)}</span></h4>
        <div class="r">${esc(c.role)}</div><p>${esc(c.desc)}</p></div>`;
      chat.appendChild(d);
      scroll();
      setStage(who);
    },

    clear() {
      chat.innerHTML = '';
      setStage(null);
    },
  };
}

/** 转义 HTML 文本与双引号属性上下文。源 :861。 */
export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string
  ));
}

/** #rrggbb 或 #rgb → rgba(r,g,b,a)。源 :862。 */
export function hex2rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
