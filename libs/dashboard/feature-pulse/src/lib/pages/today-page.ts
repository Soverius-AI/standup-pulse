import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroClock,
  heroExclamationTriangle,
  heroFlag,
  heroUsers,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { KpiCardComponent } from '@standup-pulse/dashboard-ui';
import { AttentionBannerComponent } from '../components/attention-banner';
import { PulseInsightsComponent } from '../components/pulse-insights';
import { StandupListComponent } from '../components/standup-list';

@Component({
  selector: 'lib-pulse-today-page',
  imports: [
    AttentionBannerComponent,
    KpiCardComponent,
    NgIcon,
    PulseInsightsComponent,
    StandupListComponent,
  ],
  host: { class: 'pulse-route-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loadStatus() === 'loading' && !store.pulse()) {
      <section
        class="pulse-loading"
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
      <section class="pulse-error" role="alert">
        <span class="pulse-error__icon" aria-hidden="true">
          <ng-icon [svg]="icons.warning" size="21" strokeWidth="2" />
        </span>
        <div>
          <h2>We could not load today’s pulse</h2>
          <p>{{ store.loadError() }}</p>
        </div>
        <button
          class="btn btn-sm btn-outline"
          type="button"
          (click)="store.refresh()"
        >
          Retry
        </button>
      </section>
    } @else if (store.pulse(); as pulse) {
      @if (store.hasExceptions()) {
        <lib-pulse-attention-banner [pulse]="pulse" />
      }

      <section class="pulse-kpis" aria-label="Daily standup metrics">
        <lib-pulse-kpi-card
          label="Awaiting updates"
          [value]="pulse.totals.missing"
          [icon]="icons.clock"
          tone="warning"
          [delta]="absolute(pulse.deltas.missing).toString()"
          [deltaNegative]="pulse.deltas.missing > 0"
        />
        <lib-pulse-kpi-card
          label="Active blockers"
          [value]="pulse.totals.blocked"
          [icon]="icons.flag"
          tone="error"
          [delta]="absolute(pulse.deltas.blocked).toString()"
          [deltaNegative]="pulse.deltas.blocked > 0"
        />
        <lib-pulse-kpi-card
          label="Completed"
          [value]="pulse.totals.posted + ' / ' + pulse.totals.roster"
          [icon]="icons.checkCircle"
          tone="success"
          [delta]="absolute(pulse.deltas.posted).toString()"
          [deltaNegative]="pulse.deltas.posted < 0"
        />
        <lib-pulse-kpi-card
          label="Participation"
          [value]="pulse.totals.participationPct + '%'"
          [icon]="icons.users"
          tone="primary"
          [delta]="absolute(pulse.deltas.participationPoints) + ' pp'"
          [deltaNegative]="pulse.deltas.participationPoints < 0"
        />
      </section>

      <div class="pulse-content-grid">
        <lib-pulse-standup-list [pulse]="pulse" />
        <lib-pulse-insights [pulse]="pulse" />
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
