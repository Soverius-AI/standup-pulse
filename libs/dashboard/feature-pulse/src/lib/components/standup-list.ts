import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { TeamPulseViewModel } from '@standup-pulse/shared-contracts';
import { DashboardUiStore } from '../dashboard-ui.store';

@Component({
  selector: 'lib-pulse-standup-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pulse-card standup-list" aria-labelledby="standups-title">
      <div class="pulse-card__heading">
        <div>
          <p class="pulse-card__eyebrow">Exception-first</p>
          <h2 id="standups-title">Today’s standup</h2>
        </div>
        <span class="badge badge-ghost"
          >{{ pulse().totals.roster }} people</span
        >
      </div>

      @if (store.orderedStandups().length) {
        <div class="standup-list__header" aria-hidden="true">
          <span>Member</span><span>Status</span><span>Update preview</span
          ><span>Action</span>
        </div>
        <ul class="standup-list__rows">
          @for (standup of store.orderedStandups(); track standup.memberId) {
            <li
              class="standup-row"
              [class.standup-row--attention]="standup.status !== 'posted'"
            >
              <div class="standup-row__member">
                <span class="pulse-avatar" aria-hidden="true">{{
                  initials(standup.displayName)
                }}</span>
                <span>{{ standup.displayName }}</span>
              </div>
              <span
                class="badge badge-sm"
                [class.badge-warning]="standup.status === 'missing'"
                [class.badge-error]="standup.status === 'blocked'"
                [class.badge-success]="standup.status === 'posted'"
                >{{ statusLabel(standup.status) }}</span
              >
              <p class="standup-row__preview">
                {{
                  standup.preview ||
                    (standup.status === 'missing'
                      ? 'No update yet.'
                      : 'No preview available.')
                }}
              </p>
              <div class="standup-row__action">
                @if (standup.status === 'missing') {
                  <button
                    class="btn btn-xs btn-outline btn-warning"
                    type="button"
                    [disabled]="
                      !canNudgeMember(standup.memberId) || store.isNudging()
                    "
                    [attr.title]="nudgeMemberTitle(standup.memberId)"
                    (click)="store.nudgeMembers([standup.memberId])"
                  >
                    @if (
                      store.pendingNudgeMemberIds().includes(standup.memberId)
                    ) {
                      <span
                        class="loading loading-spinner loading-xs"
                        aria-hidden="true"
                      ></span>
                      Sending…
                    } @else {
                      Nudge
                    }
                  </button>
                } @else if (standup.status === 'blocked' && standup.blockerId) {
                  <button
                    class="btn btn-xs btn-outline"
                    type="button"
                    (click)="ui.selectBlocker(standup.blockerId)"
                  >
                    View
                  </button>
                } @else {
                  <span class="text-xs text-base-content/45">Received</span>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="pulse-empty">
          No roster members are active for this date.
        </div>
      }
    </section>
  `,
})
export class StandupListComponent {
  readonly pulse = input.required<TeamPulseViewModel>();
  protected readonly store = inject(PulseStore);
  protected readonly ui = inject(DashboardUiStore);

  protected canNudgeMember(memberId: string): boolean {
    return (
      this.store.canNudge() &&
      this.store
        .roster()
        ?.members.some(
          (member) =>
            member.id === memberId && member.active && member.slackLinked,
        ) === true
    );
  }

  protected nudgeMemberTitle(memberId: string): string {
    return this.canNudgeMember(memberId)
      ? 'Send a Slack reminder'
      : 'Link this member to Slack before sending a reminder';
  }

  protected initials(displayName: string): string {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected statusLabel(status: 'posted' | 'missing' | 'blocked'): string {
    return status[0].toUpperCase() + status.slice(1);
  }
}
