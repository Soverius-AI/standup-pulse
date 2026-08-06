import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroExclamationTriangle,
  heroFlag,
  heroMegaphone,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { TeamPulseViewModel } from '@standup-pulse/shared-contracts';

@Component({
  selector: 'lib-pulse-attention-banner',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="attention-banner" aria-labelledby="attention-title">
      <div class="attention-banner__summary">
        <span class="attention-banner__icon" aria-hidden="true">
          <ng-icon [svg]="icons.warning" size="23" strokeWidth="2" />
        </span>
        <h2 id="attention-title">
          {{ pulse().totals.missing }} haven’t posted
          <span aria-hidden="true">·</span>
          {{ pulse().totals.blocked }} blockers need attention
        </h2>
      </div>
      <div class="attention-banner__actions">
        <button
          class="btn btn-sm btn-outline btn-warning"
          type="button"
          [disabled]="
            !store.canNudge() ||
            store.isNudging() ||
            store.nudgeableMissingMemberIds().length === 0
          "
          [attr.title]="nudgeTitle()"
          (click)="nudgeMissing()"
        >
          <ng-icon [svg]="icons.megaphone" size="18" strokeWidth="1.8" />
          {{ store.isNudging() ? 'Sending…' : 'Nudge missing' }}
        </button>
        <button
          class="btn btn-sm btn-warning"
          type="button"
          (click)="focusBlockers()"
        >
          <ng-icon [svg]="icons.flag" size="18" strokeWidth="1.8" />
          Review blockers
        </button>
      </div>
    </section>
  `,
})
export class AttentionBannerComponent {
  readonly pulse = input.required<TeamPulseViewModel>();
  protected readonly store = inject(PulseStore);
  protected readonly icons = {
    warning: heroExclamationTriangle,
    megaphone: heroMegaphone,
    flag: heroFlag,
  } as const;

  protected readonly nudgeTitle = computed(() =>
    this.store.canNudge()
      ? 'Send a Slack reminder'
      : 'Proactive Slack delivery is unavailable in the current Channel runtime',
  );

  protected nudgeMissing(): void {
    this.store.nudgeMembers(this.store.nudgeableMissingMemberIds());
  }

  protected focusBlockers(): void {
    if (typeof document === 'undefined') return;
    document.querySelector('#blockers-panel')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}
