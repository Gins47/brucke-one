'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, type ApiClient, type DashboardOperationMap, type OperatorHelpRequest } from '../lib/api-client';

type Status = 'PENDING_REVIEW' | 'RESERVED';
type ShelterOption = DashboardOperationMap['activeShelterAvailability'][number];

/** Resets the queue whenever its operation or authenticated session changes. */
export function HelpRequestsTab(props: { sessionKey: string; api: ApiClient; operationId: string; onAssignmentConfirmed?: () => void }) {
  return <HelpRequestsContent key={`${props.sessionKey}:${props.operationId}`} {...props} />;
}

/** Loads one operation's paginated queue and manages assignment review. */
function HelpRequestsContent({ sessionKey, api, operationId, onAssignmentConfirmed }: { sessionKey: string; api: ApiClient; operationId: string; onAssignmentConfirmed?: () => void }) {
  const [status, setStatus] = useState<Status>('PENDING_REVIEW');
  const [requests, setRequests] = useState<OperatorHelpRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [shelters, setShelters] = useState<ShelterOption[]>([]);
  const [operationActive, setOperationActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<OperatorHelpRequest | null>(null);
  const [selection, setSelection] = useState('');
  const [panelError, setPanelError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    controllerRef.current = controller;
    void Promise.all([
      api.getOperatorHelpRequests(sessionKey, operationId, status, undefined, controller.signal),
      api.getEmergencyOperationMap(sessionKey, operationId, controller.signal),
    ]).then(([page, map]) => {
      if (generation.current !== current) return;
      setRequests(page.items);
      setCursor(page.nextCursor);
      setShelters(map.activeShelterAvailability);
      setOperationActive(map.operation.status === 'ACTIVE');
      setLoading(false);
    }).catch(() => {
      if (generation.current !== current) return;
      setError('Unable to load help requests or shelter availability. Please try again.');
      setRequests([]);
      setShelters([]);
      setOperationActive(false);
      setLoading(false);
    });
    return () => { if (generation.current === current) generation.current = current + 1; controller.abort(); };
  }, [sessionKey, api, operationId, status, revision]);

  /** Reloads the first queue page and the authoritative shelter projection. */
  const refresh = () => {
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setRevision((value) => value + 1);
  };

  /** Returns focus to the invoking control, or the queue filter if it was removed. */
  const closeReview = () => {
    setReview(null);
    setSelection('');
    setPanelError('');
    requestAnimationFrame(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else pendingRef.current?.focus();
    });
  };

  /** Loads the next page only for the current status and operation. */
  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await api.getOperatorHelpRequests(sessionKey, operationId, status, cursor, controllerRef.current?.signal);
      if (generation.current !== current) return;
      setRequests((items) => [...items, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      if (generation.current === current) setError('Unable to load more requests. Please try again.');
    } finally {
      if (generation.current === current) setLoadingMore(false);
    }
  };

  /** Submits one assignment while retaining the choice for a safe retry after an uncertain failure. */
  const assign = async () => {
    if (!review || !selection || saving || loading) return;
    const current = generation.current;
    setSaving(true);
    setPanelError('');
    setMessage('');
    try {
      const result = await api.assignHelpRequest(sessionKey, operationId, review.id, selection, controllerRef.current?.signal);
      if (generation.current !== current) return;
      setSaving(false);
      onAssignmentConfirmed?.();
      closeReview();
      setMessage(`Assignment confirmed: ${result.shelterName}, ${result.reservedGroupSize} places reserved.`);
      refresh();
    } catch (caught) {
      if (generation.current !== current) return;
      setSaving(false);
      if (caught instanceof ApiError && caught.status === 409) {
        setPanelError('The request or shelter availability may have changed. Review the refreshed information before trying again.');
        setSelection('');
        refresh();
      } else if (!(caught instanceof ApiError) || caught.status === 0 || caught.status >= 500) {
        setPanelError('The assignment outcome is unknown. You can safely retry the same shelter, or check the Reserved view.');
      } else {
        setPanelError('The assignment could not be submitted. Please review the request and try again.');
      }
    }
  };

  /** Opens the review modal and remembers the actual button that opened it. */
  const openReview = (request: OperatorHelpRequest, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelection('');
    setPanelError('');
    setMessage('');
    setReview(request);
  };

  return <section className="space-y-4" aria-label="Help requests">
    <div className="flex flex-wrap gap-2">
      {([['PENDING_REVIEW', 'Pending review'], ['RESERVED', 'Reserved']] as const).map(([value, label]) => <button ref={value === 'PENDING_REVIEW' ? pendingRef : undefined} key={value} type="button" aria-pressed={status === value} onClick={() => { if (status === value) return; setMessage(''); setError(''); setLoading(true); setLoadingMore(false); setReview(null); setSelection(''); setStatus(value); }} className={`rounded-md px-4 py-2 font-semibold ${status === value ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-800'}`}>{label}</button>)}
    </div>
    {message && <p role="status" className="rounded-md bg-blue-50 p-3 text-blue-900">{message}</p>}
    {error && <p role="alert" className="text-red-700">{error} <button className="underline" type="button" onClick={refresh}>Refresh</button></p>}
    {loading ? <p>Loading help requests…</p> : requests.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">No {status === 'RESERVED' ? 'reserved' : 'pending'} help requests.</p> : <>
      <div className="hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
            <th scope="col" className="p-4">Requester</th><th scope="col" className="p-4">Group size</th><th scope="col" className="p-4">Location</th><th scope="col" className="p-4">Medical support</th><th scope="col" className="p-4">Can travel independently</th><th scope="col" className="p-4">{status === 'RESERVED' ? 'Assignment' : 'Action'}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">{requests.map((request) => <tr key={request.id}>
            <th scope="row" className="p-4 font-semibold">{request.requesterName}</th><td className="p-4">{request.groupSize}</td><td className="p-4">{request.locationDescription}</td><td className="p-4"><Answer value={request.medicalSupportNeeded} attentionValue={true} /></td><td className="p-4"><Answer value={request.canTravelIndependently} attentionValue={false} /></td><td className="p-4"><RequestAction request={request} status={status} onReview={openReview} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">{requests.map((request) => <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{request.requesterName}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><Value label="Group size" value={String(request.groupSize)} /><Value label="Location" value={request.locationDescription} /><Value label="Medical support" value={<Answer value={request.medicalSupportNeeded} attentionValue={true} />} /><Value label="Can travel independently" value={<Answer value={request.canTravelIndependently} attentionValue={false} />} /></dl>
        <div className="mt-4"><RequestAction request={request} status={status} onReview={openReview} /></div>
      </li>)}</ul>
    </>}
    {!loading && cursor && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
    {review && <ReviewDialog request={review} shelters={shelters} operationActive={operationActive} loading={loading} saving={saving} selection={selection} error={panelError} loadError={error} onRefresh={refresh} onSelect={setSelection} onAssign={() => void assign()} onClose={closeReview} />}
  </section>;
}

/** Displays either the assignment summary or the action to review a pending request. */
function RequestAction({ request, status, onReview }: { request: OperatorHelpRequest; status: Status; onReview: (request: OperatorHelpRequest, trigger: HTMLButtonElement) => void }) {
  if (status === 'RESERVED') return <span>{request.assignment ? `${request.assignment.shelterName} · ${request.assignment.reservedGroupSize} places reserved` : 'Assignment details unavailable'}</span>;
  return <button type="button" className="rounded-md border border-blue-700 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" onClick={(event) => onReview(request, event.currentTarget)}>Review &amp; assign</button>;
}

/** Explains whether a reported shelter can be chosen for the current group. */
function shelterDescription(shelter: ShelterOption, groupSize: number): { eligible: boolean; text: string } {
  const report = shelter.availability;
  if (!report) return { eligible: false, text: 'Availability not reported' };
  const places = `${report.availablePlaces} places available`;
  if (!report.acceptingArrivals) return { eligible: false, text: `${places} · Not accepting arrivals` };
  if (report.operationalCapacity > shelter.capacity) return { eligible: false, text: `${places} · Inconsistent capacity` };
  if (report.availablePlaces < groupSize) return { eligible: false, text: `${places} · Not enough places` };
  return { eligible: true, text: `${places} · Accepting arrivals` };
}

/** Presents request details and shelter choices in a keyboard-accessible native modal. */
function ReviewDialog({ request, shelters, operationActive, loading, saving, selection, error, loadError, onRefresh, onSelect, onAssign, onClose }: { request: OperatorHelpRequest; shelters: ShelterOption[]; operationActive: boolean; loading: boolean; saving: boolean; selection: string; error: string; loadError: string; onRefresh: () => void; onSelect: (value: string) => void; onAssign: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { dialog.current?.showModal(); closeButton.current?.focus(); }, []);
  return <dialog ref={dialog} aria-labelledby="review-title" aria-describedby="review-guidance" onClose={onClose} onCancel={(event) => { if (saving) event.preventDefault(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl p-0 shadow-xl backdrop:bg-slate-950/50">
    <div className="p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Help request</p><h2 id="review-title" className="mt-1 text-2xl font-bold">Review &amp; assign</h2></div><button ref={closeButton} type="button" disabled={saving} onClick={() => dialog.current?.close()} className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">Close</button></div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><Value label="Requester" value={request.requesterName} /><Value label="Phone" value={request.requesterPhone} /><Value label="Email" value={request.requesterEmail ?? 'Not provided'} /><Value label="Group size" value={String(request.groupSize)} /><Value label="Location" value={request.locationDescription} /><Value label="Medical support needed" value={<Answer value={request.medicalSupportNeeded} attentionValue={true} />} /><Value label="Can travel independently" value={<Answer value={request.canTravelIndependently} attentionValue={false} />} /></dl>
      <p id="review-guidance" className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Review support needs. Available places do not guarantee suitability or safe travel.</p>
      <fieldset className="mt-6" disabled={saving || loading || !operationActive}><legend className="font-bold">Select a shelter</legend>
        {!operationActive && !loading && <p className="mt-2 text-sm">This operation is not active.</p>}
        {loading ? <p className="mt-2 text-sm">Refreshing shelter availability…</p> : shelters.length === 0 ? <p className="mt-2 text-sm">No active shelters for this operation.</p> : <div className="mt-3 space-y-2">{shelters.map((shelter) => { const option = shelterDescription(shelter, request.groupSize); return <label key={shelter.shelterActivationId} className={`flex gap-3 rounded-lg border p-3 ${option.eligible ? 'border-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><input type="radio" name="shelter" value={shelter.shelterActivationId} checked={selection === shelter.shelterActivationId} disabled={!option.eligible} onChange={() => onSelect(shelter.shelterActivationId)} /><span><span className="block font-semibold">{shelter.name}</span><span className="block text-sm">{option.text}</span></span></label>; })}</div>}
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {loadError && <p role="alert" className="mt-4 text-red-700">{loadError} <button type="button" className="underline" onClick={onRefresh}>Retry refresh</button></p>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={!selection || saving || loading || !operationActive} onClick={onAssign} className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Assigning…' : 'Confirm assignment'}</button><button type="button" disabled={saving} onClick={() => dialog.current?.close()} className="rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">Cancel</button></div>
    </div>
  </dialog>;
}

/** Shows an explicit answer and highlights the answer that needs operator attention. */
function Answer({ value, attentionValue }: { value: boolean | null | undefined; attentionValue: boolean }) {
  const reported = typeof value === 'boolean';
  const attention = reported && value === attentionValue;
  return <span className={`inline-block rounded-md border px-2 py-1 text-xs font-semibold ${!reported ? 'border-slate-400 bg-slate-100 text-slate-900' : attention ? 'border-red-400 bg-red-100 text-red-950' : 'border-green-400 bg-green-100 text-green-950'}`}>{reported ? (value ? 'Yes' : 'No') : 'Not reported'}</span>;
}

/** Renders a labeled value in a request summary. */
function Value({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt className="font-semibold text-slate-600">{label}</dt><dd className="mt-1 break-words text-slate-950">{value}</dd></div>;
}
