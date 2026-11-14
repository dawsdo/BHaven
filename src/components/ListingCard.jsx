import { Link } from 'react-router-dom';
import {
  KIND_LABEL,
  PLACE_LABEL,
  TYPE_LABEL,
  ago,
  directionsUrl,
  isStale,
  openSummary,
  placeKind,
  takes,
  takesText,
  telHref
} from '../lib.js';

// `group` is who the search is for. `newest` marks the host with the most recent update.
export default function ListingCard({ host, reason, miles, group, newest }) {
  const fits = !reason;
  const stale = isStale(host.updated_at);
  // A confidential host has no address to show. Say why, so it reads as a policy
  // rather than as missing data, and the phone number below becomes the way in.
  const line = [takesText(host)];
  if (host.address_confidential) line.push('Location confidential');
  else if (host.address) line.push(host.address);
  if (miles != null) line.push('about ' + miles.toFixed(1) + ' mi');
  const directions = directionsUrl(host);
  const counts = host.counts || [];
  // A place that does not take this group still shows what it has open in all.
  const open = openSummary(host, takes(host, group) ? group : 'any');
  const place = PLACE_LABEL[placeKind(host)];
  // A lone count with no known total would only repeat the big number below.
  const showRows = counts.length > 1 || counts[0]?.capacity != null;

  return (
    <article className={'card' + (fits ? '' : ' card-blocked')}>
      <div className="photo-slot">Photo: front entrance</div>
      <div className="card-body">
        <div className="eyebrow">{TYPE_LABEL[host.type]}</div>
        <h2>{host.name}</h2>
        <div className="card-line">{line.join(' · ')}</div>
        <div className="tags">
          {newest && <span className="tag tag-new">Most recently updated</span>}
          {place && <span className="tag">{place}</span>}
          {host.step_free && <span className="tag">Step-free</span>}
          {host.pets && <span className="tag">Pets allowed</span>}
        </div>
        {showRows && (
          <ul className="count-rows">
            {counts.map((c) => (
              <li key={c.id}>
                <span>
                  {KIND_LABEL[c.kind]}
                  {c.capacity != null && <span className="muted"> · {c.capacity} total</span>}
                </span>
                <span className="strong">{c.available === 0 ? 'Full' : c.available + ' open'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="card-links">
          {host.phone && (
            <a href={telHref(host.phone)} aria-label={'Call ' + host.name}>
              Call {host.phone}
            </a>
          )}
          {directions && (
            <a href={directions} target="_blank" rel="noreferrer" aria-label={'Directions to ' + host.name}>
              Directions
            </a>
          )}
        </div>
        <div className="card-foot">
          <div>
            <div className="count">
              <span className="count-num">{host.accepting && !host.expired ? open.n : '–'}</span>
              {host.accepting && !host.expired && <span>{open.word} open</span>}
            </div>
            {/* Once a count is withheld its age is not shown either: it may never have been reported. */}
            {!host.expired && (
              <div className={'reported' + (stale ? ' reported-stale' : '')}>
                Reported {ago(host.updated_at)}
                {stale ? ', may be out of date' : ''}
              </div>
            )}
          </div>
          {fits ? (
            <Link className="btn btn-primary" to={'/place/' + host.id}>
              View and hold
            </Link>
          ) : (
            <span className="reason">{reason}</span>
          )}
        </div>
      </div>
    </article>
  );
}
