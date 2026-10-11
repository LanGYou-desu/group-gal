/**
 * UI 外壳：建出与现状 group-chat-galgame.html:147-187 逐字一致的 DOM 结构。
 *
 * **结构与 class 名必须保持原样**——阶段 1 的样式才能整体迁移，
 * 并支持与旧版肉眼并排比对。视觉重做留到阶段 3。
 *
 * 这里的 innerHTML 是静态字面量，不含任何外部数据；
 * 来自剧本或角色的文本一律经 chat.ts 的 esc() 转义后再拼入。
 */
export interface Shell {
  readonly title: HTMLElement;
  readonly game: HTMLElement;
  readonly chat: HTMLElement;
  readonly composer: HTMLElement;
  readonly drawer: HTMLElement;
  readonly drList: HTMLElement;
  readonly overlay: HTMLElement;
  readonly ovCard: HTMLElement;
  readonly toasts: HTMLElement;
  readonly stageSil: HTMLElement;
  readonly panel: HTMLElement;
  readonly panelTitle: HTMLElement;
  readonly panelBody: HTMLElement;
  readonly mCount: HTMLElement;
  readonly mWater: HTMLElement;
  readonly btnStart: HTMLButtonElement;
  readonly btnAbout: HTMLButtonElement;
  readonly btnBgmTitle: HTMLButtonElement;
  readonly btnMembers: HTMLButtonElement;
  readonly btnCloseDr: HTMLButtonElement;
  readonly btnBacklog: HTMLButtonElement;
  readonly btnSaves: HTMLButtonElement;
  readonly btnSettings: HTMLButtonElement;
  readonly btnPanelClose: HTMLButtonElement;
  readonly btnRepeat: HTMLButtonElement;
  readonly btnFast: HTMLButtonElement;
  readonly btnBgm: HTMLButtonElement;
}

const SHELL_HTML = `
  <div id="title" class="screen">
    <div class="t-kicker">GALGAME DEMO · 恋爱模拟 ADV</div>
    <h1><span class="t-emoji">😂</span>群聊</h1>
    <div class="t-sub">全 群 攻 陷 计 划</div>
    <p class="t-tag">—— 第 81 位群友的攻略日志 ——</p>
    <div class="t-btns">
      <button id="btnStart" class="btn primary">开始游戏</button>
      <button id="btnBgmTitle" class="btn">🔊 音乐：开</button>
      <button id="btnAbout" class="btn">关于 / 素材</button>
    </div>
    <div class="t-foot">单文件可玩 · 无需联网 · 内置合成 BGM</div>
  </div>

  <div id="game" class="screen hidden">
    <div class="topbar">
      <div class="tb-left">
        <div class="tb-title">😂群聊</div>
        <div class="tb-meta">成员 <b id="mCount">81</b> · 水群值 <b id="mWater">0</b></div>
      </div>
      <div class="tb-right">
        <button id="btnMembers" class="mini">群成员</button>
        <button id="btnBacklog" class="mini">回想</button>
        <button id="btnSaves" class="mini">存档</button>
        <button id="btnSettings" class="mini">设置</button>
        <button id="btnRepeat" class="mini">复读</button>
        <button id="btnFast" class="mini">快进</button>
        <button id="btnBgm" class="mini">🔊</button>
      </div>
    </div>
    <div id="chat" class="chat" role="log" aria-live="polite" aria-label="群聊消息"></div>
    <div id="composer" class="composer"><div class="c-idle">正在加载群聊……</div></div>
  </div>

  <div id="stageSil"></div>
  <div id="toasts"></div>

  <div id="drawer" class="drawer">
    <div class="dr-h"><b>群成员</b><button class="mini" id="btnCloseDr">关闭</button></div>
    <div class="dr-list" id="drList"></div>
  </div>

  <div id="panel" class="drawer">
    <div class="dr-h"><b id="panelTitle">面板</b><button class="mini" id="btnPanelClose">关闭</button></div>
    <div class="dr-list" id="panelBody"></div>
  </div>

  <div id="overlay" class="overlay hidden"><div class="ov" id="ovCard"></div></div>
`;

export function mountShell(root: HTMLElement): Shell {
  root.innerHTML = SHELL_HTML;

  const need = <T extends HTMLElement>(id: string): T => {
    const el = root.querySelector<T>(`#${id}`);
    if (!el) throw new Error(`外壳缺少元素 #${id}`);
    return el;
  };

  return {
    title: need('title'), game: need('game'), chat: need('chat'), composer: need('composer'),
    drawer: need('drawer'), drList: need('drList'), overlay: need('overlay'),
    ovCard: need('ovCard'), toasts: need('toasts'), stageSil: need('stageSil'),
    panel: need('panel'), panelTitle: need('panelTitle'), panelBody: need('panelBody'),
    mCount: need('mCount'), mWater: need('mWater'),
    btnStart: need<HTMLButtonElement>('btnStart'),
    btnAbout: need<HTMLButtonElement>('btnAbout'),
    btnBgmTitle: need<HTMLButtonElement>('btnBgmTitle'),
    btnMembers: need<HTMLButtonElement>('btnMembers'),
    btnCloseDr: need<HTMLButtonElement>('btnCloseDr'),
    btnBacklog: need<HTMLButtonElement>('btnBacklog'),
    btnSaves: need<HTMLButtonElement>('btnSaves'),
    btnSettings: need<HTMLButtonElement>('btnSettings'),
    btnPanelClose: need<HTMLButtonElement>('btnPanelClose'),
    btnRepeat: need<HTMLButtonElement>('btnRepeat'),
    btnFast: need<HTMLButtonElement>('btnFast'),
    btnBgm: need<HTMLButtonElement>('btnBgm'),
  };
}
