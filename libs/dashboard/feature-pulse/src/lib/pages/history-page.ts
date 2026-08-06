import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { heroArrowPath, heroChartBar } from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { ParticipationChartComponent } from '@standup-pulse/dashboard-ui';

@Component({
  selector: 'lib-pulse-history-page',
  imports: [NgIcon, ParticipationChartComponent],
  host: { class: 'pulse-route-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pulse-view" aria-labelledby="history-title">
      <div class="pulse-view__toolbar">
        <div>
          <p class="pulse-card__eyebrow">Participation</p>
          <h2 id="history-title">Standup history</h2>
          <p>Seven days of participation, ready for a quick trend check.</p>
        </div>
        <button
          class="btn btn-sm btn-outline"
          type="button"
          (click)="store.refresh()"
        >
          <ng-icon [svg]="icons.refresh" size="17" strokeWidth="1.9" />
          Refresh
        </button>
      </div>

      @if (store.pulse(); as pulse) {
        <div class="history-grid">
          <section
            class="pulse-card history-chart"
            aria-labelledby="history-chart-title"
          >
            <div class="pulse-card__heading">
              <div>
                <p class="pulse-card__eyebrow">Last 7 days</p>
                <h2 id="history-chart-title">Participation trend</h2>
              </div>
              <ng-icon [svg]="icons.chart" size="21" strokeWidth="1.8" />
            </div>
            <lib-pulse-participation-chart [points]="pulse.trend" />
          </section>
          <section
            class="pulse-card history-list"
            aria-labelledby="history-list-title"
          >
            <div class="pulse-card__heading">
              <div>
                <p class="pulse-card__eyebrow">Daily results</p>
                <h2 id="history-list-title">Recent days</h2>
              </div>
            </div>
            <ul>
              @for (point of reversedTrend(); track point.date) {
                <li>
                  <span>{{ shortDate(point.date) }}</span>
                  <strong>{{ point.participationPct }}%</strong>
                  <progress
                    class="progress progress-primary"
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
