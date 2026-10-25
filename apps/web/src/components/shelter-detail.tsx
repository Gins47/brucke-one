'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  type ApiClient,
  type DashboardShelter,
  type ShelterAvailability,
} from '../lib/api-client';

type DetailState = { status: 'loading' | 'error' | 'not-found' | 'ready'; shelter: DashboardShelter | null };

/** Displays one selected-organization shelter and its current availability context. */
export function ShelterDetail({ accessToken, api, organizationId, shelterId }: {
  accessToken: string;
  api: ApiClient;
  organizationId: string;
  shelterId: string;
}) {
  const [state, setState] = useState<DetailState>({ status: 'loading', shelter: null });

  useEffect(() => {
    const controller = new AbortController();
    void api.getOrganizationShelter(accessToken, organizationId, shelterId, controller.signal)
      .then((shelter) => { if (!controller.signal.aborted) setState({ status: 'ready', shelter }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error', shelter: null });
      });
    return () => controller.abort();
  }, [accessToken, api, organizationId, shelterId]);

  if (state.status === 'loading') return <p className="mt-8 text-slate-600">Loading shelter…</p>;
  if (state.status === 'not-found') return <p className="mt-8 text-slate-600">This shelter was not found in the selected organization.</p>;
  if (state.status === 'error' || !state.shelter) return <p className="mt-8 text-red-700" role="alert">Unable to load shelter details.</p>;

  return <ShelterDetailContent
    accessToken={accessToken}
    api={api}
    key={`${state.shelter.id}-${state.shelter.activeActivation?.id ?? 'inactive'}`}
    shelter={state.shelter}
  />;
}

/** Renders stable shelter facts and the current active availability report when present. */
function ShelterDetailContent({ accessToken, api, shelter }: { accessToken: string; api: ApiClient; shelter: DashboardShelter }) {
  const [availability, setAvailability] = useState<ShelterAvailability | null>(shelter.activeActivation?.availability ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const activation = shelter.activeActivation;

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
        {availability ? <AvailabilityValues availability={availability} /> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">Not reported yet.</p>}
        {activation.operation.status === 'ACTIVE' ? (
          <AvailabilityForm accessToken={accessToken} activationId={activation.id} api={api} initial={availability} onSaved={(next) => { setAvailability(next); setMessage('Availability report updated.'); }} onError={setMessage} />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">Availability cannot be edited because this operation is no longer active.</p>
        )}
        {message && <p className={message.includes('updated') ? 'text-green-700' : 'text-red-700'} role="status">{message}</p>}
      </section>}
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
function AvailabilityForm({ accessToken, activationId, api, initial, onSaved, onError }: { accessToken: string; activationId: string; api: ApiClient; initial: ShelterAvailability | null; onSaved: (availability: ShelterAvailability) => void; onError: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaving(true); onError('');
    try {
      const response = await api.replaceShelterActivationAvailability(accessToken, activationId, {
        operationalCapacity: Number(fields.get('operationalCapacity')), currentOccupancy: Number(fields.get('currentOccupancy')), reservedPlaces: Number(fields.get('reservedPlaces')),
        acceptingArrivals: fields.get('acceptingArrivals') === 'on', availabilityNote: String(fields.get('availabilityNote') ?? '').trim() || undefined,
      });
      onSaved(response);
    } catch (error) {
      onError(error instanceof ApiError && error.status === 409 ? 'The report could not be saved because the shelter state changed.' : 'Check the report values and try again.');
    } finally { setSaving(false); }
  };
  return <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2" onSubmit={submit}>
    <h3 className="sm:col-span-2 text-lg font-bold text-slate-950">Report availability</h3>
    <NumberField defaultValue={initial?.operationalCapacity} label="Operational capacity" name="operationalCapacity" /><NumberField defaultValue={initial?.currentOccupancy} label="Current occupancy" name="currentOccupancy" /><NumberField defaultValue={initial?.reservedPlaces} label="Reserved places" name="reservedPlaces" />
    <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-800"><input defaultChecked={initial?.acceptingArrivals ?? false} name="acceptingArrivals" type="checkbox" /> Accepting arrivals</label>
    <label className="sm:col-span-2 text-sm font-medium text-slate-800">Availability note<textarea className="mt-1 w-full rounded-md border border-slate-300 p-2" defaultValue={initial?.availabilityNote ?? ''} name="availabilityNote" /></label>
    <button className="w-fit rounded-md bg-blue-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save availability'}</button>
  </form>;
}

/** Renders one required non-negative integer field for the availability report. */
function NumberField({ defaultValue, label, name }: { defaultValue: number | undefined; label: string; name: string }) { return <label className="text-sm font-medium text-slate-800">{label}<input className="mt-1 w-full rounded-md border border-slate-300 p-2" defaultValue={defaultValue ?? 0} min="0" name={name} required step="1" type="number" /></label>; }
/** Renders one compact label and value pair. */
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="font-semibold text-slate-600">{label}</dt><dd className="mt-1 text-slate-950">{value}</dd></div>; }
