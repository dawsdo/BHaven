import { Link } from 'react-router-dom';
import { TYPE_LABEL, ago, bedWord, isStale, takesText } from '../lib.js';

export default function ListingCard({ host, reason, miles }) {
  const fits = !reason;
  const stale = isStale(host.updated_at);
  const line = [takesText(host), host.address];
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
          <div>
            <div className="count">
              <span className="count-num">{host.accepting ? host.beds_available : '–'}</span>
              {host.accepting && <span>{bedWord(host.beds_available)} open</span>}
            </div>
            <div className={'reported' + (stale ? ' reported-stale' : '')}>
              Reported {ago(host.updated_at)}
              {stale ? ', may be out of date' : ''}
            </div>
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
