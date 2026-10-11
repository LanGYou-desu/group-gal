import type {
  AffToastItem, BeId, CharKey, ChoiceOption, DelayPolicy, EndingResolution,
  HubOption, Renderer, Session, Speaker, TrackName,
} from '../src/engine/types';

export type Call =
  | { t: 'say'; who: Speaker; text: string }
  | { t: 'sys'; text: string }
  | { t: 'note'; text: string }
  | { t: 'card'; who: CharKey }
  | { t: 'bgm'; track: TrackName }
  | { t: 'affToast'; items: readonly AffToastItem[] }
  | { t: 'toast'; text: string }
  | { t: 'be'; id: BeId }
  | { t: 'ending'; resolution: EndingResolution };

/**
 * 记录调用序列的假渲染器。
 * choiceAnswers / hubAnswers 按出现顺序回答；越界时回退到 0。
 */
export class FakeRenderer implements Renderer {
  readonly calls: Call[] = [];
  private choiceCursor = 0;
  private hubCursor = 0;

  choiceAnswers: number[] = [];
  hubAnswers: number[] = [];

  delays: DelayPolicy = { me: 0, msg: 0, sys: 0, note: 0, card: 0, fast: true };

  async say(who: Speaker, text: string): Promise<void> { this.calls.push({ t: 'say', who, text }); }
  async sys(text: string): Promise<void> { this.calls.push({ t: 'sys', text }); }
  async note(text: string): Promise<void> { this.calls.push({ t: 'note', text }); }
  async card(who: CharKey): Promise<void> { this.calls.push({ t: 'card', who }); }
  bgm(track: TrackName): void { this.calls.push({ t: 'bgm', track }); }
  affToast(items: readonly AffToastItem[]): void { this.calls.push({ t: 'affToast', items }); }
  toast(text: string): void { this.calls.push({ t: 'toast', text }); }

  async askChoice(_prompt: string, _options: readonly ChoiceOption[]): Promise<number> {
    const answer = this.choiceAnswers[this.choiceCursor] ?? 0;
    this.choiceCursor++;
    return answer;
  }

  async askHub(_prompt: string, _options: readonly HubOption[]): Promise<number> {
    const answer = this.hubAnswers[this.hubCursor] ?? 0;
    this.hubCursor++;
    return answer;
  }

  async showBE(id: BeId): Promise<void> { this.calls.push({ t: 'be', id }); }
  async showEnding(resolution: EndingResolution, _s: Session): Promise<void> {
    this.calls.push({ t: 'ending', resolution });
  }
}
