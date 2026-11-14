import { useState } from 'react';
import { api } from '../api.js';
import { PLACE_LABEL, blockReason, clockTime, describeWho, milesBetween, openSummary, usePolling } from '../lib.js';
import ListingCard from '../components/ListingCard.jsx';
import Stepper from '../components/Stepper.jsx';

const GROUPS = [
  ['any', 'Anyone'],
  ['men', 'Man'],
  ['women', 'Woman'],
  ['women_children', 'Woman with children'],
  ['family', 'Family with children'],
  ['youth', 'Youth on their own']
];
const PLACES = [['any', 'Any'], ...Object.entries(PLACE_LABEL)];

export default function Browse({ search, setSearch, coords, setCoords }) {
  const { data: hosts, loadedAt, error } = usePolling(() => api.hosts());
  // 'ask' shows the explainer, 'off' hides it, 'denied' explains the fallback.
  const [locState, setLocState] = useState(coords ? 'on' : 'ask');
  const [zip, setZip] = useState('');
  const [zipProblem, setZipProblem] = useState('');
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

  // The ZIP code goes to the server, which answers with that ZIP's approximate center.
  async function searchZip(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zip)) return setZipProblem('Enter a 5-digit ZIP code.');
    try {
      const found = await api.zip(zip);
      setCoords({ lat: found.lat, lng: found.lng, label: found.label });
      setLocState('on');
      setZipProblem('');
    } catch (err) {
      setZipProblem(err.status ? err.message : 'Could not look up that ZIP code. Try again.');
    }
  }

  function stopLocation() {
    setCoords(null);
    setLocState('off');
    setZip('');
  }

  const rows = (hosts || []).map((host) => ({
    host,
    reason: blockReason(host, search),
    miles: milesBetween(coords, host)
  }));
  rows.sort((a, b) => {
    if (!a.reason !== !b.reason) return a.reason ? 1 : -1;
    if (coords) return (a.miles ?? 999) - (b.miles ?? 999);
    return openSummary(b.host, search.group).n - openSummary(a.host, search.group).n;
  });
  const fitCount = rows.filter((r) => !r.reason).length;
  // The freshest count on the page, ignoring ones too old to show.
  const newest = (hosts || []).filter((h) => !h.expired).sort((a, b) => b.updated_at - a.updated_at)[0];

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
          <div className="field-label" id="place-label">
            Kind of place
          </div>
          <div className="pills" role="group" aria-labelledby="place-label">
            {PLACES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={'pill' + (search.place === id ? ' pill-on' : '')}
                aria-pressed={search.place === id}
                onClick={() => set({ place: id })}
              >
                {label}
              </button>
            ))}
          </div>
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
        <form className="field" onSubmit={searchZip}>
          <label className="field-label" htmlFor="zip">
            Near ZIP code
          </label>
          <div className="row">
            <input
              id="zip"
              className="input zip-input"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="btn btn-outline">
              Sort by distance
            </button>
          </div>
          {zipProblem && (
            <div className="reported reported-stale" role="alert">
              {zipProblem}
            </div>
          )}
        </form>
      </section>

      {locState === 'ask' && (
        <section className="loc-ask" aria-label="Location">
          <p>
            <strong>Sort by distance?</strong> Enter a ZIP code above, or let your browser share your location. We use
            it once to sort this list. It is never saved or sent to hosts.
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
            <strong>Location is off.</strong> The list is sorted by open beds instead. Enter a ZIP code above, or allow
            location in your browser settings and try again.
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
              Nearest to {coords.label || 'you'} first.{' '}
              <button type="button" className="linklike" onClick={stopLocation}>
                {coords.label ? 'Stop sorting by ZIP code' : 'Stop using my location'}
              </button>
            </>
          ) : (
            'Most open beds first'
          )}
        </div>
      </div>

      {error && (
        <div className="banner banner-warn" role="alert">
          {hosts
            ? `Can't refresh right now. This list is from ${clockTime(loadedAt)}. Trying again.`
            : 'Could not reach the server. Is the API running?'}
        </div>
      )}

      <div className="grid">
        {rows.map(({ host, reason, miles }) => (
          <ListingCard
            key={host.id}
            host={host}
            reason={reason}
            miles={miles}
            group={search.group}
            newest={host === newest}
          />
        ))}
      </div>
    </main>
  );
}
