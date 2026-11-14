import { useState } from 'react';
import { api } from '../api.js';
import { ago, bedWord, isStale, usePolling } from '../lib.js';
import Stepper from '../components/Stepper.jsx';

// Demo only: there is no login yet, so anyone can pick any host. See the README.
export default function Host() {
  const { data: hosts, refresh: refreshHosts } = usePolling(() => api.hosts(true));
  const [picked, setPicked] = useState('');
  const hostId = picked || (hosts && hosts[0] ? String(hosts[0].id) : '');
  const { data: holds, refresh: refreshHolds } = usePolling(
    () => (hostId ? api.hostHolds(hostId) : Promise.resolve([])),
    [hostId]
  );

  if (!hosts) return <main className="page">Loading…</main>;
  const host = hosts.find((h) => String(h.id) === hostId);
  if (!host) return <main className="page">No hosts yet.</main>;

  const stale = isStale(host.updated_at);
  const refresh = () => {
    refreshHosts();
    refreshHolds();
  };
  const update = (patch) => api.updateHost(host.id, patch).then(refresh);
  const checkIn = (code) => api.arriveHold(code).then(refresh);

  const headline = !host.accepting
    ? 'Not taking arrivals'
    : host.beds_available === 0
      ? 'Full tonight'
      : `${host.beds_available} ${bedWord(host.beds_available)} open to new arrivals`;

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <h1>Host console</h1>
        <label className="field">
          <span className="field-label">You are updating</span>
          <select value={hostId} onChange={(e) => setPicked(e.target.value)}>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={'status-band' + (host.accepting ? '' : ' status-band-off')} aria-label="Status">
        <div>
          <h2>{headline}</h2>
          <p className={stale ? 'reported-stale' : ''}>
            {stale
              ? `Last confirmed ${ago(host.updated_at)}. People searching see a stale warning until you confirm.`
              : `Last confirmed ${ago(host.updated_at)}. People searching see these numbers.`}
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => update({})}>
          Counts are still right
        </button>
        <button
          type="button"
          className={'btn ' + (host.accepting ? 'btn-dark' : 'btn-primary')}
          aria-pressed={!host.accepting}
          onClick={() => update({ accepting: !host.accepting })}
        >
          {host.accepting ? 'Pause arrivals' : 'Resume arrivals'}
        </button>
      </section>

      <section className="panel" aria-label="Open beds">
        <div className="row-between">
          <div>
            <h2>Beds open right now</h2>
            <p className="muted">
              {host.beds_held > 0
                ? `${host.beds_held} of these ${host.beds_held === 1 ? 'is' : 'are'} held for people on the way.`
                : 'No beds are being held.'}
            </p>
          </div>
          <div className="row">
            <Stepper
              value={host.beds_open}
              max={500}
              size="lg"
              label="beds open"
              onChange={(n) => update({ beds_open: n })}
            />
            <button type="button" className="btn btn-outline" onClick={() => update({ beds_open: 0 })}>
              Mark full
            </button>
          </div>
        </div>
      </section>

      <section className="panel" aria-label="On the way">
        <h2>On the way to you</h2>
        {!holds || holds.length === 0 ? (
          <p className="muted">No one is on the way right now.</p>
        ) : (
          <ul className="holds">
            {holds.map((h) => (
              <li key={h.code}>
                <div>
                  <div className="hold-code-sm">{h.code}</div>
                  <div className="muted">
                    {h.people} {h.people === 1 ? 'person' : 'people'} · held until{' '}
                    {new Date(h.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => checkIn(h.code)}>
                  Check in
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
