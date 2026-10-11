import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIST = 'dist/index.html';

describe.skipIf(!existsSync(DIST))('单文件产物', () => {
  const html = () => readFileSync(DIST, 'utf8');

  it('不含任何外部脚本或样式引用', () => {
    expect(html()).not.toMatch(/<script[^>]+src=/i);
    expect(html()).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it('JS 与 CSS 均已内联', () => {
    expect(html()).toMatch(/<script[^>]*>/i);
    expect(html()).toMatch(/<style/i);
  });

  it('主题色与标题文案已进入产物', () => {
    expect(html()).toContain('#ff6ec7');
    expect(html()).toContain('全 群 攻 陷 计 划');
  });

  it('体积在合理范围', () => {
    expect(html().length).toBeGreaterThan(20_000);
    expect(html().length).toBeLessThan(2_000_000);
  });

  it('关于页的外部素材链接保留（它们是正文内容，不是资源引用）', () => {
    expect(html()).toContain('dova-s.jp');
  });
});
