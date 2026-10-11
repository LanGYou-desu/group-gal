import type { CharKey, FlagKey, GameState, LogEntry, Session, Speaker } from './types';
import { CHARS } from '../content/characters';
import { SCHEMA_VERSION } from './effects';

/**
 * 存档的序列化与**防御性**反序列化。
 *
 * 存档来自 localStorage —— 那是用户可随手编辑的地方，因此反序列化面对的是
 * **不可信输入**。本模块的契约：**任何畸形输入一律返回 null，绝不抛错、绝不污染原型**。
 * 游戏在任何情况下都不应因为一个坏存档而白屏。
 */

export const SAVE_VERSION = 1;

const CHAR_KEYS = Object.keys(CHARS) as CharKey[];
const FLAG_KEYS: readonly string[] = ['sheiTrap', 'mokuJoin', 'actGood', 'actSkip'];

/** 原型污染护栏：这些键一律拒绝。 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function serializeSession(s: Session): string {
  return JSON.stringify({ v: SAVE_VERSION, ip: s.ip, state: s.state, history: s.history });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function parseHistory(raw: unknown): LogEntry[] | null {
  if (!Array.isArray(raw)) return null;

  const out: LogEntry[] = [];
  for (const e of raw) {
    if (!isObj(e)) return null;

    if (e.kind === 'say') {
      if (typeof e.text !== 'string') return null;
      const who = e.who;
      if (who !== 'me' && (typeof who !== 'string' || !CHAR_KEYS.includes(who as CharKey))) return null;
      out.push({ kind: 'say', who: who as Speaker, text: e.text });
    } else if (e.kind === 'sys' || e.kind === 'note') {
      if (typeof e.text !== 'string') return null;
      out.push({ kind: e.kind, text: e.text });
    } else {
      return null;
    }
  }
  return out;
}

function parseState(raw: unknown): GameState | null {
  if (!isObj(raw)) return null;

  // aff：必须含全部角色键，值为有限非负数
  if (!isObj(raw.aff)) return null;
  const aff = {} as Record<CharKey, number>;
  for (const k of CHAR_KEYS) {
    const v = raw.aff[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    aff[k] = v;
  }

  // flags：只认已知标记，值必须是布尔
  if (!isObj(raw.flags)) return null;
  const flags: Partial<Record<FlagKey, boolean>> = {};
  for (const [k, v] of Object.entries(raw.flags)) {
    if (FORBIDDEN_KEYS.has(k) || !FLAG_KEYS.includes(k) || typeof v !== 'boolean') return null;
    flags[k as FlagKey] = v;
  }

  // hub：键是剧本里的选项 id，值必须是布尔
  if (!isObj(raw.hub)) return null;
  const hub: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw.hub)) {
    if (FORBIDDEN_KEYS.has(k) || typeof v !== 'boolean') return null;
    hub[k] = v;
  }

  if (!isNonNegInt(raw.water)) return null;
  if (!isNonNegInt(raw.members)) return null;
  if (!isNonNegInt(raw.repeatN)) return null;
  if (typeof raw.lastRepeat !== 'string') return null;

  return {
    schemaVersion: isNonNegInt(raw.schemaVersion) ? raw.schemaVersion : SCHEMA_VERSION,
    aff,
    flags,
    water: raw.water,
    members: raw.members,
    hub,
    lastRepeat: raw.lastRepeat,
    repeatN: raw.repeatN,
  };
}

/**
 * 把不可信输入收窄成 Session。
 * @param scriptLength 剧本节点总数——`ip` 必须落在 [0, scriptLength] 内
 * @returns 合法则返回 Session，任何畸形一律 null
 */
export function deserializeSession(raw: unknown, scriptLength: number): Session | null {
  if (!isObj(raw)) return null;
  if (raw.v !== SAVE_VERSION) return null;
  if (!isNonNegInt(raw.ip) || raw.ip > scriptLength) return null;

  const state = parseState(raw.state);
  if (!state) return null;

  const history = parseHistory(raw.history);
  if (!history) return null;

  return { state, ip: raw.ip, history };
}

/**
 * 版本迁移入口。目前只有 v1，因此这里主要是把关：
 * 来自未来的版本号一律拒绝（宁可读不出，也不要按旧规则误读新数据）。
 */
export function migrateSave(raw: unknown, scriptLength: number): Session | null {
  if (!isObj(raw)) return null;

  // 无版本号的裸会话对象：视为 v1
  if (!('v' in raw)) {
    return deserializeSession({ ...raw, v: SAVE_VERSION }, scriptLength);
  }

  if (raw.v !== SAVE_VERSION) return null;

  // 将来新增版本时，在此按 raw.v 逐级升级后再交给 deserializeSession
  return deserializeSession(raw, scriptLength);
}
