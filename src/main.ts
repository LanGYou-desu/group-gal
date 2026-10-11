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
import { renderBacklog } from './ui/backlog';
import { renderSaves } from './ui/saves';
import { delaysForSpeed, renderSettings } from './ui/settings';
import {
  AUTOSAVE_ID, SAVE_SLOTS, deleteSlot, listSlots, readSettings, readSlot,
  writeSettings, writeSlot, type SaveSlotId, type SettingsData,
} from './ui/storage';
import { CHARS } from './content/characters';
import { LABELS, SCRIPT } from './content/chapters';
import { BEDATA } from './content/endings';
import { applyRepeat, createInitialState } from './engine/effects';
import { run } from './engine/runner';
import { BGM } from './audio/bgm';
import type { DelayPolicy, LogEntry, Node, Session } from './engine/types';

const root = document.getElementById('app');
if (!root) throw new Error('缺少挂载点 #app');

const shell = mountShell(root);
const chat = createChatView(shell.chat, shell.stageSil, CHARS);
const composer = createComposer(shell.composer);
const overlay = createOverlay(shell.overlay, shell.ovCard, CHARS);
const toasts = createToasts(shell.toasts);

let settings: SettingsData = readSettings();

/**
 * 可变对象，直接交给 Renderer 持有：runner 每次等待前都读一次 `fast`，
 * 所以快进能即时生效。**文字速度**来自设置（持久化），
 * **快进**是临时开关、每局重置——两者不可混淆。
 */
const delays: DelayPolicy = { ...delaysForSpeed(settings.speed), fast: false };

const renderer = createRenderer({ chat, composer, overlay, toasts, delays });

/** 当前局的代号。读档时自增，用来作废仍在跑的那个 run。 */
let runToken = 0;
let running = false;

/** 就地替换 session 的内容——**不能重新赋值**，run() 持有的是同一个对象引用。 */
let session: Session = { state: createInitialState(), ip: 0, history: [] };

function updateTop(): void {
  shell.mCount.textContent = String(session.state.members);
  shell.mWater.textContent = String(session.state.water);
}

/** 把历史重放进聊天流（读档后恢复现场）。 */
function replayHistory(history: readonly LogEntry[]): void {
  chat.clear();
  for (const e of history) {
    if (e.kind === 'say') chat.say(e.who, e.text);
    else if (e.kind === 'sys') chat.sys(e.text);
    else chat.note(e.text);
  }
}

/** 当前局停在的那个选择节点的下标；不在选择点时是 null。 */
let pendingChoiceIp: number | null = null;

/**
 * 存档快照。
 *
 * ⚠️ 不能直接用 `session.ip`：runner 在调用 `askChoice` **之前**就已经把 ip 推进过了，
 * 所以玩家停在选择点时 `session.ip` 指向的是**选择之后**的节点，直接存会导致
 * 读档跳过那个选择（Review Focus #2）。这里把指针拨回选择本身。
 */
function snapshotSession(): Session {
  return {
    state: session.state,
    ip: pendingChoiceIp ?? session.ip,
    history: session.history,
  };
}

async function startRun(): Promise<void> {
  const token = ++runToken;
  running = true;
  try {
    await run(session, {
      script: SCRIPT, labels: LABELS, chars: CHARS, beData: BEDATA,
      onNode: (ip, node: Node) => {
        if (node.kind === 'choice' || node.kind === 'hub') {
          pendingChoiceIp = ip;
          writeSlot(AUTOSAVE_ID, snapshotSession());
        } else {
          pendingChoiceIp = null;
        }
      },
      shouldStop: () => token !== runToken,
    }, renderer);
  } finally {
    if (token === runToken) running = false;
  }
}

function syncBgmButton(): void {
  shell.btnBgm.textContent = BGM.isOn() ? '🔊' : '🔇';
  shell.btnBgmTitle.textContent = '🔊 音乐：' + (BGM.isOn() ? '开' : '关');
}

function applySettings(next: SettingsData): void {
  settings = next;
  writeSettings(next);
  Object.assign(delays, delaysForSpeed(next.speed)); // 只覆盖计时，不动 fast
  BGM.setOn(next.bgm);
  syncBgmButton();
}

async function startGame(): Promise<void> {
  shell.title.classList.add('hidden');
  shell.game.classList.remove('hidden');

  runToken++;                                   // 作废上一局
  pendingChoiceIp = null;
  session.state = createInitialState();
  session.ip = 0;
  session.history = [];
  chat.clear();
  composer.idle();
  updateTop();
  renderMembers(shell.drList, CHARS, session.state);

  // 快进回到默认关闭：新开一局不继承上一局的加速状态
  delays.fast = false;
  shell.btnFast.textContent = '快进';

  Object.assign(delays, delaysForSpeed(settings.speed));
  BGM.setOn(settings.bgm);
  BGM.set('chat');
  BGM.start('chat');

  await startRun();
}

function backToTitle(): void {
  overlay.close();
  closePanel();
  shell.game.classList.add('hidden');
  shell.title.classList.remove('hidden');
  shell.stageSil.innerHTML = '';
  runToken++;                                   // 作废仍在跑的 run
  running = false;
}

/** 读档：就地替换内容、重放历史、从存档点续跑。 */
function loadSession(loaded: Session): void {
  runToken++;                                   // 先作废当前 run
  pendingChoiceIp = null;

  session.state = loaded.state;
  session.ip = loaded.ip;
  session.history = loaded.history;

  replayHistory(loaded.history);
  updateTop();
  renderMembers(shell.drList, CHARS, session.state);
  closePanel();

  shell.title.classList.add('hidden');
  shell.game.classList.remove('hidden');

  BGM.set('chat');
  void startRun();
}

/* ---------- 面板（回想 / 存档 / 设置共用） ---------- */

function openPanel(title: string, draw: (body: HTMLElement) => void): void {
  shell.panelTitle.textContent = title;
  shell.panelBody.innerHTML = '';
  shell.panel.classList.add('open');
  draw(shell.panelBody);
}

function closePanel(): void {
  shell.panel.classList.remove('open');
}

function openSavesPanel(): void {
  openPanel('存档', body => renderSaves(body, listSlots(), {
    onSave: id => { writeSlot(id, snapshotSession()); openSavesPanel(); },
    onLoad: id => {
      const loaded = readSlot(id);
      if (loaded) loadSession(loaded);
      else toasts.toast('这个存档读不出来');
    },
    onDelete: id => { deleteSlot(id); openSavesPanel(); },
  }));
}

function openSettingsPanel(): void {
  openPanel('设置', body => renderSettings(body, settings, {
    onChange: next => { applySettings(next); openSettingsPanel(); },
    onClearSaves: () => {
      const all: readonly SaveSlotId[] = [AUTOSAVE_ID, ...SAVE_SLOTS];
      for (const id of all) deleteSlot(id);
      toasts.toast('已清除全部存档');
      openSettingsPanel();
    },
  }));
}

/* ---------- 接线 ---------- */

overlay.onRestart = () => { void startGame(); };
overlay.onBackToTitle = backToTitle;

shell.btnStart.onclick = () => { BGM.start('chat'); void startGame(); };
shell.btnAbout.onclick = () => overlay.showAbout(() => { void startGame(); });

shell.btnBgmTitle.onclick = () => { applySettings({ ...settings, bgm: BGM.toggle() }); };
shell.btnBgm.onclick = () => { applySettings({ ...settings, bgm: BGM.toggle() }); };

shell.btnMembers.onclick = () => {
  renderMembers(shell.drList, CHARS, session.state);
  shell.drawer.classList.add('open');
};
shell.btnCloseDr.onclick = () => shell.drawer.classList.remove('open');

shell.btnBacklog.onclick = () => {
  openPanel('回想', body => renderBacklog(body, session.history, CHARS));
};
shell.btnSaves.onclick = openSavesPanel;
shell.btnSettings.onclick = openSettingsPanel;
shell.btnPanelClose.onclick = closePanel;

shell.btnFast.onclick = () => {
  delays.fast = !delays.fast;
  shell.btnFast.textContent = delays.fast ? '快进:开' : '快进';
  toasts.toast(delays.fast ? '已开启快进' : '已关闭快进');
};

/**
 * 复读。逻辑全在 applyRepeat（就地推进 session，可测试），
 * 这里只负责展示与 BE24 分支。
 *
 * ⚠️ 不要写成 `session = result.session`——run() 持有的是同一个对象引用。
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
    closePanel();
    overlay.close();
  }
});

syncBgmButton();
renderMembers(shell.drList, CHARS, session.state);
