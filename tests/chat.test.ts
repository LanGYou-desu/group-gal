// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createChatView, esc } from '../src/ui/chat';
import { createToasts } from '../src/ui/toasts';
import { CHARS } from '../src/content/characters';

let chat: HTMLElement;
let sil: HTMLElement;
let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  chat = document.createElement('div');
  sil = document.createElement('div');
  host = document.createElement('div');
  document.body.append(chat, sil, host);
});

const view = () => createChatView(chat, sil, CHARS);

describe('聊天流 — 消息渲染', () => {
  it('他人消息带头像、角色名与角色定位', () => {
    view().say('yu', '新人 你玩机械动力吗');
    expect(chat.querySelector('.msg .nm')!.textContent).toContain('一条鱼');
    expect(chat.querySelector('.msg .nm .role')!.textContent).toBe('天然呆');
    expect(chat.querySelector('.msg .bub')!.textContent).toBe('新人 你玩机械动力吗');
  });

  it('他人消息的头像用主题色与角色 emoji', () => {
    view().say('yu', 'x');
    const av = chat.querySelector<HTMLElement>('.msg .av')!;
    expect(av.textContent).toBe('🐟');
    expect(av.getAttribute('style')).toContain('rgba(92,225,230,0.14)');
  });

  it('玩家消息用 me 类、无头像、无名字', () => {
    view().say('me', '🐱');
    const msg = chat.querySelector('.msg')!;
    expect(msg.classList.contains('me')).toBe(true);
    expect(msg.querySelector('.av')).toBeNull();
    expect(msg.querySelector('.nm')).toBeNull();
    expect(msg.querySelector('.bub')!.textContent).toBe('🐱');
  });

  it('系统消息渲染为居中胶囊', () => {
    view().sys('群成员 80 → 81');
    expect(chat.querySelector('.sys span')!.textContent).toBe('群成员 80 → 81');
  });

  it('旁白渲染为 note', () => {
    view().note('—— 群友情报 · 解锁 ——');
    expect(chat.querySelector('.note')!.textContent).toBe('—— 群友情报 · 解锁 ——');
  });

  it('消息按调用顺序追加', () => {
    const v = view();
    v.say('yu', '一');
    v.say('cat', '二');
    v.say('me', '三');
    expect([...chat.querySelectorAll('.msg .bub')].map(b => b.textContent))
      .toEqual(['一', '二', '三']);
  });
});

describe('聊天流 — 卡片与舞台立绘', () => {
  it('卡片渲染角色名、群名片、定位与简介', () => {
    view().card('shisuan');
    const card = chat.querySelector('.card')!;
    expect(card.querySelector('h4')!.textContent).toContain('石蒜');
    expect(card.querySelector('h4')!.textContent).toContain('我的父亲是根哥');
    expect(card.querySelector('.r')!.textContent).toBe('孤岛写谱人');
    expect(card.querySelector('p')!.textContent).toContain('社交渠道');
  });

  it('卡片内置 SVG 剪影', () => {
    view().card('yu');
    expect(chat.querySelector('.card .sil svg')).not.toBeNull();
  });

  it('卡片会更新舞台立绘', () => {
    view().card('shisuan');
    expect(sil.innerHTML).toContain('<svg');
    expect(sil.innerHTML).toContain('#8be08b');
  });

  it('clear 清空聊天流与舞台立绘', () => {
    const v = view();
    v.say('yu', 'x');
    v.card('yu');
    v.clear();
    expect(chat.innerHTML).toBe('');
    expect(sil.innerHTML).toBe('');
  });
});

describe('聊天流 — 转义（防注入）', () => {
  it('消息文本中的 HTML 被转义，不生成标签', () => {
    view().say('yu', '<img src=x onerror=alert(1)>');
    const bub = chat.querySelector('.bub')!;
    expect(bub.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(bub.querySelector('img')).toBeNull();
  });

  it('系统消息与旁白同样转义', () => {
    const v = view();
    v.sys('<b>x</b>');
    v.note('<i>y</i>');
    expect(chat.querySelector('.sys b')).toBeNull();
    expect(chat.querySelector('.note i')).toBeNull();
    expect(chat.querySelector('.sys span')!.textContent).toBe('<b>x</b>');
  });

  it('esc 转义四个危险字符', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('浮层', () => {
  it('正向好感显示 ❤ +N', () => {
    createToasts(host).affToast([{ who: 'nanao', delta: 2 }], CHARS);
    expect(host.querySelector('.toast')!.textContent).toBe('❤ 闹七 +2');
  });

  it('负向好感显示 💔 与负号', () => {
    createToasts(host).affToast([{ who: 'g', delta: -1 }], CHARS);
    expect(host.querySelector('.toast')!.textContent).toBe('💔 G -1');
  });

  it('多项好感合并成一条浮层，用全角空格分隔', () => {
    createToasts(host).affToast(
      [{ who: 'nanao', delta: 2 }, { who: 'yu', delta: 1 }], CHARS,
    );
    expect(host.querySelectorAll('.toast')).toHaveLength(1);
    expect(host.querySelector('.toast')!.textContent).toBe('❤ 闹七 +2　❤ 一条鱼 +1');
  });

  it('空数组不产生浮层', () => {
    createToasts(host).affToast([], CHARS);
    expect(host.querySelector('.toast')).toBeNull();
  });

  it('普通提示走同一条渲染路径', () => {
    createToasts(host).toast('复读成功  +1 水群值');
    expect(host.querySelector('.toast')!.textContent).toBe('复读成功  +1 水群值');
  });
});
