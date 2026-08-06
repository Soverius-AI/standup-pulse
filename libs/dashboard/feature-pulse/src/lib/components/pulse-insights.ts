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
import { ParticipationChartComponent } from '@standup-pulse/dashboard-ui';
import { DashboardUiStore } from '../dashboard-ui.store';

@Component({
  selector: 'lib-pulse-insights',
  imports: [NgIcon, ParticipationChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulse-insights">
      <section class="pulse-card" aria-labelledby="participation-title">
        <div class="pulse-card__heading">
          <div>
            <p class="pulse-card__eyebrow">Trend</p>
            <h2 id="participation-title">7-day participation</h2>
          </div>
          <ng-icon [svg]="icons.chart" size="20" strokeWidth="1.8" />
        </div>
        @if (pulse().trend.length) {
          <lib-pulse-participation-chart [points]="pulse().trend" />
        } @else {
          <div class="pulse-empty">
            Participation history will appear after the first standups.
          </div>
        }
      </section>

      <section
        id="blockers-panel"
        class="pulse-card blockers-card"
        aria-labelledby="blockers-title"
      >
        <div class="pulse-card__heading">
          <div>
            <p class="pulse-card__eyebrow">Oldest first</p>
            <h2 id="blockers-title">Blockers</h2>
          </div>
          <span class="badge badge-error badge-sm">{{
            pulse().blockers.length
          }}</span>
        </div>
        @if (pulse().blockers.length) {
          <ul class="blocker-list">
            @for (blocker of pulse().blockers; track blocker.id) {
              <li>
                <button
                  class="blocker-row"
                  [class.blocker-row--selected]="
                    ui.selectedBlockerId() === blocker.id
                  "
                  type="button"
                  (click)="ui.selectBlocker(blocker.id)"
                >
                  <span class="blocker-row__flag" aria-hidden="true">
                    <ng-icon [svg]="icons.flag" size="18" strokeWidth="1.8" />
                  </span>
                  <span class="blocker-row__content">
                    <strong>{{ blocker.title }}</strong>
                    <small>{{ blocker.owner.displayName }}</small>
                  </span>
                  <span class="blocker-row__age">{{ blocker.ageDays }}d</span>
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
          <div class="pulse-empty pulse-empty--success">
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
