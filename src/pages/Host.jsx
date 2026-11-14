import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { KIND_LABEL, ago, clockTime, isStale, openSummary, unitWord, usePolling } from '../lib.js';
import Stepper from '../components/Stepper.jsx';

const TOKEN_KEY = 'shelterlink-staff';
const MAX_OPEN = 999;

// The session token is kept in sessionStorage: it survives a reload and is gone when the tab closes.
function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage can be blocked (private mode); signing in still works for this page view
  }
}

export default function Host() {
  const [token, setTokenState] = useState(readToken);
  const [notice, setNotice] = useState('');

  function setToken(next, message = '') {
    try {
      if (next) sessionStorage.setItem(TOKEN_KEY, next);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // see readToken
    }
    setTokenState(next);
    setNotice(message);
  }

  return token ? (
    <Console token={token} signOut={(message) => setToken(null, message)} />
  ) : (
    <SignIn notice={notice} onSignedIn={setToken} />
  );
}

function SignIn({ notice, onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(notice);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setProblem('');
    try {
      onSignedIn((await api.login(email, password)).token);
    } catch (err) {
      setProblem(err.status ? err.message : "Can't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <h1>Host console</h1>
        <p>Sign in to update your place's open beds.</p>
      </div>
      {problem && (
        <div className="banner banner-warn" role="alert">
          {problem}
        </div>
      )}
      <form className="panel" onSubmit={signIn}>
        <label className="field">
          <span className="field-label">Work email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          Sign in
        </button>
      </form>
    </main>
  );
}

function Console({ token, signOut }) {
  const { data: host, error, refresh: refreshHost } = usePolling(() => api.staffHost(token));
  const { data: holds, refresh: refreshHolds } = usePolling(
    () => (host ? api.hostHolds(token, host.id) : Promise.resolve([])),
    [host?.id]
  );
  const [problem, setProblem] = useState('');

  // The session ran out, or the server restarted without a SESSION_SECRET: back to the sign-in form.
  const ended = error?.status === 401 ? error.message : '';
  useEffect(() => {
    if (ended) signOut(ended);
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!host) {
    return <main className="page">{error && !ended ? 'Could not load your place. Trying again…' : 'Loading…'}</main>;
  }

  const stale = isStale(host.updated_at);
  const refresh = () => {
    refreshHost();
    refreshHolds();
  };
  const act = (request) =>
    request
      .then(() => setProblem(''))
      .catch((err) => (err.status === 401 ? signOut(err.message) : setProblem(err.message)))
      .then(refresh);
  const update = (patch) => act(api.updateHost(token, host.id, patch));
  const checkIn = (code) => act(api.arriveHold(token, code));

  const open = openSummary(host, 'any');
  const headline = !host.accepting
    ? 'Not taking arrivals'
    : open.n === 0
      ? 'Full tonight'
      : `${open.n} ${open.word} open to new arrivals`;

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <h1>Host console</h1>
        <p>
          You are updating <strong>{host.name}</strong>.{' '}
          <button type="button" className="linklike" onClick={() => signOut('')}>
            Sign out
          </button>
        </p>
      </div>

      {problem && (
        <div className="banner banner-warn" role="alert">
          {problem}
        </div>
      )}

      <section className={'status-band' + (host.accepting ? '' : ' status-band-off')} aria-label="Status">
        <div>
          <h2>{headline}</h2>
          <p className={stale ? 'reported-stale' : ''}>
            {host.expired
              ? `Last confirmed ${ago(host.updated_at)}. Your counts are hidden from people searching until you confirm.`
              : stale
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
          <h2>Open right now</h2>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => update({ counts: host.counts.map((c) => ({ id: c.id, open: 0 })) })}
          >
            Mark full
          </button>
        </div>
        {host.counts.map((c) => (
          <div className="row-between" key={c.id}>
            <div>
              <div className="strong">{KIND_LABEL[c.kind]}</div>
              <p className="muted">
                {c.capacity != null ? `${c.capacity} total. ` : ''}
                {c.held > 0 ? `${c.held} held for people on the way.` : 'None held.'}
              </p>
            </div>
            <Stepper
              value={c.open}
              max={c.capacity ?? MAX_OPEN}
              size="lg"
              label={KIND_LABEL[c.kind] + ' open'}
              onChange={(n) => update({ counts: [{ id: c.id, open: n }] })}
            />
          </div>
        ))}
        <p className="muted">
          Counts disappear from the public list 24 hours after the last update. Confirm them each day, even when
          nothing changed.
        </p>
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
                    {h.people} {h.people === 1 ? 'person' : 'people'} · {h.beds} {unitWord(h.kind, h.beds)} · held
                    until {clockTime(h.expires_at)}
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
