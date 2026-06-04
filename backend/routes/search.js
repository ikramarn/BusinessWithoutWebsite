const express = require('express');
const NodeCache = require('node-cache');
const router = express.Router();

const { geocodePostcode, isValidUKPostcode, milesToMetres } = require('../services/postcodeService');
const { getNearbyBusinesses: getOSMBusinesses } = require('../services/osmService');
const { getNearbyBusinesses: getGoogleBusinesses } = require('../services/googlePlaces');
const { searchByPostcode: searchCH } = require('../services/companiesHouse');
const { checkWebsitePresence } = require('../services/websiteChecker');
const { deduplicateBusinesses } = require('../utils/fuzzyMatch');

const MAX_BUSINESSES = parseInt(process.env.MAX_BUSINESSES) || 200;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600;

// In-memory cache to avoid hammering APIs for repeated searches
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });

// ── POST /api/search ─────────────────────────────────────────────────────────
// Standard JSON endpoint
router.post('/search', async (req, res) => {
  const { postcode, radiusMiles = 1, filter = 'no-website' } = req.body;

  if (!postcode) {
    return res.status(400).json({ error: 'postcode is required' });
  }

  if (!isValidUKPostcode(postcode)) {
    return res.status(400).json({ error: 'Invalid UK postcode format' });
  }

  const radius = Math.max(0.1, Math.min(parseFloat(radiusMiles), 10)); // clamp 0.1–10 miles
  const cacheKey = `search:${postcode.replace(/\s/g,'').toLowerCase()}:${radius}`;

  // Return cached results if available
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT for ${cacheKey}`);
    return res.json({ ...cached, fromCache: true });
  }

  try {
    const location = await geocodePostcode(postcode);
    const radiusMetres = milesToMetres(radius);

    console.log(`[Search] ${postcode} → ${location.lat},${location.lng} | radius: ${radius}mi (${radiusMetres}m)`);

    // ── Phase 1: Discover businesses from all sources ────────────────────────
    const [osmResults, googleResults] = await Promise.allSettled([
      getOSMBusinesses(location.lat, location.lng, radiusMetres),
      getGoogleBusinesses(location.lat, location.lng, radiusMetres),
    ]);

    const osm = osmResults.status === 'fulfilled' ? osmResults.value : [];
    const google = googleResults.status === 'fulfilled' ? googleResults.value : [];

    console.log(`[Search] OSM: ${osm.length} | Google: ${google.length}`);

    // ── Phase 2: Deduplicate ──────────────────────────────────────────────────
    const combined = deduplicateBusinesses([...google, ...osm]);
    const businesses = combined.slice(0, MAX_BUSINESSES);

    console.log(`[Search] After dedup: ${businesses.length} unique businesses`);

    // ── Phase 3: Website verification (parallel, rate-limited) ───────────────
    const locationHint = `${location.district} ${location.county} UK`.trim();
    const verified = await verifyInBatches(businesses, locationHint, 5);

    // ── Phase 4: Apply filter ─────────────────────────────────────────────────
    const filtered = applyFilter(verified, filter);

    // Sort by confidence (no-website first = highest no-website score first)
    filtered.sort((a, b) => b.verification.noWebsiteConfidence - a.verification.noWebsiteConfidence);

    const result = {
      postcode: location.postcode,
      location: {
        lat: location.lat,
        lng: location.lng,
        district: location.district,
        county: location.county,
        region: location.region,
      },
      radiusMiles: radius,
      totalFound: businesses.length,
      totalFiltered: filtered.length,
      filter,
      businesses: filtered,
      sources: {
        osm: osm.length,
        google: google.length,
      },
      generatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, result);
    return res.json(result);

  } catch (err) {
    console.error('[Search] Error:', err.message);
    if (err.message.includes('not found') || err.message.includes('postcode')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

// ── GET /api/search/stream ────────────────────────────────────────────────────
// Server-Sent Events endpoint for real-time progress updates
router.get('/search/stream', async (req, res) => {
  const { postcode, radiusMiles = 1, filter = 'no-website' } = req.query;

  if (!postcode || !isValidUKPostcode(postcode)) {
    return res.status(400).json({ error: 'Valid UK postcode required' });
  }

  const radius = Math.max(0.1, Math.min(parseFloat(radiusMiles), 10));

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive ping every 15s
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => clearInterval(keepAlive));

  try {
    send('status', { message: 'Geocoding postcode...', step: 1, totalSteps: 4 });

    const location = await geocodePostcode(postcode);
    const radiusMetres = milesToMetres(radius);

    send('location', {
      lat: location.lat,
      lng: location.lng,
      postcode: location.postcode,
      district: location.district,
    });

    send('status', { message: 'Searching OpenStreetMap & Google Places...', step: 2, totalSteps: 4 });

    const [osmResults, googleResults] = await Promise.allSettled([
      getOSMBusinesses(location.lat, location.lng, radiusMetres),
      getGoogleBusinesses(location.lat, location.lng, radiusMetres),
    ]);

    const osm = osmResults.status === 'fulfilled' ? osmResults.value : [];
    const google = googleResults.status === 'fulfilled' ? googleResults.value : [];

    send('sources', { osm: osm.length, google: google.length });
    send('status', { message: `Deduplicating ${osm.length + google.length} results...`, step: 3, totalSteps: 4 });

    const combined = deduplicateBusinesses([...google, ...osm]);
    const businesses = combined.slice(0, MAX_BUSINESSES);

    send('status', {
      message: `Checking websites for ${businesses.length} businesses...`,
      step: 4,
      totalSteps: 4,
      total: businesses.length,
    });

    const locationHint = `${location.district} UK`.trim();
    let processed = 0;

    // Process one at a time for streaming progress
    for (const business of businesses) {
      try {
        const verification = await checkWebsitePresence(business, locationHint);
        const result = { ...business, verification };

        processed++;
        send('business', result);
        send('progress', { processed, total: businesses.length });

      } catch (err) {
        console.error(`[Stream] Error checking ${business.name}:`, err.message);
      }
    }

    send('complete', {
      total: businesses.length,
      postcode: location.postcode,
      location: { lat: location.lat, lng: location.lng },
      sources: { osm: osm.length, google: google.length },
    });

  } catch (err) {
    send('error', { message: err.message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

// ── GET /api/search/sources ───────────────────────────────────────────────────
// Returns which API sources are configured
router.get('/search/sources', (req, res) => {
  res.json({
    googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
    companiesHouse: !!process.env.COMPANIES_HOUSE_API_KEY,
    bingSearch: !!process.env.BING_SEARCH_API_KEY,
    osm: true, // always available (free)
    postcodeio: true, // always available (free)
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifyInBatches(businesses, locationHint, batchSize = 5) {
  const results = [];

  for (let i = 0; i < businesses.length; i += batchSize) {
    const batch = businesses.slice(i, i + batchSize);
    const verified = await Promise.all(
      batch.map(async b => {
        try {
          const verification = await checkWebsitePresence(b, locationHint);
          return { ...b, verification };
        } catch {
          return {
            ...b,
            verification: {
              hasWebsite: false,
              websiteUrl: null,
              confidenceScore: 0,
              totalChecks: 0,
              checks: {},
              noWebsiteConfidence: 50, // unknown = 50%
            },
          };
        }
      })
    );
    results.push(...verified);
  }

  return results;
}

function applyFilter(businesses, filter) {
  switch (filter) {
    case 'no-website':
      return businesses.filter(b => !b.verification.hasWebsite);
    case 'has-website':
      return businesses.filter(b => b.verification.hasWebsite);
    case 'all':
    default:
      return businesses;
  }
}

module.exports = router;
