import { useEffect, useRef, useState } from 'react';

export const TYPE_LABEL = {
  shelter: 'Emergency shelter',
  warming: 'Warming station',
  community: 'Community host · verified'
};

// Search group -> the host flag that serves it. Men and women mean single adults.
const TAKES = {
  men: 'takes_men',
  women: 'takes_women',
  women_children: 'takes_women_children',
  family: 'takes_families',
  youth: 'takes_youth'
};
const GROUP_NOUN = {
  men: 'men',
  women: 'women',
  women_children: 'women with children',
  family: 'families',
  youth: 'unaccompanied youth'
};

// A woman with children is a family, so a host that takes families takes her too.
// It does not run the other way: a women-and-children host cannot take every family.
export function takes(host, group) {
  if (group === 'any') return true;
  return !!host[TAKES[group]] || (group === 'women_children' && !!host.takes_families);
}

export const bedWord = (n) => (n === 1 ? 'bed' : 'beds');

export function takesText(host) {
  const out = [];
  if (host.takes_men) out.push('Men');
  if (host.takes_women) out.push('Women');
  if (host.takes_women_children) out.push('Women with children');
  if (host.takes_families) out.push('Families');
  if (host.takes_youth) out.push(host.youth_max_age ? 'Youth up to ' + host.youth_max_age : 'Youth');
  return out.join(', ');
}

// Why a host cannot take this search, or '' when it can.
export function blockReason(host, search) {
  if (!host.accepting) return 'Not taking arrivals tonight';
  if (!takes(host, search.group)) return 'Does not take ' + GROUP_NOUN[search.group];
  if (search.stepFree && !host.step_free) return 'No step-free access';
  if (search.pets && !host.pets) return 'No pets';
  // The server withholds the count when nobody has confirmed it recently. Unknown is
  // not the same as available: say so rather than letting it read as an open bed.
  if (host.beds_available == null) return UNCONFIRMED_REASON;
  if (host.beds_available === 0) return 'Full';
  if (host.beds_available < search.people) return 'Only ' + host.beds_available + ' open';
  return '';
}

export function describeWho({ group, people }) {
  if (group === 'men') return people + (people === 1 ? ' man' : ' men');
  if (group === 'women') return people + (people === 1 ? ' woman' : ' women');
  if (group === 'women_children') return 'a woman with children (' + people + ' in all)';
  if (group === 'family') return 'a family of ' + people;
  if (group === 'youth') return people + (people === 1 ? ' young person' : ' young people') + ' on their own';
  return people + (people === 1 ? ' person' : ' people');
}

export function ago(ts, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  return hrs + (hrs === 1 ? ' hr ago' : ' hrs ago');
}

// Freshness is decided by the server, not here. When a count is not 'fresh' the
// server does not send the number at all, so there is nothing for this file to
// second-guess: these helpers only describe what came back.
export const isStale = (host) => host?.freshness !== 'fresh';

// What to show where a bed count would go. Never a number the server withheld.
export const countText = (host) => (host?.beds_available == null ? '—' : String(host.beds_available));

export const FRESHNESS_NOTE = {
  fresh: '',
  stale: 'Not confirmed since this morning — call ahead',
  unknown: 'Not reported — call ahead'
};

// Why a host is unavailable when the only thing wrong is the age of its count.
// Shared so the card can avoid printing this and the freshness note side by side.
export const UNCONFIRMED_REASON = 'Not confirmed recently — call ahead';

export function milesBetween(a, b) {
  if (!a || b.lat == null || b.lng == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Re-runs `load` every few seconds so bed counts stay current without a refresh.
export function usePolling(load, deps = [], everyMs = 4000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let live = true;
    const run = () =>
      loadRef
        .current()
        .then((d) => {
          if (live) {
            setData(d);
            setError(null);
          }
        })
        .catch((e) => live && setError(e));
    run();
    const timer = setInterval(run, everyMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = () => loadRef.current().then(setData).catch(setError);
  return { data, error, refresh };
}
