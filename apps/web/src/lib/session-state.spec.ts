import { describe, expect, it } from 'vitest';
import { clearSession, initialSessionState, selectOrganization, startSession } from './session-state';

const user = { id: 'user-1', username: 'admin' };
const first = { id: '1', code: 'FIRST', name: 'First', contactEmail: null, contactPhone: null, officeAddress: null, createdAt: '', updatedAt: '' };
const second = { ...first, id: '2', name: 'Second' };

describe('session state', () => {
  it('clears the identity and selected organization on logout', () => {
    const selected = selectOrganization(startSession(user, 'session-1'), first);
    expect(selected.user).toEqual(user);
    expect(clearSession()).toEqual(initialSessionState);
  });
  it('replaces the selected organization', () => {
    expect(selectOrganization(selectOrganization(startSession(user, 'session-1'), first), second).selectedOrganization).toEqual(second);
  });
});
