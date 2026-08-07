import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroArrowTrendingDown,
  heroArrowTrendingUp,
} from '@ng-icons/heroicons/outline';
import { PulseTone } from './types';

const TONE_CLASSES: Record<PulseTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-content',
  error: 'bg-error/10 text-error',
};

@Component({
  selector: 'app-pulse-kpi-card',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <article
      class="card card-border h-full min-h-36 justify-between bg-base-100/90 p-4 shadow-sm max-[32rem]:min-h-33 max-[32rem]:p-3.5"
    >
      <div class="flex items-start gap-3">
        <span
          class="grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold max-[32rem]:size-9"
          [class]="toneClasses()"
          aria-hidden="true"
        >
          <ng-icon [svg]="icon()" size="22" strokeWidth="1.8" />
        </span>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-base-content/60">
            {{ label() }}
          </p>
          <p
            class="mt-0.5 text-3xl font-extrabold tracking-tighter max-[32rem]:text-2xl"
          >
            {{ value() }}
          </p>
        </div>
      </div>
      <p
        class="mt-3 flex items-center gap-1 text-xs font-bold"
        [class]="deltaNegative() ? 'text-error' : 'text-success'"
      >
        <ng-icon
          [svg]="deltaNegative() ? trendDown : trendUp"
          size="14"
          strokeWidth="2.1"
          aria-hidden="true"
        />
        {{ delta() }}
        <span class="font-normal text-base-content/50">vs yesterday</span>
      </p>
    </article>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>();
  readonly tone = input<PulseTone>('primary');
  readonly delta = input.required<string>();
  readonly deltaNegative = input(false);
  protected readonly trendDown = heroArrowTrendingDown;
  protected readonly trendUp = heroArrowTrendingUp;
  protected readonly toneClasses = computed(() => TONE_CLASSES[this.tone()]);
}
