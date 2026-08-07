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
import { PulseStore } from '../data/pulse.store';
import { TeamPulseViewModel } from '@standup-pulse/shared-contracts';

@Component({
  selector: 'app-pulse-attention-banner',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="attention-banner alert alert-warning alert-soft mx-auto mb-4 flex min-h-21.5 w-full max-w-6xl items-center justify-between gap-4 @max-4xl/main:flex-col @max-4xl/main:items-start"
      aria-labelledby="attention-title"
    >
      <div
        class="flex min-w-0 flex-1 items-center gap-3 @max-4xl/main:w-full @max-4xl/main:flex-none max-[32rem]:items-start"
      >
        <span
          class="grid size-9.5 shrink-0 place-items-center rounded-full bg-warning font-extrabold text-warning-content"
          aria-hidden="true"
        >
          <ng-icon [svg]="icons.warning" size="23" strokeWidth="2" />
        </span>
        <h2
          id="attention-title"
          class="min-w-0 text-base font-bold tracking-tight [overflow-wrap:anywhere] max-[32rem]:text-sm"
        >
          {{ pulse().totals.missing }} haven’t posted
          <span aria-hidden="true">·</span>
          {{ pulse().totals.blocked }} blockers need attention
        </h2>
      </div>
      <div
        class="flex flex-wrap items-center justify-end gap-3 @max-4xl/main:w-full @max-4xl/main:justify-start max-[32rem]:grid max-[32rem]:grid-cols-1"
      >
        <button
          class="btn btn-sm btn-outline btn-warning max-w-full whitespace-nowrap max-md:flex-1"
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
          class="btn btn-sm btn-warning max-w-full whitespace-nowrap max-md:flex-1"
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
