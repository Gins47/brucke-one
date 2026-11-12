'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ApiError,
  type ApiClient,
  type DashboardShelter,
  type ShelterAvailability,
} from '../lib/api-client';

type DetailState = { status: 'loading' | 'error' | 'not-found' | 'ready'; shelter: DashboardShelter | null };

/** Resets shelter state when the session or selected scope changes. */
export function ShelterDetail(props: { sessionKey: string; api: ApiClient; organizationId: string; shelterId: string }) {
  return <ShelterDetailPage key={`${props.sessionKey}:${props.organizationId}:${props.shelterId}`} {...props} />;
}

/** Displays one selected-organization shelter and its current availability context. */
function ShelterDetailPage({ sessionKey, api, organizationId, shelterId }: {
  sessionKey: string;
  api: ApiClient;
  organizationId: string;
  shelterId: string;
}) {
  const [state, setState] = useState<DetailState>({ status: 'loading', shelter: null });

  useEffect(() => {
    const controller = new AbortController();
    void api.getOrganizationShelter(sessionKey, organizationId, shelterId, controller.signal)
      .then((shelter) => { if (!controller.signal.aborted) setState({ status: 'ready', shelter }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error', shelter: null });
      });
    return () => controller.abort();
  }, [sessionKey, api, organizationId, shelterId]);

  if (state.status === 'loading') return <p className="mt-8 text-slate-600">Loading shelter…</p>;
  if (state.status === 'not-found') return <p className="mt-8 text-slate-600">This shelter was not found in the selected organization.</p>;
  if (state.status === 'error' || !state.shelter) return <p className="mt-8 text-red-700" role="alert">Unable to load shelter details.</p>;

  return <ShelterDetailContent
    sessionKey={sessionKey}
    api={api}
    organizationId={organizationId}
    key={`${state.shelter.id}-${state.shelter.activeActivation?.id ?? 'inactive'}`}
    shelter={state.shelter}
  />;
}

/** Renders stable shelter facts and the current active availability report when present. */
function ShelterDetailContent({ sessionKey, api, shelter, organizationId }: { sessionKey: string; api: ApiClient; shelter: DashboardShelter; organizationId: string }) {
  const [availability, setAvailability] = useState<ShelterAvailability | null>(shelter.activeActivation?.availability ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentShelter, setCurrentShelter] = useState(shelter);
  const activation = currentShelter.activeActivation;
  const [reservationLock, setReservationLock] = useState<'checking' | 'locked' | 'editable'>('checking');

  const [reloadState, setReloadState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [formRevision, setFormRevision] = useState(0);
  const reloadController = useRef<AbortController | null>(null);
  useEffect(() => () => { reloadController.current?.abort(); }, [sessionKey, api, organizationId, shelter.id]);

  /** Determines whether an activation already has an assignment. */
  const hasAssignment = async (operationId: string, activationId: string, signal: AbortSignal) => {
    let cursor: string | undefined;
    do {
      const page = await api.getOperatorHelpRequests(sessionKey, operationId, 'RESERVED', cursor, signal);
      if (signal.aborted) throw new Error('Request cancelled');
      if (page.items.some((item) => item.assignment?.shelterActivationId === activationId)) return true;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return false;
  };

  /** Reloads the report and ownership after a conflict, discarding unsaved edits. */
  const reloadAfterConflict = async () => {
    reloadController.current?.abort();
    const controller = new AbortController();
    reloadController.current = controller;
    setReloadState('loading');
    setReservationLock('checking');
    setMessage('Availability changed. Your edits were not saved; review the latest report before saving again.');
    try {
      const latest = await api.getOrganizationShelter(sessionKey, organizationId, shelter.id, controller.signal);
      const active = latest.activeActivation;
      const locked = active && active.operation.status === 'ACTIVE'
        ? await hasAssignment(active.operation.id, active.id, controller.signal) : false;
      if (controller.signal.aborted) return;
      setCurrentShelter(latest);
      setAvailability(active?.availability ?? null);
      setReservationLock(locked ? 'locked' : 'editable');
      setFormRevision((value) => value + 1);
      setReloadState('ready');
    } catch {
      if (!controller.signal.aborted) setReloadState('error');
    }
  };

  useEffect(() => {
    if (!activation || activation.operation.status !== 'ACTIVE') return;
    const controller = new AbortController();
    void hasAssignment(activation.operation.id, activation.id, controller.signal)
      .then((locked) => { if (!controller.signal.aborted && !reloadController.current) setReservationLock(locked ? 'locked' : 'editable'); })
      .catch(() => { if (!controller.signal.aborted && !reloadController.current) setReservationLock('locked'); });
    return () => controller.abort();
  // This effect is scoped to the activation and session; the helper uses those values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, activation, api]);

  return (
    <section className="mt-8 space-y-8" aria-labelledby="shelter-title">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">{shelter.shelterCode}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950" id="shelter-title">{shelter.name}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Address" value={shelter.address} /><Detail label="Country" value={shelter.countryCode} /><Detail label="Physical capacity" value={String(shelter.capacity)} />
          <Detail label="Email" value={shelter.contactEmail ?? 'Not provided'} /><Detail label="Phone" value={shelter.contactPhone ?? 'Not provided'} />
          <Detail label="Location" value={shelter.latitude === null ? 'Not available' : `${shelter.latitude}, ${shelter.longitude}`} />
        </dl>
      </article>
      {!activation ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">No active emergency operation.</p> : <section className="space-y-5" aria-labelledby="availability-title">
        <div><p className="text-sm font-semibold text-blue-700">Current operation</p><h2 className="text-xl font-bold text-slate-950" id="availability-title">{activation.operation.name}</h2><p className="mt-1 text-slate-600">{activation.operation.operationCode} · {activation.operation.status}</p></div>
        {reloadState === 'loading' && <p>Reloading availability…</p>}
        {reloadState === 'error' && <p role="alert" className="text-red-700">Could not reload availability. Your edits were not saved. <button type="button" className="underline" onClick={() => void reloadAfterConflict()}>Retry reload</button></p>}
        {reloadState === 'ready' && (availability ? <AvailabilityValues availability={availability} /> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">Not reported yet.</p>)}
        {reloadState === 'ready' && (activation.operation.status === 'ACTIVE' ? (
          <AvailabilityForm sessionKey={sessionKey} activationId={activation.id} api={api} key={formRevision} initial={availability} reservationLock={reservationLock} onConflict={() => void reloadAfterConflict()} onSaved={(next) => { setAvailability(next); setMessage('Availability report updated.'); }} onError={setMessage} />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">Availability cannot be edited because this operation is no longer active.</p>
        ))}
      </section>}
      {message && <p className={message.includes('updated') ? 'text-green-700' : 'text-red-700'} role="status">{message}</p>}
    </section>
  );
}

/** Shows reported values without treating operational capacity as physical capacity. */
function AvailabilityValues({ availability }: { availability: ShelterAvailability }) {
  return <dl className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
    <Detail label="Operational capacity" value={String(availability.operationalCapacity)} /><Detail label="Current occupancy" value={String(availability.currentOccupancy)} /><Detail label="Reserved places" value={String(availability.reservedPlaces)} />
    <Detail label="Available places" value={String(availability.availablePlaces)} /><Detail label="Arrivals" value={availability.acceptingArrivals ? 'Accepting arrivals' : 'Not accepting arrivals'} /><Detail label="Reported" value={new Date(availability.reportedAt).toLocaleString()} />
    {availability.availabilityNote && <Detail label="Note" value={availability.availabilityNote} />}
  </dl>;
}

/** Submits a complete report and keeps server-confirmed values as the displayed state. */
function AvailabilityForm({ sessionKey, activationId, api, initial, reservationLock, onConflict, onSaved, onError }: { sessionKey: string; activationId: string; api: ApiClient; initial: ShelterAvailability | null; onConflict: () => void; reservationLock: 'checking' | 'locked' | 'editable'; onSaved: (availability: ShelterAvailability) => void; onError: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const saveController = useRef<AbortController | null>(null);
  useEffect(() => () => { saveController.current?.abort(); }, [sessionKey, activationId, api]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true); onError('');
    try {
      const response = await api.replaceShelterActivationAvailability(sessionKey, activationId, {
        operationalCapacity: Number(fields.get('operationalCapacity')), currentOccupancy: Number(fields.get('currentOccupancy')), reservedPlaces: Number(fields.get('reservedPlaces')),
        acceptingArrivals: fields.get('acceptingArrivals') === 'on', availabilityNote: String(fields.get('availabilityNote') ?? '').trim() || undefined,
      }, controller.signal);
      if (!controller.signal.aborted) onSaved(response);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 409) onConflict();
      else onError('Check the report values and try again.');
    } finally { if (!controller.signal.aborted) setSaving(false); }
  };
  return <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2" onSubmit={submit}>
    <h3 className="sm:col-span-2 text-lg font-bold text-slate-950">Report availability</h3>
    <NumberField defaultValue={initial?.operationalCapacity} label="Operational capacity" name="operationalCapacity" /><NumberField defaultValue={initial?.currentOccupancy} label="Current occupancy" name="currentOccupancy" /><NumberField defaultValue={initial?.reservedPlaces} label="Reserved places" name="reservedPlaces" readOnly={reservationLock !== 'editable'} />
    {reservationLock !== 'editable' && <p className="text-sm text-slate-600">{reservationLock === 'checking' ? 'Checking reservation ownership…' : 'Reserved places are read-only when assignments exist or cannot be checked.'}</p>}
    <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-800"><input defaultChecked={initial?.acceptingArrivals ?? false} name="acceptingArrivals" type="checkbox" /> Accepting arrivals</label>
    <label className="sm:col-span-2 text-sm font-medium text-slate-800">Availability note<textarea className="mt-1 w-full rounded-md border border-slate-300 p-2" defaultValue={initial?.availabilityNote ?? ''} name="availabilityNote" /></label>
    <button className="w-fit rounded-md bg-blue-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save availability'}</button>
  </form>;
}

/** Renders one required non-negative integer field for the availability report. */
function NumberField({ defaultValue, label, name, readOnly = false }: { defaultValue: number | undefined; label: string; name: string; readOnly?: boolean }) { return <label className="text-sm font-medium text-slate-800">{label}<input className="mt-1 w-full rounded-md border border-slate-300 p-2" defaultValue={defaultValue ?? 0} min="0" name={name} readOnly={readOnly} required step="1" type="number" /></label>; }
/** Renders one compact label and value pair. */
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="font-semibold text-slate-600">{label}</dt><dd className="mt-1 text-slate-950">{value}</dd></div>; }
