import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroClock,
  heroExclamationTriangle,
  heroFlag,
  heroUsers,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';
import { KpiCardComponent } from '../ui/kpi-card';
import { AttentionBannerComponent } from './attention-banner';
import { PulseInsightsComponent } from './pulse-insights';
import { StandupListComponent } from './standup-list';

@Component({
  selector: 'app-pulse-today-page',
  imports: [
    AttentionBannerComponent,
    KpiCardComponent,
    NgIcon,
    PulseInsightsComponent,
    StandupListComponent,
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loadStatus() === 'loading' && !store.pulse()) {
      <section
        class="mx-auto grid w-full max-w-6xl gap-4.5"
        aria-label="Loading daily pulse"
        aria-live="polite"
      >
        <div class="skeleton h-20 w-full"></div>
        <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div class="skeleton h-36"></div>
          <div class="skeleton h-36"></div>
          <div class="skeleton h-36"></div>
          <div class="skeleton h-36"></div>
        </div>
        <div class="skeleton h-96 w-full"></div>
      </section>
    } @else if (store.loadStatus() === 'error' && !store.pulse()) {
      <section
        class="mx-auto flex w-full max-w-6xl items-center gap-3.5 rounded-xl border border-error/30 bg-error/5 p-5"
        role="alert"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-warning font-extrabold text-warning-content"
          aria-hidden="true"
        >
          <ng-icon [svg]="icons.warning" size="21" strokeWidth="2" />
        </span>
        <div>
          <h2 class="font-bold">We could not load today’s pulse</h2>
          <p class="mt-0.5 text-sm text-base-content/60">
            {{ store.loadError() }}
          </p>
        </div>
        <button
          class="btn btn-sm btn-outline ml-auto"
          type="button"
          (click)="store.refresh()"
        >
          Retry
        </button>
      </section>
    } @else if (store.pulse(); as pulse) {
      @if (store.hasExceptions()) {
        <app-pulse-attention-banner [pulse]="pulse" />
      }

      <section
        class="pulse-kpis mx-auto mb-4 grid w-full max-w-6xl grid-cols-4 gap-3.5 @max-4xl/main:grid-cols-2 max-[32rem]:gap-2"
        aria-label="Daily standup metrics"
      >
        <app-pulse-kpi-card
          label="Awaiting updates"
          [value]="pulse.totals.missing"
          [icon]="icons.clock"
          tone="warning"
          [delta]="absolute(pulse.deltas.missing).toString()"
          [deltaNegative]="pulse.deltas.missing > 0"
        />
        <app-pulse-kpi-card
          label="Active blockers"
          [value]="pulse.totals.blocked"
          [icon]="icons.flag"
          tone="error"
          [delta]="absolute(pulse.deltas.blocked).toString()"
          [deltaNegative]="pulse.deltas.blocked > 0"
        />
        <app-pulse-kpi-card
          label="Completed"
          [value]="pulse.totals.posted + ' / ' + pulse.totals.roster"
          [icon]="icons.checkCircle"
          tone="success"
          [delta]="absolute(pulse.deltas.posted).toString()"
          [deltaNegative]="pulse.deltas.posted < 0"
        />
        <app-pulse-kpi-card
          label="Participation"
          [value]="pulse.totals.participationPct + '%'"
          [icon]="icons.users"
          tone="primary"
          [delta]="absolute(pulse.deltas.participationPoints) + ' pp'"
          [deltaNegative]="pulse.deltas.participationPoints < 0"
        />
      </section>

      <div
        class="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1.28fr)_minmax(17.5rem,0.92fr)] items-start gap-4 @max-4xl/main:grid-cols-1"
      >
        <app-pulse-standup-list [pulse]="pulse" />
        <app-pulse-insights [pulse]="pulse" />
      </div>
    }
  `,
})
export class TodayPageComponent {
  protected readonly store = inject(PulseStore);
  protected readonly icons = {
    warning: heroExclamationTriangle,
    clock: heroClock,
    flag: heroFlag,
    checkCircle: heroCheckCircle,
    users: heroUsers,
  } as const;

  protected absolute(value: number): number {
    return Math.abs(value);
  }
}
