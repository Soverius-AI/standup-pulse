import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { heroArrowPath, heroChartBar } from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';
import { ParticipationChartComponent } from '../ui/participation-chart';

@Component({
  selector: 'app-pulse-history-page',
  imports: [NgIcon, ParticipationChartComponent],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto w-full max-w-6xl" aria-labelledby="history-title">
      <div
        class="card card-border mb-4 min-h-26 flex-row items-center justify-between gap-6 bg-base-100/90 p-5 shadow-sm @max-2xl/main:flex-col @max-2xl/main:items-start"
      >
        <div>
          <p
            class="text-2xs font-extrabold uppercase tracking-widest text-primary"
          >
            Participation
          </p>
          <h2
            id="history-title"
            class="mt-0.5 text-xl font-extrabold tracking-tight"
          >
            Standup history
          </h2>
          <p class="mt-1 text-xs text-base-content/60">
            Seven days of participation, ready for a quick trend check.
          </p>
        </div>
        <button
          class="btn btn-sm btn-outline @max-2xl/main:w-full"
          type="button"
          (click)="store.refresh()"
        >
          <ng-icon [svg]="icons.refresh" size="17" strokeWidth="1.9" />
          Refresh
        </button>
      </div>

      @if (store.pulse(); as pulse) {
        <div
          class="grid grid-cols-[minmax(0,1.35fr)_minmax(17.5rem,0.65fr)] items-start gap-4 @max-4xl/main:grid-cols-1"
        >
          <section
            class="card card-border min-w-0 overflow-hidden bg-base-100/90 shadow-sm"
            aria-labelledby="history-chart-title"
          >
            <div
              class="flex min-h-18 items-center justify-between gap-4 px-4 pt-4 pb-3"
            >
              <div>
                <p
                  class="text-2xs font-extrabold uppercase tracking-widest text-primary"
                >
                  Last 7 days
                </p>
                <h2
                  id="history-chart-title"
                  class="mt-px text-lg font-extrabold tracking-tight"
                >
                  Participation trend
                </h2>
              </div>
              <ng-icon [svg]="icons.chart" size="21" strokeWidth="1.8" />
            </div>
            <app-pulse-participation-chart [points]="pulse.trend" />
          </section>
          <section
            class="card card-border min-w-0 overflow-hidden bg-base-100/90 shadow-sm"
            aria-labelledby="history-list-title"
          >
            <div
              class="flex min-h-18 items-center justify-between gap-4 px-4 pt-4 pb-3"
            >
              <div>
                <p
                  class="text-2xs font-extrabold uppercase tracking-widest text-primary"
                >
                  Daily results
                </p>
                <h2
                  id="history-list-title"
                  class="mt-px text-lg font-extrabold tracking-tight"
                >
                  Recent days
                </h2>
              </div>
            </div>
            <ul class="px-4 pb-4">
              @for (point of reversedTrend(); track point.date) {
                <li
                  class="grid grid-cols-[minmax(6.25rem,1fr)_auto] gap-x-3.5 gap-y-2 border-t border-base-200 py-3 text-xs"
                >
                  <span>{{ shortDate(point.date) }}</span>
                  <strong class="text-primary"
                    >{{ point.participationPct }}%</strong
                  >
                  <progress
                    class="progress progress-primary col-span-full h-1.5 w-full"
                    [value]="point.participationPct"
                    max="100"
                    [attr.aria-label]="
                      point.participationPct + '% participation'
                    "
                  ></progress>
                </li>
              }
            </ul>
          </section>
        </div>
      }
    </section>
  `,
})
export class HistoryPageComponent {
  protected readonly store = inject(PulseStore);
  protected readonly icons = {
    refresh: heroArrowPath,
    chart: heroChartBar,
  } as const;
  protected readonly reversedTrend = computed(() =>
    [...(this.store.pulse()?.trend ?? [])].reverse(),
  );

  protected shortDate(date: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }
}
