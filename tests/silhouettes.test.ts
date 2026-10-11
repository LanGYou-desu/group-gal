import { describe, expect, it } from 'vitest';
import { sil } from '../src/ui/silhouettes';
import { BGM, sfx } from '../src/audio/bgm';
import { CHARS } from '../src/content/characters';

describe('立绘生成', () => {
  it('返回合法 SVG', () => {
    const svg = sil('nanao', 76, CHARS);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('width="76"');
    expect(svg).toContain('height="76"');
  });

  it('使用角色的主题色', () => {
    expect(sil('nanao', 76, CHARS)).toContain('#ff6ec7');
    expect(sil('yu', 76, CHARS)).toContain('#5ce1e6');
    expect(sil('moku', 76, CHARS)).toContain('#ff5a78');
  });

  it('每个角色都能生成且不含 undefined / NaN', () => {
    for (const key of Object.keys(CHARS) as (keyof typeof CHARS)[]) {
      const svg = sil(key, 76, CHARS);
      expect(svg, key).not.toContain('undefined');
      expect(svg, key).not.toContain('NaN');
    }
  });

  it('14 种 shape 都有独立剪影', () => {
    const shapes = new Set(Object.values(CHARS).map(c => c.shape));
    expect(shapes.size).toBe(14);
  });

  it('未知角色回退到灰色与 dot 形状（与现状一致）', () => {
    const svg = sil('nobody' as never, 76, CHARS);
    expect(svg).toContain('#888');
    expect(svg).toContain('<circle cx="50" cy="20" r="5"');
  });

  it('尺寸参数决定 width/height', () => {
    expect(sil('yu', 520, CHARS)).toContain('width="520"');
    expect(sil('yu', 76, CHARS)).not.toContain('width="520"');
  });

  it('每个 shape 的特征元素不同（抽查 crown 与 cat 的角）', () => {
    expect(sil('nanao', 76, CHARS)).toContain('M32 17 L40 27 L50 12 L60 27 L68 17 L64 37 L36 37 Z');
    expect(sil('cat', 76, CHARS)).toContain('M31 22 L35 4 L48 17 Z');
  });

  it('装饰元素带 aria-hidden，不干扰读屏', () => {
    expect(sil('yu', 76, CHARS)).toContain('aria-hidden="true"');
  });
});

describe('BGM 与音效（jsdom 无 AudioContext，应安全降级）', () => {
  it('无 AudioContext 时 set 不抛错', () => {
    expect(() => BGM.set('night')).not.toThrow();
  });

  it('无 AudioContext 时 start 不抛错', () => {
    expect(() => BGM.start('chat')).not.toThrow();
  });

  it('toggle 翻转开关并返回布尔值', () => {
    const first = BGM.toggle();
    const second = BGM.toggle();
    expect(typeof first).toBe('boolean');
    expect(second).toBe(!first);
  });

  it('sfx 无 AudioContext 时不抛错', () => {
    expect(() => sfx('card')).not.toThrow();
    expect(() => sfx('msg')).not.toThrow();
  });
});
