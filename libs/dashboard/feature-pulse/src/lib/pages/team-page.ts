import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  heroPencilSquare,
  heroSignal,
  heroUserPlus,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';

@Component({
  selector: 'lib-pulse-team-page',
  imports: [NgIcon],
  host: { class: 'pulse-route-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pulse-view" aria-labelledby="team-title">
      <div class="pulse-view__toolbar">
        <div>
          <p class="pulse-card__eyebrow">Roster</p>
          <h2 id="team-title">Team members</h2>
          <p>
            Manage who is included in the daily pulse and connect Slack
            identities.
          </p>
        </div>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          (click)="openCreateMember()"
        >
          <ng-icon [svg]="icons.userPlus" size="18" strokeWidth="1.9" />
          Add member
        </button>
      </div>

      @if (store.memberMutationError()) {
        <div class="alert alert-error pulse-view__notice" role="alert">
          <span>{{ store.memberMutationError() }}</span>
          <button
            class="btn btn-xs btn-ghost"
            type="button"
            (click)="store.clearMemberMutation()"
          >
            Dismiss
          </button>
        </div>
      }

      @if (store.roster(); as roster) {
        <div class="team-grid" aria-label="Team roster">
          @for (member of roster.members; track member.id) {
            <article
              class="team-card"
              [class.team-card--inactive]="!member.active"
            >
              <div class="team-card__identity">
                <span
                  class="pulse-avatar pulse-avatar--large"
                  aria-hidden="true"
                >
                  {{ initials(member.displayName) }}
                </span>
                <div class="min-w-0">
                  <h3>{{ member.displayName }}</h3>
                  <p>{{ member.email || 'No email address' }}</p>
                </div>
              </div>
              <div class="team-card__meta">
                <span
                  class="badge badge-sm"
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
                class="btn btn-sm btn-outline team-card__edit"
                type="button"
                (click)="openEditMember(member.id)"
              >
                <ng-icon [svg]="icons.edit" size="17" strokeWidth="1.9" />
                Edit
              </button>
            </article>
          } @empty {
            <div class="pulse-empty team-grid__empty">
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
