import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
} from '@angular/core';

const COMPOSER_SELECTOR = '.copilotKitInput';
const COMPOSER_GAP_PX = 16;

/**
 * Adapts CopilotKit's full-page chat viewport to the dashboard drawer.
 *
 * CopilotKit does not currently expose the floating composer height as part of
 * its public Angular API, so this compatibility boundary owns the one internal
 * selector we need and publishes only a CSS custom property to the app shell.
 */
@Directive({
  selector: '[appPulseCopilotComposerLayout]',
})
export class CopilotComposerLayoutDirective {
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.#observeComposer());
  }

  #observeComposer(): void {
    if (
      typeof MutationObserver === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    const host = this.#host.nativeElement;
    let composer: HTMLElement | null = null;
    let animationFrame: number | null = null;

    const measure = (): void => {
      animationFrame = null;
      const nextComposer = host.querySelector<HTMLElement>(COMPOSER_SELECTOR);

      if (nextComposer !== composer) {
        if (composer) resizeObserver.unobserve(composer);
        composer = nextComposer;
        if (composer) resizeObserver.observe(composer);
      }

      if (!composer) {
        host.style.removeProperty('--pulse-chat-composer-reserve');
        return;
      }

      const reserve = Math.max(
        0,
        Math.ceil(
          host.getBoundingClientRect().bottom -
            composer.getBoundingClientRect().top +
            COMPOSER_GAP_PX,
        ),
      );
      const value = `${reserve}px`;
      if (
        host.style.getPropertyValue('--pulse-chat-composer-reserve') !== value
      ) {
        host.style.setProperty('--pulse-chat-composer-reserve', value);
      }
    };

    const scheduleMeasure = (): void => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const mutationObserver = new MutationObserver(scheduleMeasure);
    resizeObserver.observe(host);
    mutationObserver.observe(host, { childList: true, subtree: true });
    scheduleMeasure();

    this.#destroyRef.onDestroy(() => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  }
}
