// 样式按块拆分的引入顺序会影响层叠，保持与源文件中的先后一致
import './styles/tokens.css';
import './styles/title.css';
import './styles/chat.css';
import './styles/chrome.css';

import { mountShell } from './ui/shell';
import { createChatView } from './ui/chat';
import { createComposer } from './ui/composer';
import { createOverlay } from './ui/overlay';
import { createToasts } from './ui/toasts';
import { createRenderer } from './ui/renderer';
import { renderMembers } from './ui/drawer';
import { CHARS } from './content/characters';
import { LABELS, SCRIPT } from './content/chapters';
import { BEDATA } from './content/endings';
import { applyRepeat, createInitialState } from './engine/effects';
import { run } from './engine/runner';
import { BGM } from './audio/bgm';
import type { DelayPolicy, Session } from './engine/types';

const root = document.getElementById('app');
if (!root) throw new Error('缺少挂载点 #app');

const shell = mountShell(root);
const chat = createChatView(shell.chat, shell.stageSil, CHARS);
const composer = createComposer(shell.composer);
const overlay = createOverlay(shell.overlay, shell.ovCard, CHARS);
const toasts = createToasts(shell.toasts);

/**
 * 可变对象，直接交给 Renderer 持有。快进开关改 fast 字段即可实时生效
 * ——因为 runner 每次等待前都读一次 delays.fast。
 * 默认值与现状 group-chat-galgame.html 的计时一致。
 */
const delays: DelayPolicy = { me: 280, msg: 520, sys: 560, note: 680, card: 760, fast: false };

const renderer = createRenderer({ chat, composer, overlay, toasts, delays });
const env = { script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA };

let session: Session = { state: createInitialState(), ip: 0, history: [] };
let running = false;

function updateTop(): void {
  shell.mCount.textContent = String(session.state.members);
  shell.mWater.textContent = String(session.state.water);
}

async function startGame(): Promise<void> {
  shell.title.classList.add('hidden');
  shell.game.classList.remove('hidden');

  session = { state: createInitialState(), ip: 0, history: [] };
  chat.clear();
  composer.idle();
  updateTop();
  renderMembers(shell.drList, CHARS, session.state);

  // 快进回到默认关闭：新开一局不继承上一局的加速状态
  delays.fast = false;
  shell.btnFast.textContent = '快进';

  BGM.set('chat');
  BGM.start('chat');

  running = true;
  try {
    await run(session, env, renderer);
  } finally {
    running = false;
  }
}

function backToTitle(): void {
  overlay.close();
  shell.game.classList.add('hidden');
  shell.title.classList.remove('hidden');
  shell.stageSil.innerHTML = '';
  running = false;
}

overlay.onRestart = () => { void startGame(); };
overlay.onBackToTitle = backToTitle;

shell.btnStart.onclick = () => { BGM.start('chat'); void startGame(); };

shell.btnAbout.onclick = () => overlay.showAbout(() => { void startGame(); });

shell.btnBgmTitle.onclick = () => {
  const on = BGM.toggle();
  shell.btnBgmTitle.textContent = '🔊 音乐：' + (on ? '开' : '关');
};

shell.btnBgm.onclick = () => {
  const on = BGM.toggle();
  shell.btnBgm.textContent = on ? '🔊' : '🔇';
};

shell.btnMembers.onclick = () => {
  renderMembers(shell.drList, CHARS, session.state);
  shell.drawer.classList.add('open');
};

shell.btnCloseDr.onclick = () => shell.drawer.classList.remove('open');

shell.btnFast.onclick = () => {
  delays.fast = !delays.fast;
  shell.btnFast.textContent = delays.fast ? '快进:开' : '快进';
  toasts.toast(delays.fast ? '已开启快进' : '已关闭快进');
};

/**
 * 复读。逻辑全在 applyRepeat（就地推进 session，可测试），
 * 这里只负责展示与 BE24 分支。
 *
 * ⚠️ 不要写成 `session = result.session`——run() 持有的是同一个对象引用，
 * 重新赋值会让两侧永久分叉（复读读到冻结的历史、抽屉与结局面板显示过期数值）。
 * 已有 tests/main.test.ts 钉住这一点。
 */
shell.btnRepeat.onclick = () => {
  if (!running) { toasts.toast('还没有可以复读的消息'); return; }

  const result = applyRepeat(session);
  if (result.outcome === 'empty' || result.spoken === undefined) {
    toasts.toast('还没有可以复读的消息');
    return;
  }

  chat.say('me', result.spoken);
  updateTop();

  if (result.outcome === 'banned') {
    BGM.set('tension');
    overlay.showBE('BE24');
    return;
  }
  if (result.outcome === 'warn') toasts.toast('再复读一次 要被禁言了');
  else toasts.toast('复读成功  +1 水群值');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    shell.drawer.classList.remove('open');
    overlay.close();
  }
});

renderMembers(shell.drList, CHARS, session.state);
