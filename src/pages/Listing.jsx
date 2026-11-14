import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { TYPE_LABEL, ago, bedWord, isStale, takesText, usePolling } from '../lib.js';
import Stepper from '../components/Stepper.jsx';

const MINUTES = [15, 30, 45];
const holdKey = (id) => 'shelterlink-hold-' + id;

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
  const cantHold = host.beds_available < people;
  const stale = isStale(host.updated_at);
  const directions =
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(host.name + ', ' + host.address + ', Birmingham, AL');

  async function placeHold() {
    setBusy(true);
    setProblem('');
    try {
      const made = await api.createHold(host.id, people, minutes);
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

  const tags = [host.step_free && 'Step-free', host.pets && 'Pets allowed'].filter(Boolean);

  return (
    <main className="page">
      <Link className="btn btn-outline back" to="/">
        Back to all places
      </Link>

      <div className="detail">
        <div className="detail-main">
          <div className="photo-slot photo-slot-lg">Photo: front entrance and drop-off door</div>
          <div>
            <div className="eyebrow">{TYPE_LABEL[host.type]}</div>
            <h1>{host.name}</h1>
            <p className="detail-addr">{host.address}, Birmingham</p>
          </div>
          <dl className="facts">
            <dt>Takes</dt>
            <dd className="strong">{takesText(host)}</dd>
            <dt>Open now</dt>
            <dd className="strong">
              {host.accepting
                ? `${host.beds_available} ${bedWord(host.beds_available)}`
                : 'Not taking arrivals tonight'}
            </dd>
            <dt>Good to know</dt>
            <dd>{tags.length ? tags.join(', ') : 'Nothing listed yet'}</dd>
            <dt>Arriving</dt>
            <dd>{host.note || 'Not set by the host yet'}</dd>
            <dt>Count reported</dt>
            <dd className={stale ? 'reported-stale' : ''}>
              {ago(host.updated_at)}
              {stale ? '. May be out of date, call ahead.' : ''}
            </dd>
          </dl>
        </div>

        <aside className="hold-panel" aria-label="Hold a bed">
          {hold ? (
            <>
              <div className="eyebrow eyebrow-ok">Held</div>
              <div className="hold-code">{hold.code}</div>
              <p>
                {hold.people} {bedWord(hold.people)} held at {host.name} until{' '}
                {new Date(hold.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
              </p>
              <p className="muted">Show this code at the door. The hold releases on its own if no one arrives.</p>
              <a className="btn btn-primary btn-lg" href={directions} target="_blank" rel="noreferrer">
                Get directions
              </a>
              <button type="button" className="btn btn-outline" onClick={release} disabled={busy}>
                Release hold
              </button>
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
                {cantHold ? 'Not enough beds open' : `Hold ${people} ${bedWord(people)} for ${minutes} min`}
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
