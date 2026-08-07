import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { PulseStore } from '../data/pulse.store';
import { TeamPulseViewModel } from '@standup-pulse/shared-contracts';
import { DashboardUiStore } from '../data/dashboard-ui.store';

@Component({
  selector: 'app-pulse-standup-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="card card-border min-w-0 overflow-hidden bg-base-100/90 shadow-sm"
      aria-labelledby="standups-title"
    >
      <div
        class="flex min-h-18 items-center justify-between gap-4 px-4 pt-4 pb-3"
      >
        <div>
          <p
            class="text-2xs font-extrabold uppercase tracking-widest text-primary"
          >
            Exception-first
          </p>
          <h2
            id="standups-title"
            class="mt-px text-lg font-extrabold tracking-tight"
          >
            Today’s standup
          </h2>
        </div>
        <span class="badge badge-ghost"
          >{{ pulse().totals.roster }} people</span
        >
      </div>

      @if (store.orderedStandups().length) {
        <div
          class="grid grid-cols-[minmax(6.25rem,1.1fr)_4.25rem_minmax(5rem,1.6fr)_3.375rem] items-center gap-2.5 border-y border-base-200 px-4 py-2.5 text-2xs font-semibold text-base-content/50 max-md:hidden"
          aria-hidden="true"
        >
          <span>Member</span><span>Status</span><span>Update preview</span
          ><span>Action</span>
        </div>
        <ul>
          @for (standup of store.orderedStandups(); track standup.memberId) {
            <li
              class="grid min-h-19.5 grid-cols-[minmax(6.25rem,1.1fr)_4.25rem_minmax(5rem,1.6fr)_3.375rem] items-center gap-2.5 border-b border-base-200 px-4 py-3 last:border-b-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-2"
              [class]="standup.status !== 'posted' ? 'bg-warning/10' : ''"
            >
              <div class="flex min-w-0 items-center gap-2 text-xs font-bold">
                <span
                  class="grid size-8.5 shrink-0 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-[#4e5dc5] to-[#243568] text-2xs font-extrabold text-white shadow-sm"
                  aria-hidden="true"
                  >{{ initials(standup.displayName) }}</span
                >
                <span>{{ standup.displayName }}</span>
              </div>
              <span
                class="badge badge-sm"
                [class.badge-warning]="standup.status === 'missing'"
                [class.badge-error]="standup.status === 'blocked'"
                [class.badge-success]="standup.status === 'posted'"
                >{{ statusLabel(standup.status) }}</span
              >
              <p
                class="line-clamp-2 min-w-0 text-xs leading-relaxed text-base-content/70 max-md:col-span-full max-md:row-start-2"
              >
                {{
                  standup.preview ||
                    (standup.status === 'missing'
                      ? 'No update yet.'
                      : 'No preview available.')
                }}
              </p>
              <div class="text-right max-md:col-start-2 max-md:row-start-1">
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
        <div
          class="mx-4 mb-4.5 rounded-lg border border-dashed border-base-300 bg-base-200 p-6 text-center text-xs text-base-content/60"
        >
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
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  protected statusLabel(status: 'posted' | 'missing' | 'blocked'): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
