import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  heroPencilSquare,
  heroSignal,
  heroUserPlus,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';

@Component({
  selector: 'app-pulse-team-page',
  imports: [NgIcon],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto w-full max-w-6xl" aria-labelledby="team-title">
      <div
        class="card card-border mb-4 min-h-26 flex-row items-center justify-between gap-6 bg-base-100/90 p-5 shadow-sm @max-2xl/main:flex-col @max-2xl/main:items-start"
      >
        <div>
          <p
            class="text-2xs font-extrabold uppercase tracking-widest text-primary"
          >
            Roster
          </p>
          <h2
            id="team-title"
            class="mt-0.5 text-xl font-extrabold tracking-tight"
          >
            Team members
          </h2>
          <p class="mt-1 text-xs text-base-content/60">
            Manage who is included in the daily pulse and connect Slack
            identities.
          </p>
        </div>
        <button
          class="btn btn-primary btn-sm @max-2xl/main:w-full"
          type="button"
          (click)="openCreateMember()"
        >
          <ng-icon [svg]="icons.userPlus" size="18" strokeWidth="1.9" />
          Add member
        </button>
      </div>

      @if (store.memberMutationError()) {
        <div class="alert alert-error mb-4" role="alert">
          <span>{{ store.memberMutationError() }}</span>
          <button
            class="btn btn-xs btn-ghost ml-auto"
            type="button"
            (click)="store.clearMemberMutation()"
          >
            Dismiss
          </button>
        </div>
      }

      @if (store.roster(); as roster) {
        <div
          class="grid grid-cols-2 gap-3.5 @max-2xl/main:grid-cols-1"
          aria-label="Team roster"
        >
          @for (member of roster.members; track member.id) {
            <article
              class="card card-border relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-4 bg-base-100/90 p-5 shadow-sm"
              [class.opacity-70]="!member.active"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="grid size-11 shrink-0 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-[#4e5dc5] to-[#243568] text-xs font-extrabold text-white shadow-sm"
                  aria-hidden="true"
                >
                  {{ initials(member.displayName) }}
                </span>
                <div class="min-w-0">
                  <h3 class="truncate text-sm font-bold">
                    {{ member.displayName }}
                  </h3>
                  <p class="mt-0.5 truncate text-xs text-base-content/60">
                    {{ member.email || 'No email address' }}
                  </p>
                </div>
              </div>
              <div class="col-span-full flex flex-wrap gap-1.5">
                <span
                  class="badge badge-sm gap-1"
                  [class.badge-success]="member.slackLinked"
                  [class.badge-ghost]="!member.slackLinked"
                >
                  <ng-icon [svg]="icons.signal" size="14" strokeWidth="2" />
                  {{ member.slackLinked ? 'Slack linked' : 'Not linked' }}
                </span>
                <span
                  class="badge badge-sm"
                  [class.badge-primary]="member.active"
                  [class.badge-ghost]="!member.active"
                >
                  {{ member.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <button
                class="btn btn-sm btn-outline col-start-2 row-start-1"
                type="button"
                (click)="openEditMember(member.id)"
              >
                <ng-icon [svg]="icons.edit" size="17" strokeWidth="1.9" />
                Edit
              </button>
            </article>
          } @empty {
            <div
              class="col-span-full rounded-lg border border-dashed border-base-300 bg-base-200 p-6 text-center text-xs text-base-content/60"
            >
              No team members yet. Add the first member to start the standup
              roster.
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class TeamPageComponent {
  protected readonly store = inject(PulseStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly icons = {
    userPlus: heroUserPlus,
    signal: heroSignal,
    edit: heroPencilSquare,
  } as const;

  protected openCreateMember(): void {
    this.store.clearMemberMutation();
    this.openMemberOutlet(['member', 'new']);
  }

  protected openEditMember(memberId: string): void {
    this.store.clearMemberMutation();
    this.openMemberOutlet(['member', memberId, 'edit']);
  }

  private openMemberOutlet(commands: string[]): void {
    void this.router.navigate([{ outlets: { modal: commands } }], {
      relativeTo: this.route.parent,
    });
  }

  protected initials(displayName: string): string {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
}
