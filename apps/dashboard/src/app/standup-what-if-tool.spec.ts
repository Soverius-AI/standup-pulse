import { TestBed } from '@angular/core/testing';
import type { AngularToolCall } from '@copilotkit/angular';

interface StandupWhatIfArgs extends Record<string, unknown> {
  total: number;
  posted: number;
  blockers: number;
}

describe('StandupWhatIfToolComponent', () => {
  it('renders a typed Generative UI card and updates its scenario', async () => {
    const { StandupWhatIfToolComponent } = await import(
      '@standup-pulse/dashboard-feature-pulse'
    );
    await TestBed.configureTestingModule({
      imports: [StandupWhatIfToolComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(StandupWhatIfToolComponent);
    const toolCall: AngularToolCall<StandupWhatIfArgs> = {
      name: 'renderStandupWhatIf',
      args: { total: 5, posted: 3, blockers: 1 },
      status: 'complete',
      result: 'Rendered',
    };
    fixture.componentRef.setInput('toolCall', toolCall);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const progress = host.querySelector<HTMLElement>('[role="progressbar"]');
    const range = host.querySelector<HTMLInputElement>('input[type="range"]');

    expect(progress?.getAttribute('aria-valuenow')).toBe('60');
    expect(host.textContent).toContain('3/5');

    if (!range) throw new Error('Expected participation range input');
    range.value = '5';
    range.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(progress?.getAttribute('aria-valuenow')).toBe('100');
    expect(host.textContent).toContain('5/5');
  });

  it('advertises a small bounded schema to the local model', async () => {
    const { standupWhatIfSchema, STANDUP_WHAT_IF_TOOL } = await import(
      '@standup-pulse/dashboard-feature-pulse'
    );
    expect(
      standupWhatIfSchema.parse({ total: 5, posted: 3, blockers: 1 }),
    ).toEqual({ total: 5, posted: 3, blockers: 1 });
    expect(STANDUP_WHAT_IF_TOOL).toMatchObject({
      name: 'renderStandupWhatIf',
      agentId: 'standupPulse',
      followUp: false,
    });
  });
});
