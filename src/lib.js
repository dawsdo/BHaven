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

// Whether a place is single-gender, worked out from who it takes. '' when no label fits.
export const PLACE_LABEL = { women_only: 'Women only', men_only: 'Men only', co_ed: 'Co-ed' };
export function placeKind(host) {
  const women = host.takes_women || host.takes_women_children;
  if (host.takes_families || (host.takes_men && women)) return 'co_ed';
  if (host.takes_men) return 'men_only';
  return women ? 'women_only' : '';
}

export function takesText(host) {
  const out = [];
  if (host.takes_men) out.push('Men');
  if (host.takes_women) out.push('Women');
  if (host.takes_women_children) out.push('Women with children');
  if (host.takes_families) out.push('Families');
  if (host.takes_youth) out.push(host.youth_max_age ? 'Youth up to ' + host.youth_max_age : 'Youth');
  return out.join(', ');
}

export const bedWord = (n) => (n === 1 ? 'bed' : 'beds');

// A host reports open beds per kind. A 'family' count is in rooms, the rest are in beds.
export const KIND_LABEL = {
  men: "Men's beds",
  women: "Women's beds",
  family: 'Family rooms',
  youth: 'Youth beds',
  any: 'Beds'
};
// Which count a search draws on: the first of these kinds the host has. A woman with
// children uses a family room where there is one, and a women's bed where there is not.
const KINDS_FOR = {
  men: ['men', 'any'],
  women: ['women', 'any'],
  women_children: ['family', 'women', 'any'],
  family: ['family', 'any'],
  youth: ['youth', 'any']
};

// The counts this search could use at this host. Empty when the counts are withheld.
export function usableCounts(host, group) {
  const counts = host.counts || [];
  if (group === 'any') return counts;
  const kind = KINDS_FOR[group].find((k) => counts.some((c) => c.kind === k));
  return counts.filter((c) => c.kind === kind);
}

// A family room is held whole. Every other kind is held one bed per person.
export const unitsNeeded = (count, people) => (count.kind === 'family' ? 1 : people);
export const unitWord = (kind, n) => (kind === 'family' ? (n === 1 ? 'family room' : 'family rooms') : bedWord(n));

// The big number on a card: what is open for this search, and what to call it.
export function openSummary(host, group) {
  const counts = usableCounts(host, group);
  const n = counts.reduce((sum, c) => sum + c.available, 0);
  const rooms = counts.filter((c) => c.kind === 'family').length;
  const word = rooms === 0 ? bedWord(n) : rooms === counts.length ? unitWord('family', n) : 'beds and rooms';
  return { n, word };
}

// Shown in place of a count nobody has confirmed in 24 hours. The API withholds the number.
export const NO_RECENT_UPDATE = 'No recent update. Call to confirm.';

// Why a host cannot take this search, or '' when it can.
export function blockReason(host, search) {
  if (!host.accepting) return 'Not taking arrivals tonight';
  if (!takes(host, search.group)) return 'Does not take ' + GROUP_NOUN[search.group];
  if (search.place !== 'any' && placeKind(host) !== search.place) {
    return 'Not ' + PLACE_LABEL[search.place].toLowerCase();
  }
  if (search.stepFree && !host.step_free) return 'No step-free access';
  if (search.pets && !host.pets) return 'No pets';
  if (host.expired) return NO_RECENT_UPDATE;
  const counts = usableCounts(host, search.group);
  const open = counts.reduce((sum, c) => sum + c.available, 0);
  if (open === 0) return 'Full';
  if (!counts.some((c) => c.available >= unitsNeeded(c, search.people))) return 'Only ' + open + ' open';
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

// A count nobody has confirmed in 3 hours is flagged so responders call ahead.
export const isStale = (ts, now = Date.now()) => now - ts > 3 * 60 * 60000;

export const clockTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const telHref = (phone) => 'tel:' + phone.replace(/[^\d+]/g, '');
// null when there is no address to send anyone to. The API sends none for a confidential
// host, and a link built from the name alone would still point a search engine at it.
export const directionsUrl = (host) =>
  host.address
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(host.name + ', ' + host.address)
    : null;

export function milesBetween(a, b) {
  if (!a || b.lat == null || b.lng == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Re-runs `load` every few seconds, and when the tab comes back to the front, so bed counts
// stay current without a refresh. `loadedAt` is when `data` last arrived.
export function usePolling(load, deps = [], everyMs = 4000) {
  const [data, setData] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
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
            setLoadedAt(Date.now());
            setError(null);
          }
        })
        .catch((e) => live && setError(e));
    run();
    const timer = setInterval(run, everyMs);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = () => loadRef.current().then(setData).catch(setError);
  return { data, loadedAt, error, refresh };
}
