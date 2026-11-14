import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  KIND_LABEL,
  NO_RECENT_UPDATE,
  PLACE_LABEL,
  TYPE_LABEL,
  ago,
  clockTime,
  directionsUrl,
  isStale,
  mapEmbedUrl,
  placeKind,
  takesText,
  telHref,
  unitWord,
  unitsNeeded,
  usableCounts,
  usePolling
} from '../lib.js';
import Stepper from '../components/Stepper.jsx';

const MINUTES = [15, 30, 45];
const holdKey = (id) => 'bhaven-hold-' + id;

function readHold(id) {
  try {
    const hold = JSON.parse(sessionStorage.getItem(holdKey(id)));
    return hold && hold.expires_at > Date.now() ? hold : null;
  } catch {
    return null;
  }
}

export default function Listing({ search, setSearch }) {
  const { id } = useParams();
  const { data: host, error, refresh } = usePolling(() => api.host(id), [id]);
  const [minutes, setMinutes] = useState(45);
  // The kind of bed picked by hand. Until then the search decides.
  const [pickedKind, setPickedKind] = useState(null);
  const [hold, setHold] = useState(() => readHold(id));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  if (error && !host) {
    return (
      <main className="page">
        <Link className="btn btn-outline" to="/">
          Back to all places
        </Link>
        <div className="banner banner-warn">This place could not be loaded.</div>
      </main>
    );
  }
  if (!host) return <main className="page">Loading…</main>;

  const people = search.people;
  const counts = host.counts || [];
  const count =
    counts.find((c) => c.kind === pickedKind) ||
    (search.group !== 'any' && usableCounts(host, search.group)[0]) ||
    counts[0];
  const need = count ? unitsNeeded(count, people) : people;
  const cantHold = !count || count.available < need;
  const stale = isStale(host.updated_at);
  const directions = directionsUrl(host);

  async function placeHold() {
    setBusy(true);
    setProblem('');
    try {
      const made = await api.createHold(host.id, count.id, people, minutes);
      // Kept only in this browser tab so a refresh does not lose the code.
      sessionStorage.setItem(holdKey(id), JSON.stringify(made));
      setHold(made);
    } catch (e) {
      setProblem(e.status === 409 ? 'Someone just took those beds. The count has been updated.' : e.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function release() {
    setBusy(true);
    try {
      await api.releaseHold(hold.code);
    } finally {
      sessionStorage.removeItem(holdKey(id));
      setHold(null);
      setBusy(false);
      refresh();
    }
  }

  const tags = [PLACE_LABEL[placeKind(host)], host.step_free && 'Step-free', host.pets && 'Pets allowed'].filter(
    Boolean
  );

  return (
    <main className="page">
      <Link className="btn btn-outline back" to="/">
        Back to all places
      </Link>

      <div className="detail">
        <div className="detail-main">
          {host.address ? (
            <iframe
              className="map-frame"
              title={'Map showing ' + host.name}
              src={mapEmbedUrl(host)}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="photo-slot photo-slot-lg">Photo: front entrance and drop-off door</div>
          )}
          <div>
            <div className="eyebrow">{TYPE_LABEL[host.type]}</div>
            <h1>{host.name}</h1>
            <p className="detail-addr">
              {host.address_confidential
                ? 'Location confidential. Call for directions and intake.'
                : host.address || 'No address listed. Call ahead.'}
            </p>
          </div>
          <div className="row">
            {host.phone && (
              <a className="btn btn-primary" href={telHref(host.phone)}>
                Call {host.phone}
              </a>
            )}
            {directions && (
              <a className="btn btn-outline" href={directions} target="_blank" rel="noreferrer">
                Directions
              </a>
            )}
          </div>
          <dl className="facts">
            <dt>Takes</dt>
            <dd className="strong">{takesText(host)}</dd>
            <dt>Open now</dt>
            <dd className="strong">
              {!host.accepting ? (
                'Not taking arrivals tonight'
              ) : host.expired ? (
                NO_RECENT_UPDATE
              ) : (
                <ul className="count-rows">
                  {counts.map((c) => (
                    <li key={c.id}>
                      <span>
                        {KIND_LABEL[c.kind]}
                        {c.capacity != null && <span className="muted"> · {c.capacity} total</span>}
                      </span>
                      <span>{c.available === 0 ? 'Full' : c.available + ' open'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Good to know</dt>
            <dd>{tags.length ? tags.join(', ') : 'Nothing listed yet'}</dd>
            {host.languages.length > 0 && (
              <>
                <dt>Languages</dt>
                <dd>{host.languages.join(', ')}</dd>
              </>
            )}
            <dt>Arriving</dt>
            <dd>{host.note || 'Not set by the host yet'}</dd>
            <dt>Count reported</dt>
            <dd className={stale ? 'reported-stale' : ''}>
              {host.expired
                ? NO_RECENT_UPDATE
                : ago(host.updated_at) + (stale ? '. May be out of date, call ahead.' : '')}
            </dd>
          </dl>
        </div>

        <aside className="hold-panel" aria-label="Hold a bed">
          {hold ? (
            <>
              <div className="eyebrow eyebrow-ok">Held</div>
              <div className="hold-code">{hold.code}</div>
              <p>
                {hold.beds} {unitWord(hold.kind, hold.beds)} held at {host.name} until {clockTime(hold.expires_at)}.
              </p>
              <p className="muted">Show this code at the door. The hold releases on its own if no one arrives.</p>
              {directions ? (
                <a className="btn btn-primary btn-lg" href={directions} target="_blank" rel="noreferrer">
                  Get directions
                </a>
              ) : (
                <p className="muted">
                  {host.address_confidential ? 'This location is confidential.' : 'No address is listed.'} Call{' '}
                  {host.phone || 'the shelter'} for directions.
                </p>
              )}
              <button type="button" className="btn btn-outline" onClick={release} disabled={busy}>
                Release hold
              </button>
            </>
          ) : host.expired ? (
            <>
              <h2>Hold a bed</h2>
              <div className="banner banner-warn">{NO_RECENT_UPDATE}</div>
              <p className="muted">
                This place has not confirmed its open beds in the last 24 hours, so a bed cannot be held here.
              </p>
            </>
          ) : (
            <>
              <h2>Hold a bed</h2>
              <div className="row-between">
                <span>People</span>
                <Stepper
                  value={people}
                  min={1}
                  max={9}
                  label="people"
                  onChange={(n) => setSearch({ ...search, people: n })}
                />
              </div>
              {counts.length > 1 && (
                <div className="field">
                  <div id="kind-label">Kind of bed</div>
                  <div className="segmented" role="group" aria-labelledby="kind-label">
                    {counts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={'seg' + (c === count ? ' seg-on' : '')}
                        aria-pressed={c === count}
                        onClick={() => setPickedKind(c.kind)}
                      >
                        {KIND_LABEL[c.kind]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="field">
                <div id="within-label">Arriving within</div>
                <div className="segmented" role="group" aria-labelledby="within-label">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={'seg' + (minutes === m ? ' seg-on' : '')}
                      aria-pressed={minutes === m}
                      onClick={() => setMinutes(m)}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={placeHold}
                disabled={cantHold || busy}
              >
                {cantHold
                  ? `Not enough ${unitWord(count?.kind, 2)} open`
                  : `Hold ${need} ${unitWord(count.kind, need)} for ${minutes} min`}
              </button>
              {problem && <div className="banner banner-warn">{problem}</div>}
              <p className="muted">
                Free. No name needed. The host only sees a hold code and how many people are coming.
              </p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
