import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateRosterMemberRequest,
  IsoDate,
  NudgeRequest,
  NudgeResponse,
  NudgeResponseSchema,
  RosterMember,
  RosterMemberSchema,
  RosterResponse,
  RosterResponseSchema,
  StatusResponse,
  StatusResponseSchema,
  TeamPulseViewModel,
  TeamPulseViewModelSchema,
  UpdateRosterMemberRequest,
} from '@standup-pulse/shared-contracts';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PulseApiClient {
  private readonly http = inject(HttpClient);

  getTeamPulse(date: IsoDate): Observable<TeamPulseViewModel> {
    return this.http
      .get<unknown>('/api/team-pulse', { params: { date } })
      .pipe(map((response) => TeamPulseViewModelSchema.parse(response)));
  }

  getStatus(): Observable<StatusResponse> {
    return this.http
      .get<unknown>('/api/status')
      .pipe(map((response) => StatusResponseSchema.parse(response)));
  }

  getRoster(): Observable<RosterResponse> {
    return this.http
      .get<unknown>('/api/roster')
      .pipe(map((response) => RosterResponseSchema.parse(response)));
  }

  createRosterMember(
    request: CreateRosterMemberRequest,
  ): Observable<RosterMember> {
    return this.http
      .post<unknown>('/api/roster/members', request)
      .pipe(map((response) => RosterMemberSchema.parse(response)));
  }

  updateRosterMember(
    memberId: string,
    request: UpdateRosterMemberRequest,
  ): Observable<RosterMember> {
    return this.http
      .patch<unknown>(`/api/roster/members/${memberId}`, request)
      .pipe(map((response) => RosterMemberSchema.parse(response)));
  }

  nudge(request: NudgeRequest): Observable<NudgeResponse> {
    return this.http
      .post<unknown>('/api/nudges', request)
      .pipe(map((response) => NudgeResponseSchema.parse(response)));
  }
}
