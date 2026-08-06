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

export type PulseTone = 'primary' | 'success' | 'warning' | 'error';
export type RuntimeState = 'online' | 'degraded' | 'offline' | 'unknown';

@Component({
  selector: 'lib-pulse-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="status-pill"
      [class.status-pill--online]="state() === 'online'"
      [class.status-pill--degraded]="state() === 'degraded'"
      [class.status-pill--offline]="state() === 'offline'"
      [class.status-pill--unknown]="state() === 'unknown'"
      [attr.title]="detail() || label()"
    >
      <span class="status-pill__dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
      <span class="sr-only">— {{ state() }}</span>
    </span>
  `,
})
export class StatusPillComponent {
  readonly label = input.required<string>();
  readonly state = input<RuntimeState>('unknown');
  readonly detail = input<string>();
}

@Component({
  selector: 'lib-pulse-kpi-card',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <article class="kpi-card h-full">
      <div class="flex items-start gap-3">
        <span
          class="kpi-card__icon"
          [class.kpi-card__icon--primary]="tone() === 'primary'"
          [class.kpi-card__icon--success]="tone() === 'success'"
          [class.kpi-card__icon--warning]="tone() === 'warning'"
          [class.kpi-card__icon--error]="tone() === 'error'"
          aria-hidden="true"
        >
          <ng-icon [svg]="icon()" size="22" strokeWidth="1.8" />
        </span>
        <div class="min-w-0">
          <p class="kpi-card__label">{{ label() }}</p>
          <p class="kpi-card__value">{{ value() }}</p>
        </div>
      </div>
      <p class="kpi-card__delta" [class.text-error]="deltaNegative()">
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
}

export interface ParticipationPoint {
  date: string;
  participationPct: number;
}

@Component({
  selector: 'lib-pulse-participation-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="participation-chart"
      role="img"
      [attr.aria-label]="accessibleSummary()"
    >
      <div class="participation-chart__guide participation-chart__guide--top">
        <span>100%</span>
      </div>
      <div
        class="participation-chart__guide participation-chart__guide--middle"
      >
        <span>50%</span>
      </div>
      <div
        class="participation-chart__guide participation-chart__guide--bottom"
      >
        <span>0%</span>
      </div>

      <div class="participation-chart__bars" aria-hidden="true">
        @for (point of points(); track point.date) {
          <div class="participation-chart__column">
            <span class="participation-chart__value"
              >{{ point.participationPct }}%</span
            >
            <div class="participation-chart__track">
              <span
                class="participation-chart__bar"
                [style.height.%]="point.participationPct"
              ></span>
            </div>
            <span class="participation-chart__day">{{ day(point.date) }}</span>
          </div>
        }
      </div>
    </div>

    <table class="sr-only">
      <caption>
        Seven-day participation
      </caption>
      <thead>
        <tr>
          <th>Date</th>
          <th>Participation</th>
        </tr>
      </thead>
      <tbody>
        @for (point of points(); track point.date) {
          <tr>
            <td>{{ point.date }}</td>
            <td>{{ point.participationPct }}%</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class ParticipationChartComponent {
  readonly points = input.required<readonly ParticipationPoint[]>();
  readonly accessibleSummary = computed(() => {
    const points = this.points();
    if (!points.length) return 'No participation history is available.';
    return `Seven-day participation: ${points
      .map(
        (point) => `${this.day(point.date)} ${point.participationPct} percent`,
      )
      .join(', ')}.`;
  });

  protected day(date: string): string {
    return new Intl.DateTimeFormat('en', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }
}
