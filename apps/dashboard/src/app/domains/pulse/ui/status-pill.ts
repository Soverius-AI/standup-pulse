import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RuntimeState } from './types';

const PILL_CLASSES: Record<RuntimeState, string> = {
  online: 'badge-soft badge-success',
  degraded: '',
  offline: '',
  unknown: 'badge-ghost text-base-content/65',
};

const DOT_CLASSES: Record<RuntimeState, string> = {
  online: 'status-success',
  degraded: 'status-warning',
  offline: 'status-error',
  unknown: '',
};

@Component({
  selector: 'app-pulse-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="badge min-h-8.5 gap-1.5 rounded-lg px-2.5 text-xs font-semibold shadow-sm"
      [class]="pillClasses()"
      [attr.title]="detail() || label()"
    >
      <span class="status" [class]="dotClasses()" aria-hidden="true"></span>
      <span>{{ label() }}</span>
      <span class="sr-only">— {{ state() }}</span>
    </span>
  `,
})
export class StatusPillComponent {
  readonly label = input.required<string>();
  readonly state = input<RuntimeState>('unknown');
  readonly detail = input<string>();
  protected readonly pillClasses = computed(() => PILL_CLASSES[this.state()]);
  protected readonly dotClasses = computed(() => DOT_CLASSES[this.state()]);
}
