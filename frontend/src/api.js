const BASE = '/api';

export async function fetchSources() {
  const res = await fetch(`${BASE}/search/sources`);
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}

/**
 * Start a streaming search via Server-Sent Events.
 * Calls callbacks as events arrive.
 * Returns an EventSource (call .close() to cancel).
 */
export function startStreamSearch({ postcode, radiusMiles, filter = 'no-website' }, callbacks) {
  const params = new URLSearchParams({ postcode, radiusMiles, filter });
  const es = new EventSource(`${BASE}/search/stream?${params}`);

  es.addEventListener('status', e => callbacks.onStatus?.(JSON.parse(e.data)));
  es.addEventListener('location', e => callbacks.onLocation?.(JSON.parse(e.data)));
  es.addEventListener('sources', e => callbacks.onSources?.(JSON.parse(e.data)));
  es.addEventListener('business', e => callbacks.onBusiness?.(JSON.parse(e.data)));
  es.addEventListener('progress', e => callbacks.onProgress?.(JSON.parse(e.data)));
  es.addEventListener('complete', e => {
    callbacks.onComplete?.(JSON.parse(e.data));
    es.close();
  });
  es.addEventListener('error', e => {
    if (e.data) {
      callbacks.onError?.(JSON.parse(e.data));
    } else {
      callbacks.onError?.({ message: 'Connection lost' });
    }
    es.close();
  });

  return es;
}
