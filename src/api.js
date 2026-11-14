async function request(path, options) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  // all=true is the host console: every host, and its own counts even when stale.
  hosts: (all = false) => request('/hosts' + (all ? '?all=1&console=1' : '')),
  host: (id) => request('/hosts/' + id),
  updateHost: (id, patch) => request('/hosts/' + id, { method: 'PATCH', body: JSON.stringify(patch) }),
  hostHolds: (id) => request('/hosts/' + id + '/holds'),
  createHold: (host_id, people, minutes) =>
    request('/holds', { method: 'POST', body: JSON.stringify({ host_id, people, minutes }) }),
  releaseHold: (code) => request('/holds/' + code + '/release', { method: 'POST' }),
  arriveHold: (code) => request('/holds/' + code + '/arrive', { method: 'POST' })
};
