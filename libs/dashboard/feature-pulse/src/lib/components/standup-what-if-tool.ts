import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import {
  type AngularToolCall,
  type FrontendToolConfig,
  registerFrontendTool,
  type ToolRenderer,
} from '@copilotkit/angular';
import { z } from 'zod';

export const STANDUP_WHAT_IF_TOOL_NAME = 'renderStandupWhatIf';

export const standupWhatIfSchema = z.object({
  total: z.number().int().min(1).max(50),
  posted: z.number().int().min(0).max(50),
  blockers: z.number().int().min(0).max(50),
});

export type StandupWhatIfArgs = z.infer<typeof standupWhatIfSchema>;

@Component({
  selector: 'lib-standup-what-if-tool',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="what-if" aria-label="Interactive standup what-if">
      <header>
        <span>Generative UI</span>
        <h3>Participation what-if</h3>
        <p>Move the slider to explore the team outcome.</p>
      </header>

      <div class="what-if__metrics" aria-label="Scenario metrics">
        <article>
          <small>Participation</small>
          <strong>{{ participation() }}%</strong>
        </article>
        <article>
          <small>Posted</small>
          <strong>{{ posted() }}/{{ total() }}</strong>
        </article>
        <article>
          <small>Blockers</small>
          <strong>{{ blockers() }}</strong>
        </article>
      </div>

      <label>
        <span>People who posted</span>
        <strong>{{ posted() }} of {{ total() }}</strong>
        <input
          type="range"
          min="0"
          [max]="total()"
          [value]="posted()"
          (input)="updatePosted($event)"
        />
      </label>

      <div
        class="what-if__progress"
        role="progressbar"
        aria-label="Participation"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="participation()"
      >
        <span [style.width.%]="participation()"></span>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block: 0.5rem;
    }

    .what-if {
      display: grid;
      gap: 0.9rem;
      overflow: hidden;
      border: 1px solid color-mix(in oklab, #f0a000, transparent 55%);
      border-radius: 0.9rem;
      background: #fffbf3;
      color: #13213c;
      padding: 1rem;
    }

    header span {
      color: #a76500;
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    h3,
    p {
      margin: 0;
    }

    h3 {
      margin-top: 0.2rem;
      font-size: 1rem;
    }

    p,
    small,
    label span {
      color: #687187;
      font-size: 0.72rem;
    }

    .what-if__metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.45rem;
    }

    article {
      display: grid;
      gap: 0.1rem;
      border: 1px solid #e5e8ef;
      border-radius: 0.65rem;
      background: #fff;
      padding: 0.6rem;
    }

    article strong {
      font-size: 1.05rem;
    }

    label {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.45rem;
    }

    label input {
      grid-column: 1 / -1;
      width: 100%;
      accent-color: #e89500;
    }

    .what-if__progress {
      height: 0.45rem;
      overflow: hidden;
      border-radius: 999px;
      background: #ebeef4;
    }

    .what-if__progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #e89500;
      transition: width 150ms ease;
    }
  `,
})
export class StandupWhatIfToolComponent
  implements ToolRenderer<StandupWhatIfArgs>
{
  readonly toolCall = input.required<AngularToolCall<StandupWhatIfArgs>>();

  protected readonly total = computed(() =>
    Math.max(1, this.toolCall().args.total ?? 1),
  );
  protected readonly blockers = computed(() =>
    Math.max(0, this.toolCall().args.blockers ?? 0),
  );
  protected readonly posted = linkedSignal(() =>
    Math.min(this.total(), Math.max(0, this.toolCall().args.posted ?? 0)),
  );
  protected readonly participation = computed(() =>
    Math.round((this.posted() / this.total()) * 100),
  );

  protected updatePosted(event: Event): void {
    this.posted.set(Number((event.target as HTMLInputElement).value));
  }
}

export const STANDUP_WHAT_IF_TOOL = {
  name: STANDUP_WHAT_IF_TOOL_NAME,
  description:
    'Render an interactive Angular standup participation what-if card. Use this exact tool for a Generative UI what-if demo.',
  parameters: standupWhatIfSchema,
  component: StandupWhatIfToolComponent,
  agentId: 'standupPulse',
  followUp: false,
  handler: async () => 'Interactive standup what-if rendered.',
} satisfies FrontendToolConfig<StandupWhatIfArgs>;

export function registerStandupWhatIfTool(): void {
  registerFrontendTool(STANDUP_WHAT_IF_TOOL);
}
