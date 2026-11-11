// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '../lib/api-client';
import { HelpRequestsTab } from './help-requests-tab';

const pending = { id: 'request-1', requesterName: 'Synthetic Person', requesterPhone: '123', requesterEmail: 'person@example.test', groupSize: 2, locationDescription: 'Test location', canTravelIndependently: false, medicalSupportNeeded: true, status: 'PENDING_REVIEW' };
const assignment = { id: 'assignment-1', shelterName: 'Test Hall', reservedGroupSize: 2 };
const map = { operation: { status: 'ACTIVE' }, activeShelterAvailability: [
  { shelterActivationId: 'activation-1', name: 'Test Hall', latitude: null, longitude: null, capacity: 10, availability: { operationalCapacity: 10, availablePlaces: 5, acceptingArrivals: true } },
  { shelterActivationId: 'activation-2', name: 'Unreported Hall', capacity: 10, availability: null },
  { shelterActivationId: 'activation-3', name: 'Closed Hall', capacity: 10, availability: { operationalCapacity: 10, availablePlaces: 5, acceptingArrivals: false } },
  { shelterActivationId: 'activation-4', name: 'Small Hall', capacity: 10, availability: { operationalCapacity: 10, availablePlaces: 1, acceptingArrivals: true } },
] };
/** Provides synthetic queue and shelter responses for the operator view. */
function apiFixture() {
  return {
    getOperatorHelpRequests: vi.fn().mockImplementation((_token, _operation, status) => Promise.resolve({ items: status === 'RESERVED' ? [{ ...pending, status: 'RESERVED', assignment }] : [pending], nextCursor: null })),
    getEmergencyOperationMap: vi.fn().mockResolvedValue(map),
    assignHelpRequest: vi.fn().mockResolvedValue(assignment),
  };
}
/** Opens the first responsive review button and returns its modal. */
async function openReview() {
  const buttons = await screen.findAllByRole('button', { name: 'Review & assign' });
  fireEvent.click(buttons[0]);
  return screen.getByRole('dialog', { name: 'Review & assign' });
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
afterEach(cleanup);
describe('HelpRequestsTab', () => {
  it('renders a pending table and opens request details with eligible shelter choices', async () => {
    const api = apiFixture();
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(api.getOperatorHelpRequests).toHaveBeenCalledWith('token', 'op-1', 'PENDING_REVIEW', undefined, expect.any(AbortSignal));
    const dialog = await openReview();
    expect(within(dialog).getByText('person@example.test')).toBeTruthy();
    expect(within(dialog).getByText('Test location')).toBeTruthy();
    expect((within(dialog).getByRole('radio', { name: /Test Hall/ }) as HTMLInputElement).disabled).toBe(false);
    for (const name of ['Unreported Hall', 'Closed Hall', 'Small Hall']) expect((within(dialog).getByRole('radio', { name: new RegExp(name) }) as HTMLInputElement).disabled).toBe(true);
  });
  it('shows attention, neutral, and unreported answers consistently', async () => {
    const api = apiFixture();
    api.getOperatorHelpRequests.mockResolvedValueOnce({ items: [
      pending,
      { ...pending, id: 'request-2', requesterName: 'Second Person', medicalSupportNeeded: false, canTravelIndependently: true },
      { ...pending, id: 'request-3', requesterName: 'Third Person', medicalSupportNeeded: null, canTravelIndependently: undefined },
    ], nextCursor: null });
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    const answers = rows.map((row) => within(row).getAllByRole('cell').slice(2, 4).map((cell) => cell.querySelector('span')!));
    expect(answers.map((row) => row.map((answer) => answer.textContent))).toEqual([['Yes', 'No'], ['No', 'Yes'], ['Not reported', 'Not reported']]);
    expect(answers[0].every((answer) => answer.className.includes('border-amber-500') && answer.className.includes('bg-amber-200'))).toBe(true);
    expect(answers[1].every((answer) => answer.className.includes('border-blue-400') && answer.className.includes('bg-blue-100'))).toBe(true);
    expect(answers[2].every((answer) => answer.className.includes('border-slate-400') && answer.className.includes('bg-slate-100'))).toBe(true);
    const dialog = await openReview();
    const medical = within(dialog).getByText('Medical support needed').nextElementSibling?.querySelector('span');
    const travel = within(dialog).getByText('Can travel independently').nextElementSibling?.querySelector('span');
    expect(medical?.textContent).toBe('Yes');
    expect(travel?.textContent).toBe('No');
    expect(medical?.className).toContain('border-amber-500');
    expect(travel?.className).toContain('border-amber-500');
  });
  it('submits a selected shelter and refreshes the confirmed assignment', async () => {
    const api = apiFixture();
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    const dialog = await openReview();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Test Hall/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm assignment' }));
    expect(await screen.findByText('Assignment confirmed: Test Hall, 2 places reserved.')).toBeTruthy();
    expect(api.assignHelpRequest).toHaveBeenCalledWith('token', 'op-1', 'request-1', 'activation-1', expect.any(AbortSignal));
    await waitFor(() => expect(api.getEmergencyOperationMap).toHaveBeenCalledTimes(2));
  });
  it('refreshes after a conflict without showing success', async () => {
    const api = apiFixture();
    api.assignHelpRequest.mockRejectedValue(new ApiError(409, 'Conflict'));
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    const dialog = await openReview();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Test Hall/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm assignment' }));
    expect(await within(dialog).findByText(/may have changed/)).toBeTruthy();
    expect(screen.queryByText(/Assignment confirmed/)).toBeNull();
    await waitFor(() => expect(api.getEmergencyOperationMap).toHaveBeenCalledTimes(2));
  });
  it('keeps the selected shelter for a safe retry after an uncertain network failure', async () => {
    const api = apiFixture();
    api.assignHelpRequest.mockRejectedValueOnce(new ApiError(0, 'Network'));
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    const dialog = await openReview();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Test Hall/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm assignment' }));
    expect(await within(dialog).findByText(/outcome is unknown/)).toBeTruthy();
    expect(screen.queryByText(/Assignment confirmed/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm assignment' }));
    expect(await screen.findByText(/Assignment confirmed/)).toBeTruthy();
    expect(api.assignHelpRequest).toHaveBeenCalledTimes(2);
  });
  it('loads persisted assignment information in the reserved view after remount', async () => {
    const api = apiFixture();
    const view = render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    await screen.findByRole('table');
    view.unmount();
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reserved' }));
    expect((await screen.findAllByText('Test Hall · 2 places reserved')).length).toBeGreaterThan(0);
  });
  it('closes by Escape and restores focus to the invoking button', async () => {
    const api = apiFixture();
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    const trigger = (await screen.findAllByRole('button', { name: 'Review & assign' }))[0];
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    // jsdom does not implement the browser's default Escape-to-close behavior.
    (dialog as HTMLDialogElement).close();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it('ignores a late pending response after switching to reserved', async () => {
    const api = apiFixture();
    let resolve!: (value: unknown) => void;
    api.getOperatorHelpRequests.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reserved' }));
    expect((await screen.findAllByText('Test Hall · 2 places reserved')).length).toBeGreaterThan(0);
    await act(async () => resolve({ items: [{ ...pending, requesterName: 'Old request' }], nextCursor: null }));
    expect(screen.queryByText('Old request')).toBeNull();
  });
  it('does not replace a new operation with an earlier operation response', async () => {
    const api = apiFixture();
    let resolve!: (value: unknown) => void;
    api.getOperatorHelpRequests.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="old-op" />);
    view.rerender(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="new-op" />);
    await screen.findByRole('table');
    await act(async () => resolve({ items: [{ ...pending, requesterName: 'Earlier operation' }], nextCursor: null }));
    expect(screen.queryByText('Earlier operation')).toBeNull();
    expect(api.getOperatorHelpRequests).toHaveBeenCalledWith('token', 'new-op', 'PENDING_REVIEW', undefined, expect.any(AbortSignal));
  });
  it('loads the next cursor only after the operator asks', async () => {
    const api = apiFixture();
    api.getOperatorHelpRequests.mockResolvedValueOnce({ items: [pending], nextCursor: 'next-page' }).mockResolvedValueOnce({ items: [{ ...pending, id: 'request-2', requesterName: 'Second Person' }], nextCursor: null });
    render(<HelpRequestsTab accessToken="token" api={api as unknown as ApiClient} operationId="op-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect((await screen.findAllByText('Second Person')).length).toBeGreaterThan(0);
    expect(api.getOperatorHelpRequests).toHaveBeenCalledTimes(2);
    expect(api.getOperatorHelpRequests).toHaveBeenLastCalledWith('token', 'op-1', 'PENDING_REVIEW', 'next-page', expect.any(AbortSignal));
  });

});
