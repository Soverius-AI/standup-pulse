import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideCopilotKit } from '@copilotkit/angular';
import { appRoutes } from './app.routes';
import { STANDUP_COPILOT_CONFIG } from './copilot.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(appRoutes),
    provideCopilotKit(STANDUP_COPILOT_CONFIG),
  ],
};
