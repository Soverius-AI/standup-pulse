import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export interface ParticipationPoint {
  date: string;
  participationPct: number;
}

@Component({
  selector: 'app-pulse-participation-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styleUrl: './participation-chart.css',
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
