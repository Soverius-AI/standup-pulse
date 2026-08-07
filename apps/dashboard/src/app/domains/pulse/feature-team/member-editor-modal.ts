import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';
import { parseMemberModalMode } from './member-editor-route';

@Component({
  selector: 'app-pulse-member-editor-modal',
  imports: [NgIcon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog class="modal modal-open" open aria-labelledby="member-modal-title">
      <div
        class="modal-box w-[min(32rem,calc(100vw-1.5rem))] max-w-lg border border-base-300 p-0"
      >
        <div
          class="flex items-center justify-between border-b border-base-300 px-5 pt-5 pb-4"
        >
          <div>
            <p
              class="text-2xs font-extrabold uppercase tracking-widest text-primary"
            >
              Team roster
            </p>
            <h2
              id="member-modal-title"
              class="mt-0.5 text-xl font-extrabold tracking-tight"
            >
              {{ mode === 'create' ? 'Add member' : 'Edit member' }}
            </h2>
          </div>
          <button
            class="btn btn-circle btn-ghost btn-sm"
            type="button"
            aria-label="Close member editor"
            (click)="close()"
          >
            <ng-icon [svg]="closeIcon" size="20" strokeWidth="2" />
          </button>
        </div>

        <form class="grid gap-4 p-5" [formGroup]="form" (ngSubmit)="save()">
          <fieldset class="fieldset p-0">
            <legend class="fieldset-legend text-xs">Display name</legend>
            <input
              class="input w-full"
              formControlName="displayName"
              autocomplete="name"
              placeholder="Ada Lovelace"
            />
            @if (
              form.controls.displayName.touched &&
              form.controls.displayName.invalid
            ) {
              <p class="text-2xs text-error">A display name is required.</p>
            }
          </fieldset>
          <fieldset class="fieldset p-0">
            <legend class="fieldset-legend text-xs">Email</legend>
            <input
              class="input w-full"
              formControlName="email"
              type="email"
              autocomplete="email"
              placeholder="ada@example.com"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="text-2xs text-error">Enter a valid email address.</p>
            }
          </fieldset>
          <fieldset class="fieldset p-0">
            <legend class="fieldset-legend text-xs">Slack user ID</legend>
            <input
              class="input w-full"
              formControlName="slackUserId"
              placeholder="U012ABC3456"
            />
            <p class="label text-2xs">
              {{
                mode === 'edit'
                  ? 'Leave blank to keep the current Slack link.'
                  : 'Optional. Find this in the Slack profile.'
              }}
            </p>
          </fieldset>
          @if (mode === 'edit') {
            <label
              class="flex items-center gap-3 rounded-lg border border-base-300 p-3"
            >
              <input
                class="toggle toggle-primary"
                type="checkbox"
                formControlName="active"
              />
              <span class="grid gap-0.5">
                <strong class="text-xs">Active member</strong>
                <small class="text-2xs text-base-content/55"
                  >Include this person in daily participation.</small
                >
              </span>
            </label>
          }
          <div class="modal-action">
            <button class="btn btn-ghost" type="button" (click)="close()">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              type="submit"
              [disabled]="
                form.invalid || store.memberMutationStatus() === 'saving'
              "
            >
              @if (store.memberMutationStatus() === 'saving') {
                <span class="loading loading-spinner loading-sm"></span>
              }
              {{ mode === 'create' ? 'Add member' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
      <button
        class="modal-backdrop"
        type="button"
        aria-label="Close member editor"
        (click)="close()"
      ></button>
    </dialog>
  `,
})
export class MemberEditorModalComponent {
  protected readonly store = inject(PulseStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly closeIcon = heroXMark;
  protected readonly mode = parseMemberModalMode(this.route.snapshot.data);
  private readonly memberId = this.route.snapshot.paramMap.get('memberId');

  protected readonly form = this.formBuilder.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', Validators.email],
    slackUserId: ['', Validators.maxLength(100)],
    active: true,
  });

  private readonly member = computed(() =>
    this.store.roster()?.members.find(({ id }) => id === this.memberId),
  );

  private readonly populateForm = effect(() => {
    const member = this.member();
    this.form.reset({
      displayName: member?.displayName ?? '',
      email: member?.email ?? '',
      slackUserId: '',
      active: member?.active ?? true,
    });
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const displayName = value.displayName.trim();
    const email = value.email.trim();
    const slackUserId = value.slackUserId.trim();

    if (this.mode === 'create') {
      this.store.createRosterMember({
        displayName,
        ...(email ? { email } : {}),
        ...(slackUserId ? { slackUserId } : {}),
      });
    } else if (this.memberId) {
      this.store.updateRosterMember({
        memberId: this.memberId,
        request: {
          displayName,
          email: email || null,
          active: value.active,
          ...(slackUserId ? { slackUserId } : {}),
        },
      });
    }

    this.close();
  }

  protected close(): void {
    void this.router.navigate([{ outlets: { modal: null } }], {
      relativeTo: this.route.parent,
    });
  }
}
