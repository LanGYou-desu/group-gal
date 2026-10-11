import type { RouteMap, RouteMapNode } from '../engine/route-map';
import type { SessionProgress } from '../engine/types';
import { BEDATA } from '../content/endings';

/**
 * 路线图面板。**缩进树而非 SVG 布局**——从 entry 开始 DFS，
 * 遇到已经展示过的 label 就渲染成「↩ 回到 XXX」引用而不再展开。
 * 这是处理剧本里那些环（hub 回到自己、支线绕回 hub）的关键：
 * 每个 label 至多展开一次，DFS 必然终止。
 *
 * 所有来自剧本 / 结局数据的文本一律走 textContent，绝不拼 innerHTML。
 */
export interface RouteMapHandlers {
  /** 点击一个已达的关键节点，请求跳转过去 */
  onJump(label: string): void;
}

const KIND_LABEL: Record<RouteMapNode['kind'], string> = {
  choice: '抉择',
  hub: '枢纽',
  be: '坏结局',
  end: '结局',
  scene: '场景',
};

/** 坏结局节点的标题用 BEDATA 里的正式名称，比 label（BE01）可读。 */
function titleOf(node: RouteMapNode): string {
  if (node.kind === 'be') {
    const be = BEDATA[node.label as keyof typeof BEDATA];
    if (be) return be.title;
  }
  return node.title;
}

export function renderRouteMap(
  host: HTMLElement,
  map: RouteMap,
  progress: SessionProgress,
  handlers: RouteMapHandlers,
): void {
  host.innerHTML = '';

  /** 已经展开过的 label——再次遇到就渲染成引用。 */
  const shown = new Set<string>();

  function refEl(label: string, title: string, depth = 0): HTMLElement {
    const el = document.createElement('div');
    el.className = 'rm-ref';
    el.dataset['ref'] = label;
    el.style.setProperty('--rm-depth', String(depth));
    el.textContent = `↩ 回到 ${title}`;
    return el;
  }

  /**
   * 把节点**扁平收集**而不是互相嵌套。
   *
   * 这是踩过坑才定下来的：缩进若靠嵌套 DOM 的 margin 实现，宽度会沿父子链
   * 一起缩小（子节点的包含块是父节点的内容盒），38 个节点、最深 11 层的链
   * 到叶子就只剩 0px。扁平化后所有节点的包含块都是面板本身，
   * 缩进只由各自的 `--rm-depth` 决定，宽度不再被父级吃掉。
   */
  const flat: HTMLElement[] = [];

  function renderLabel(label: string, depth: number): void {
    const node = map.nodes[label];
    if (!node) return;

    // 未到达的节点不显示——路线图只呈现你真正走过的路，不剧透没玩到的分支。
    // 同时也不再从这里往下展开，所以整棵未探索的子树都会被跳过。
    if (progress.visited[label] !== true) return;

    if (shown.has(label)) { flat.push(refEl(label, titleOf(node), depth)); return; }
    shown.add(label);

    // 能走到这里说明已到达，因此关键节点都可点击跳转
    const clickable = node.kind === 'choice' || node.kind === 'hub';

    const el = document.createElement('div');
    el.className = 'rm-node';
    el.dataset['label'] = label;
    el.dataset['kind'] = node.kind;
    el.dataset['visited'] = 'true';
    // 把**绝对深度**交给 CSS。缩进若靠嵌套 margin 累加会失控：
    // 剧本是一条长链（最深 11 层），累加会把 380px 的面板吃光、压成一行一个字。
    // CSS 侧用 min() 封顶，缩进在深层自然饱和。
    el.style.setProperty('--rm-depth', String(depth));

    /* ---- 表头：可点的关键节点是 button，其余是 div ---- */
    const head = document.createElement(clickable ? 'button' : 'div');
    head.className = 'rm-head';
    if (clickable) {
      (head as HTMLButtonElement).type = 'button';
      head.dataset['jump'] = label;
      head.addEventListener('click', () => handlers.onJump(label));
    }

    const kind = document.createElement('span');
    kind.className = 'rm-kind';
    kind.textContent = KIND_LABEL[node.kind];
    head.appendChild(kind);

    const title = document.createElement('span');
    title.className = 'rm-title';
    title.textContent = titleOf(node);
    head.appendChild(title);

    const flag = document.createElement('span');
    flag.className = 'rm-flag';
    flag.textContent = '已达';
    head.appendChild(flag);

    el.appendChild(head);

    /* ---- 选项（带去向 + 该去向是否已达） ---- */
    if (node.choices.length > 0) {
      const list = document.createElement('div');
      list.className = 'rm-choices';
      for (const c of node.choices) {
        const row = document.createElement('div');
        row.className = 'rm-choice';
        row.dataset['goto'] = c.goto;
        if (progress.visited[c.goto]) row.dataset['reached'] = 'true';

        const opt = document.createElement('span');
        opt.className = 'rm-opt';
        opt.textContent = c.label;
        row.appendChild(opt);

        // 去向显示**目的地的可读标题**而不是内部 label 名——
        // 「→ s_mc2」对玩家没有意义，「→ 看看农场」才有。
        const arrow = document.createElement('span');
        arrow.className = 'rm-arrow';
        const dest = map.nodes[c.goto];
        const reached = progress.visited[c.goto] === true;
        // 玩家在那个抉择点确实看过这个选项（不算剧透），但它通向哪里、
        // 如果还没走到就不该提前说出来。
        arrow.textContent = reached && dest ? `→ ${titleOf(dest)}` : '→ ?';
        row.appendChild(arrow);

        list.appendChild(row);
      }
      el.appendChild(list);
    }

    /* ---- 子节点：分支点展开所有选项去向，其余展开单后继 ---- */
    const targets = node.choices.length > 0
      ? node.choices.map(c => c.goto)
      : (node.next ? [node.next] : []);

    flat.push(el);
    for (const t of targets) renderLabel(t, depth + 1);
  }

  renderLabel(map.entry, 0);

  const root = document.createElement('div');
  root.className = 'rm-root';
  for (const el of flat) root.appendChild(el);
  host.appendChild(root);
}
