import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroChartBar,
  heroChevronRight,
  heroFlag,
} from '@ng-icons/heroicons/outline';
import { TeamPulseViewModel } from '@standup-pulse/shared-contracts';
import { ParticipationChartComponent } from '../ui/participation-chart';
import { DashboardUiStore } from '../data/dashboard-ui.store';

@Component({
  selector: 'app-pulse-insights',
  imports: [NgIcon, ParticipationChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 @max-4xl/main:grid-cols-2 @max-2xl/main:grid-cols-1">
      <section
        class="card card-border min-w-0 overflow-hidden bg-base-100/90 shadow-sm"
        aria-labelledby="participation-title"
      >
        <div
          class="flex min-h-18 items-center justify-between gap-4 px-4 pt-4 pb-3"
        >
          <div>
            <p
              class="text-2xs font-extrabold uppercase tracking-widest text-primary"
            >
              Trend
            </p>
            <h2
              id="participation-title"
              class="mt-px text-lg font-extrabold tracking-tight"
            >
              7-day participation
            </h2>
          </div>
          <ng-icon [svg]="icons.chart" size="20" strokeWidth="1.8" />
        </div>
        @if (pulse().trend.length) {
          <app-pulse-participation-chart [points]="pulse().trend" />
        } @else {
          <div
            class="mx-4 mb-4.5 rounded-lg border border-dashed border-base-300 bg-base-200 p-6 text-center text-xs text-base-content/60"
          >
            Participation history will appear after the first standups.
          </div>
        }
      </section>

      <section
        id="blockers-panel"
        class="blockers-card card card-border min-w-0 overflow-hidden bg-base-100/90 shadow-sm"
        aria-labelledby="blockers-title"
      >
        <div
          class="flex min-h-18 items-center justify-between gap-4 px-4 pt-4 pb-3"
        >
          <div>
            <p
              class="text-2xs font-extrabold uppercase tracking-widest text-primary"
            >
              Oldest first
            </p>
            <h2
              id="blockers-title"
              class="mt-px text-lg font-extrabold tracking-tight"
            >
              Blockers
            </h2>
          </div>
          <span class="badge badge-error badge-sm">{{
            pulse().blockers.length
          }}</span>
        </div>
        @if (pulse().blockers.length) {
          <ul class="grid gap-2 px-4 pb-4">
            @for (blocker of pulse().blockers; track blocker.id) {
              <li>
                <button
                  class="grid min-h-15.5 w-full grid-cols-[2.125rem_minmax(0,1fr)_auto_0.625rem] items-center gap-2 rounded-lg border bg-base-100 p-2.5 text-left hover:border-primary/45 hover:bg-primary/5"
                  [class]="
                    ui.selectedBlockerId() === blocker.id
                      ? 'border-primary/45 bg-primary/5'
                      : 'border-base-300'
                  "
                  type="button"
                  (click)="ui.selectBlocker(blocker.id)"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-full bg-error/10 text-error"
                    aria-hidden="true"
                  >
                    <ng-icon [svg]="icons.flag" size="18" strokeWidth="1.8" />
                  </span>
                  <span class="grid min-w-0 gap-0.5">
                    <strong class="truncate text-xs">{{
                      blocker.title
                    }}</strong>
                    <small class="text-2xs text-base-content/55">{{
                      blocker.owner.displayName
                    }}</small>
                  </span>
                  <span class="text-xs font-bold text-error"
                    >{{ blocker.ageDays }}d</span
                  >
                  <ng-icon
                    [svg]="icons.chevronRight"
                    size="16"
                    strokeWidth="2"
                  />
                </button>
              </li>
            }
          </ul>
        } @else {
          <div
            class="mx-4 mb-4.5 rounded-lg border border-dashed border-success/30 bg-success/5 p-6 text-center text-xs text-success"
          >
            No active blockers today.
          </div>
        }
      </section>
    </div>
  `,
})
export class PulseInsightsComponent {
  readonly pulse = input.required<TeamPulseViewModel>();
  protected readonly ui = inject(DashboardUiStore);
  protected readonly icons = {
    chart: heroChartBar,
    flag: heroFlag,
    chevronRight: heroChevronRight,
  } as const;
}
