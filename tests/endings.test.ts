import { describe, expect, it } from 'vitest';
import { BEDATA, ENDING } from '../src/content/endings';
import { MAIN_KEYS } from '../src/content/characters';

describe('结局数据', () => {
  it('9 个 Bad End 全部有标题与正文', () => {
    expect(Object.keys(BEDATA)).toHaveLength(9);
    for (const [id, d] of Object.entries(BEDATA)) {
      expect(d.tag, id).toBe('BAD END');
      expect(d.title, id).toBeTruthy();
      expect(d.text.length, id).toBeGreaterThan(20);
    }
  });

  it('恰好是这 9 个 Bad End 编号', () => {
    expect(Object.keys(BEDATA).sort()).toEqual([
      'BE01', 'BE02', 'BE05', 'BE10', 'BE17', 'BE19', 'BE20', 'BE23', 'BE24',
    ]);
  });

  it('7 条路线结局，且全部可攻略主角都有', () => {
    expect(Object.keys(ENDING)).toHaveLength(7);
    for (const k of MAIN_KEYS) expect(ENDING[k], k).toBeDefined();
  });

  it('BE10 与 BE23 存在（由结局判定触发而非剧本节点）', () => {
    expect(BEDATA.BE10.title).toContain('我很伤心');
    expect(BEDATA.BE23.title).toContain('第 81 人');
  });

  it('换行符保留为 \\n（结局文案依赖 white-space:pre-line 渲染）', () => {
    expect(BEDATA.BE01.text).toContain('\n');
    expect(BEDATA.BE01.text).toContain('\n\n');
    expect(ENDING.nanao!.text).toContain('\n');
  });

  it('文案与源文件逐字一致（抽查）', () => {
    expect(BEDATA.BE01.title).toBe('BE-01 老傻子');
    expect(BEDATA.BE01.text).toBe(
      '你回了句 你凭什么骂我。\n群里安静了半秒 然后整齐地刷起 老傻子。\n闹七出来打圆场：行了 谁没当过新人 别欺负人家。\n她没踢你 一个管理动作都没有。\n\n可你越想越难受。\n第二天 你自己退了群。',
    );
    expect(BEDATA.BE24.text).toBe(
      '你把同一句话刷了第三遍。\n闹七没有生气 只是按群规把你禁言了：\n规矩就是规矩 新人 冷静十分钟。\n\n群里没人笑你。\n但你的输入框灰了 那句想说的话 打不出去了。',
    );
    expect(ENDING.shei!.title).toBe('誰线 · 第七个存档');
    expect(ENDING.g!.title).toBe('G线 · 别把我当老傻子');
  });
});
