import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION, deserializeSession, migrateSave, serializeSession,
} from '../src/engine/persist';
import { createInitialState } from '../src/engine/effects';
import type { Session } from '../src/engine/types';

/** 剧本长度，用于 ip 越界校验（当前剧本 185 个节点）。 */
const LEN = 185;

const sess = (): Session => ({
  state: createInitialState(),
  ip: 42,
  history: [{ kind: 'say', who: 'yu', text: '嗨' }],
});

const good = () => ({ v: SAVE_VERSION, ip: 42, state: createInitialState(), history: [] });

describe('存档往返', () => {
  it('序列化后能原样反序列化', () => {
    const s = sess();
    expect(deserializeSession(JSON.parse(serializeSession(s)), LEN)).toEqual(s);
  });

  it('序列化结果是合法 JSON 且带版本号', () => {
    const parsed = JSON.parse(serializeSession(sess()));
    expect(parsed.v).toBe(SAVE_VERSION);
    expect(parsed.ip).toBe(42);
  });

  it('history 的三种条目都能往返', () => {
    const s: Session = {
      state: createInitialState(),
      ip: 0,
      history: [
        { kind: 'say', who: 'yu', text: '嗨' },
        { kind: 'say', who: 'me', text: '你好' },
        { kind: 'sys', text: '群成员 80 → 81' },
        { kind: 'note', text: '旁白' },
      ],
    };
    expect(deserializeSession(JSON.parse(serializeSession(s)), LEN)).toEqual(s);
  });
});

describe('存档防御 —— 存档是可被手改的不可信输入（Review Focus #1）', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['字符串', 'nope'],
    ['数字', 123],
    ['数组', [1, 2, 3]],
    ['空对象', {}],
    ['缺 state', { v: SAVE_VERSION, ip: 0, history: [] }],
    ['缺 ip', { v: SAVE_VERSION, state: createInitialState(), history: [] }],
    ['缺 history', { v: SAVE_VERSION, ip: 0, state: createInitialState() }],
    ['ip 是字符串', { ...good(), ip: 'x' }],
    ['ip 是小数', { ...good(), ip: 1.5 }],
    ['ip 是负数', { ...good(), ip: -1 }],
    ['ip 越界', { ...good(), ip: 99999 }],
    ['history 不是数组', { ...good(), history: 'x' }],
    ['history 元素畸形', { ...good(), history: [{ nope: 1 }] }],
    ['history 的 kind 非法', { ...good(), history: [{ kind: 'evil', text: 'x' }] }],
    ['history 的 say 缺 who', { ...good(), history: [{ kind: 'say', text: 'x' }] }],
    ['history 的 text 是数字', { ...good(), history: [{ kind: 'sys', text: 42 }] }],
    ['aff 为空对象', { ...good(), state: { ...createInitialState(), aff: {} } }],
    ['aff 值是字符串', { ...good(), state: { ...createInitialState(), aff: { ...createInitialState().aff, nanao: 'x' } } }],
    ['aff 值是 NaN', { ...good(), state: { ...createInitialState(), aff: { ...createInitialState().aff, nanao: NaN } } }],
    ['aff 值是负数', { ...good(), state: { ...createInitialState(), aff: { ...createInitialState().aff, nanao: -1 } } }],
    ['flags 值是字符串', { ...good(), state: { ...createInitialState(), flags: { actSkip: 'yes' } } }],
    ['water 是字符串', { ...good(), state: { ...createInitialState(), water: 'x' } }],
    ['members 是负数', { ...good(), state: { ...createInitialState(), members: -5 } }],
    ['hub 值不是布尔', { ...good(), state: { ...createInitialState(), hub: { s_mc: 'yes' } } }],
  ])('%s → null（且不抛错）', (_name, raw) => {
    expect(() => deserializeSession(raw, LEN)).not.toThrow();
    expect(deserializeSession(raw, LEN)).toBeNull();
  });

  it('来自未来的版本号 → null', () => {
    expect(deserializeSession({ ...good(), v: SAVE_VERSION + 1 }, LEN)).toBeNull();
  });

  it('原型污染尝试不会污染 Object.prototype', () => {
    deserializeSession(JSON.parse('{"v":1,"ip":0,"history":[],"state":{"__proto__":{"polluted":1}}}'), LEN);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('迁移', () => {
  it('当前版本的存档原样通过', () => {
    expect(migrateSave(JSON.parse(serializeSession(sess())), LEN)).toEqual(sess());
  });

  it('无版本号的裸会话对象视为 v1 接受', () => {
    expect(migrateSave(sess(), LEN)).not.toBeNull();
  });

  it('无法迁移的输入返回 null', () => {
    expect(migrateSave({ v: 0 }, LEN)).toBeNull();
    expect(migrateSave({ v: 999 }, LEN)).toBeNull();
  });

  it('v1 存档经迁移后与直接反序列化一致', () => {
    const raw = JSON.parse(serializeSession(sess()));
    expect(migrateSave(raw, LEN)).toEqual(deserializeSession(raw, LEN));
  });
});
