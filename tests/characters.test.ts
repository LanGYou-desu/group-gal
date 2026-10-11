import { describe, expect, it } from 'vitest';
import { CHARS, HERO_KEYS, MAIN_KEYS } from '../src/content/characters';

describe('角色数据', () => {
  it('恰好 14 个角色', () => {
    expect(Object.keys(CHARS)).toHaveLength(14);
  });

  it('HERO_KEYS 与 hero:true 的角色完全一致', () => {
    const heroes = (Object.keys(CHARS) as (keyof typeof CHARS)[]).filter(k => CHARS[k].hero);
    expect([...HERO_KEYS].sort()).toEqual([...heroes].sort());
  });

  it('MAIN_KEYS 是 HERO_KEYS 的子集', () => {
    for (const k of MAIN_KEYS) expect(HERO_KEYS).toContain(k);
  });

  it('每个角色字段非空且颜色是 6 位十六进制', () => {
    for (const [key, c] of Object.entries(CHARS)) {
      expect(c.name, key).toBeTruthy();
      expect(c.emoji, key).toBeTruthy();
      expect(c.role, key).toBeTruthy();
      expect(c.color, key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('闹七是群主，蘑菇汤是反派', () => {
    expect(CHARS.nanao.sub).toContain('群主');
    expect(CHARS.moku.role).toBe('反派');
  });

  it('助攻与反派不可攻略（hero: false）', () => {
    for (const k of ['gen', 'aka', 'moku'] as const) {
      expect(CHARS[k].hero, k).toBe(false);
    }
  });

  it('文案与源文件逐字一致（抽查）', () => {
    expect(CHARS.nanao.sub).toBe('null7323 · 群主');
    expect(CHARS.nanao.desc).toBe(
      '😂群聊的群主，自己开着 MC / 帕鲁服务器，还是 Arcaea 知名谱师、写谱高手。嘴硬心软，护短——嘴上天天喊解散群，真踢起人来一次也没舍得。',
    );
    expect(CHARS.shei.name).toBe('誰');
    expect(CHARS.shisuan.sub).toBe('我的父亲是根哥');
    expect(CHARS.mianbao.role).toBe('拍框大王');
    expect(CHARS.mianbao.desc).toBe(
      '管理员，锐评谱面一绝，自称拍框大王。Tttt 喜欢的那块面包就是他。',
    );
    expect(CHARS.moku.shape).toBe('mushroom');
    expect(CHARS.c30586.sub).toBe('CraZy Thursday Vme50');
  });

  it('HERO_KEYS 顺序即界面显示顺序（与现状 AFFKEYS 一致）', () => {
    expect([...HERO_KEYS]).toEqual([
      'nanao', 'yu', 'cat', 'g', 'shisuan', 'tttt', 'shei',
      'shiban', 'taffy', 'c30586', 'mianbao',
    ]);
  });
});
