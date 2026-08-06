import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadChildren: () =>
      import('@standup-pulse/dashboard-feature-pulse').then(
        ({ PULSE_DASHBOARD_ROUTES }) => PULSE_DASHBOARD_ROUTES,
      ),
  },
  { path: '**', redirectTo: '' },
];
