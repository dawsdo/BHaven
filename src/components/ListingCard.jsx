import { Link } from 'react-router-dom';
import {
  FRESHNESS_NOTE,
  TYPE_LABEL,
  UNCONFIRMED_REASON,
  ago,
  bedWord,
  countText,
  isStale,
  takesText
} from '../lib.js';

export default function ListingCard({ host, reason, miles }) {
  const fits = !reason;
  const stale = isStale(host);
  const known = host.beds_available != null;

  // A confidential host has no address to show. Say why, so it reads as a policy
  // rather than as missing data, and the phone number below becomes the way in.
  const line = [takesText(host)];
  if (host.address_confidential) line.push('Location confidential');
  else if (host.address) line.push(host.address);
  if (host.total_beds != null) line.push(host.total_beds + ' total beds');
  if (miles != null) line.push('about ' + miles.toFixed(1) + ' mi');

  return (
    <article className={'card' + (fits ? '' : ' card-blocked')}>
      <div className="photo-slot">Photo: front entrance</div>
      <div className="card-body">
        <div className="eyebrow">{TYPE_LABEL[host.type]}</div>
        <h2>{host.name}</h2>
        <div className="card-line">{line.join(' · ')}</div>
        <div className="tags">
          {host.step_free && <span className="tag">Step-free</span>}
          {host.pets && <span className="tag">Pets allowed</span>}
        </div>
        <div className="card-foot">
          <div className="count-block">
            <div className="count">
              <span className="count-num">{host.accepting ? countText(host) : '–'}</span>
              {host.accepting && known && <span>{bedWord(host.beds_available)} open</span>}
            </div>
            <div className={'reported' + (stale ? ' reported-stale' : '')}>
              {stale ? FRESHNESS_NOTE[host.freshness] : 'Confirmed ' + ago(host.updated_at)}
            </div>
          </div>
          <div className="card-actions">
            {fits ? (
              <Link className="btn btn-primary" to={'/place/' + host.id}>
                View and hold
              </Link>
            ) : reason === UNCONFIRMED_REASON ? null : (
              // Otherwise the freshness note directly above already says this.
              <span className="reason">{reason}</span>
            )}
            {host.phone && (
              <a className="btn btn-call" href={'tel:' + host.phone.replace(/[^\d+]/g, '')}>
                Call {host.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
