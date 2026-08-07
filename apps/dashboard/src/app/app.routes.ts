import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () =>
      import('./domains/pulse/feature-shell/pulse-dashboard.routes').then(
        ({ PULSE_DASHBOARD_ROUTES }) => PULSE_DASHBOARD_ROUTES,
      ),
  },
  { path: '**', redirectTo: '' },
];
