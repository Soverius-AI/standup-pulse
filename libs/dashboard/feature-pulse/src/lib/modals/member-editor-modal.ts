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
import { PulseStore } from '@standup-pulse/dashboard-data-access';

type MemberModalMode = 'create' | 'edit';

@Component({
  selector: 'lib-pulse-member-editor-modal',
  imports: [NgIcon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      class="modal modal-open member-modal"
      open
      aria-labelledby="member-modal-title"
    >
      <div class="modal-box">
        <div class="member-modal__header">
          <div>
            <p class="pulse-card__eyebrow">Team roster</p>
            <h2 id="member-modal-title">
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

        <form class="member-form" [formGroup]="form" (ngSubmit)="save()">
          <label class="form-control">
            <span class="label-text">Display name</span>
            <input
              class="input input-bordered w-full"
              formControlName="displayName"
              autocomplete="name"
              placeholder="Ada Lovelace"
            />
            @if (
              form.controls.displayName.touched &&
              form.controls.displayName.invalid
            ) {
              <span class="member-form__error"
                >A display name is required.</span
              >
            }
          </label>
          <label class="form-control">
            <span class="label-text">Email</span>
            <input
              class="input input-bordered w-full"
              formControlName="email"
              type="email"
              autocomplete="email"
              placeholder="ada@example.com"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <span class="member-form__error"
                >Enter a valid email address.</span
              >
            }
          </label>
          <label class="form-control">
            <span class="label-text">Slack user ID</span>
            <input
              class="input input-bordered w-full"
              formControlName="slackUserId"
              placeholder="U012ABC3456"
            />
            <span class="label-text-alt">
              {{
                mode === 'edit'
                  ? 'Leave blank to keep the current Slack link.'
                  : 'Optional. Find this in the Slack profile.'
              }}
            </span>
          </label>
          @if (mode === 'edit') {
            <label class="member-form__toggle">
              <input
                class="toggle toggle-primary"
                type="checkbox"
                formControlName="active"
              />
              <span>
                <strong>Active member</strong>
                <small>Include this person in daily participation.</small>
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
  protected readonly mode = this.route.snapshot.data['mode'] as MemberModalMode;
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
