import { describe, expect, it } from 'vitest';
import {
  clearSession,
  initialSessionState,
  selectOrganization,
  startSession,
} from './session-state';

const firstOrganization = {
  id: '11111111-1111-1111-1111-111111111111', code: 'FIRST', name: 'First organization', contactEmail: null, contactPhone: null, officeAddress: null, createdAt: '', updatedAt: '',
};
const secondOrganization = { ...firstOrganization, id: '22222222-2222-2222-2222-222222222222', code: 'SECOND', name: 'Second organization' };

describe('session state', () => {
  it('starts only in memory and clears token and selected organization on logout', () => {
    const selected = selectOrganization(startSession('access-token'), firstOrganization);

    expect(selected.accessToken).toBe('access-token');
    expect(clearSession()).toEqual(initialSessionState);
    expect(initialSessionState.accessToken).toBeNull();
  });

  it('replaces the selected organization when switching', () => {
    const firstSelection = selectOrganization(startSession('access-token'), firstOrganization);
    const secondSelection = selectOrganization(firstSelection, secondOrganization);

    expect(secondSelection.selectedOrganization).toEqual(secondOrganization);
  });
});
