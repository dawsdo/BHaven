// `token` is a signed-in staff member's session token, for the calls that need one.
async function request(path, { token, ...options } = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
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
  hosts: () => request('/hosts'),
  host: (id) => request('/hosts/' + id),
  zip: (zip) => request('/zips/' + zip),
  createHold: (host_id, count_id, people, minutes) =>
    request('/holds', { method: 'POST', body: JSON.stringify({ host_id, count_id, people, minutes }) }),
  releaseHold: (code) => request('/holds/' + code + '/release', { method: 'POST' }),

  // Staff only.
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  staffHost: (token) => request('/staff/host', { token }),
  updateHost: (token, id, patch) => request('/hosts/' + id, { token, method: 'PATCH', body: JSON.stringify(patch) }),
  hostHolds: (token, id) => request('/hosts/' + id + '/holds', { token }),
  arriveHold: (token, code) => request('/holds/' + code + '/arrive', { token, method: 'POST' })
};
