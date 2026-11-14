import { useState } from 'react';
import { api } from '../api.js';
import { blockReason, describeWho, milesBetween, usePolling } from '../lib.js';
import ListingCard from '../components/ListingCard.jsx';
import Stepper from '../components/Stepper.jsx';

const GROUPS = [
  ['any', 'Anyone'],
  ['men', 'Men'],
  ['women', 'Women'],
  ['family', 'Family with children']
];

export default function Browse({ search, setSearch, coords, setCoords }) {
  const { data: hosts, error } = usePolling(() => api.hosts());
  // 'ask' shows the explainer, 'off' hides it, 'denied' explains the fallback.
  const [locState, setLocState] = useState(coords ? 'on' : 'ask');
  const set = (patch) => setSearch({ ...search, ...patch });

  function shareLocation() {
    if (!('geolocation' in navigator)) return setLocState('denied');
    // The browser shows its own permission prompt here. Coordinates stay in memory
    // on this device: they are never sent to the server or stored.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState('on');
      },
      () => setLocState('denied'),
      { maximumAge: 60000, timeout: 10000 }
    );
  }

  function stopLocation() {
    setCoords(null);
    setLocState('off');
  }

  const rows = (hosts || []).map((host) => ({
    host,
    reason: blockReason(host, search),
    miles: milesBetween(coords, host)
  }));
  rows.sort((a, b) => {
    if (!a.reason !== !b.reason) return a.reason ? 1 : -1;
    if (coords) return (a.miles ?? 999) - (b.miles ?? 999);
    return b.host.beds_available - a.host.beds_available;
  });
  const fitCount = rows.filter((r) => !r.reason).length;

  return (
    <main className="page">
      <div className="page-head">
        <h1>Find a place to stay tonight</h1>
        <p>Birmingham, AL. Openings are reported by the hosts themselves.</p>
      </div>

      <section className="searchbar" aria-label="Search">
        <div className="field">
          <div className="field-label" id="who-label">
            Who needs a place
          </div>
          <div className="pills" role="group" aria-labelledby="who-label">
            {GROUPS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={'pill' + (search.group === id ? ' pill-on' : '')}
                aria-pressed={search.group === id}
                onClick={() => set({ group: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field-label">People</div>
          <Stepper value={search.people} min={1} max={9} label="people" onChange={(people) => set({ people })} />
        </div>
        <div className="field">
          <div className="field-label">Must have</div>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={search.stepFree} onChange={(e) => set({ stepFree: e.target.checked })} />
              Step-free access
            </label>
            <label className="check">
              <input type="checkbox" checked={search.pets} onChange={(e) => set({ pets: e.target.checked })} />
              Pets allowed
            </label>
          </div>
        </div>
      </section>

      {locState === 'ask' && (
        <section className="loc-ask" aria-label="Location">
          <p>
            <strong>Sort by distance?</strong> Your browser will ask to share your location. We use it once to sort
            this list. It is never saved or sent to hosts.
          </p>
          <button type="button" className="btn btn-dark" onClick={shareLocation}>
            Use my location
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setLocState('off')}>
            Not now
          </button>
        </section>
      )}
      {locState === 'denied' && (
        <section className="loc-ask" aria-label="Location">
          <p>
            <strong>Location is off.</strong> The list is sorted by open beds instead. You can allow location in your
            browser settings and try again.
          </p>
          <button type="button" className="btn btn-outline" onClick={shareLocation}>
            Try again
          </button>
        </section>
      )}

      <div className="results-head">
        <div className="results-count" aria-live="polite">
          {hosts
            ? `${fitCount} ${fitCount === 1 ? 'place' : 'places'} can take ${describeWho(search)} right now`
            : 'Loading places…'}
        </div>
        <div className="results-sort">
          {coords ? (
            <>
              Nearest first.{' '}
              <button type="button" className="linklike" onClick={stopLocation}>
                Stop using my location
              </button>
            </>
          ) : (
            'Most open beds first'
          )}
        </div>
      </div>

      {error && <div className="banner banner-warn">Could not reach the server. Is the API running?</div>}

      <div className="grid">
        {rows.map(({ host, reason, miles }) => (
          <ListingCard key={host.id} host={host} reason={reason} miles={miles} />
        ))}
      </div>
    </main>
  );
}
