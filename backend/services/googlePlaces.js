const axios = require('axios');

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 8000;

// Business types to search for (Google Places types)
const BUSINESS_TYPES = [
  'restaurant', 'cafe', 'bar', 'food', 'store', 'health', 'beauty_salon',
  'hair_care', 'gym', 'spa', 'lodging', 'real_estate_agency', 'accounting',
  'lawyer', 'dentist', 'doctor', 'pharmacy', 'veterinary_care',
  'car_repair', 'plumber', 'electrician', 'painter', 'florist',
  'clothing_store', 'shoe_store', 'jewelry_store', 'furniture_store',
  'home_goods_store', 'hardware_store', 'pet_store', 'book_store',
  'electronics_store', 'bicycle_store', 'travel_agency',
];

/**
 * Fetch nearby businesses from Google Places API (New)
 * Returns empty array gracefully if no API key configured
 */
async function getNearbyBusinesses(lat, lng, radiusMetres) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.log('[GooglePlaces] No API key configured, skipping');
    return [];
  }

  const allResults = [];
  const seenPlaceIds = new Set();

  // Google Places (New) Nearby Search - max 20 results per request
  // We do a single broad search then deduplicate
  try {
    const body = {
      includedTypes: BUSINESS_TYPES,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(radiusMetres, 50000), // API max 50km
        },
      },
      rankPreference: 'DISTANCE',
    };

    const response = await axios.post(
      `${PLACES_BASE}:searchNearby`,
      body,
      {
        timeout: TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.location',
            'places.nationalPhoneNumber',
            'places.websiteUri',
            'places.businessStatus',
            'places.primaryTypeDisplayName',
            'places.primaryType',
            'places.regularOpeningHours',
            'places.rating',
            'places.userRatingCount',
          ].join(','),
        },
      }
    );

    const places = response.data.places || [];

    for (const place of places) {
      if (seenPlaceIds.has(place.id)) continue;
      if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') continue;

      seenPlaceIds.add(place.id);

      allResults.push({
        id: `google_${place.id}`,
        source: 'Google Places',
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || null,
        phone: place.nationalPhoneNumber || null,
        email: null, // Google Places doesn't provide email
        websiteFromSource: place.websiteUri || null,
        category: place.primaryTypeDisplayName?.text || place.primaryType || 'Business',
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        ratingCount: place.userRatingCount,
        googlePlaceId: place.id,
      });
    }
  } catch (err) {
    if (err.response?.status === 403) {
      console.error('[GooglePlaces] API key invalid or not authorised for Places API (New)');
    } else if (err.response?.status === 429) {
      console.error('[GooglePlaces] Quota exceeded');
    } else {
      console.error('[GooglePlaces] Error:', err.message);
    }
  }

  return allResults;
}

module.exports = { getNearbyBusinesses };
