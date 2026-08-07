import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroCheckCircle,
  heroExclamationTriangle,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';

@Component({
  selector: 'app-pulse-nudge-feedback',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isNudging()) {
      <div
        class="toast toast-top toast-end z-[90] w-[min(27rem,calc(100vw-2rem))]"
        aria-live="polite"
      >
        <div
          class="alert alert-info grid-cols-[auto_minmax(0,1fr)_auto] shadow-xl"
          role="status"
        >
          <span
            class="loading loading-spinner loading-sm"
            aria-hidden="true"
          ></span>
          <span>Sending Slack reminder…</span>
        </div>
      </div>
    } @else if (store.lastNudgeResult()) {
      <div
        class="toast toast-top toast-end z-[90] w-[min(27rem,calc(100vw-2rem))]"
        aria-live="polite"
      >
        <div
          class="alert grid-cols-[auto_minmax(0,1fr)_auto] shadow-xl"
          [class.alert-success]="store.nudgeSummary().failed === 0"
          [class.alert-warning]="store.nudgeSummary().failed > 0"
          role="status"
        >
          <ng-icon
            [svg]="
              store.nudgeSummary().failed === 0 ? icons.success : icons.warning
            "
            size="20"
            strokeWidth="2"
          />
          <span>
            Nudge finished: {{ store.nudgeSummary().sent }} sent,
            {{ store.nudgeSummary().unavailable }} unavailable,
            {{ store.nudgeSummary().failed }} failed.
          </span>
          <button
            class="btn btn-xs btn-ghost"
            type="button"
            aria-label="Dismiss nudge result"
            (click)="store.clearNudgeResult()"
          >
            <ng-icon [svg]="icons.close" size="16" strokeWidth="2" />
          </button>
        </div>
      </div>
    } @else if (store.nudgeError()) {
      <div
        class="toast toast-top toast-end z-[90] w-[min(27rem,calc(100vw-2rem))]"
        aria-live="assertive"
      >
        <div
          class="alert alert-error grid-cols-[auto_minmax(0,1fr)_auto] shadow-xl"
          role="alert"
        >
          <ng-icon [svg]="icons.warning" size="20" strokeWidth="2" />
          <span>{{ store.nudgeError() }}</span>
          <button
            class="btn btn-xs btn-ghost"
            type="button"
            aria-label="Dismiss nudge error"
            (click)="store.clearNudgeResult()"
          >
            <ng-icon [svg]="icons.close" size="16" strokeWidth="2" />
          </button>
        </div>
      </div>
    }
  `,
})
export class NudgeFeedbackComponent {
  protected readonly store = inject(PulseStore);
  protected readonly icons = {
    success: heroCheckCircle,
    warning: heroExclamationTriangle,
    close: heroXMark,
  } as const;
}
