const axios = require('axios');

const POSTCODES_IO_BASE = 'https://api.postcodes.io';
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 8000;

/**
 * Convert a UK postcode to latitude/longitude using postcodes.io (free, no key needed)
 * @param {string} postcode - UK postcode e.g. "SW1A 1AA"
 * @returns {{ lat: number, lng: number, postcode: string, district: string, county: string }}
 */
async function geocodePostcode(postcode) {
  const clean = postcode.trim().toUpperCase().replace(/\s+/g, ' ');

  const response = await axios.get(`${POSTCODES_IO_BASE}/postcodes/${encodeURIComponent(clean)}`, {
    timeout: TIMEOUT,
  });

  const { result } = response.data;
  if (!result) {
    throw new Error(`Postcode ${postcode} not found`);
  }

  return {
    lat: result.latitude,
    lng: result.longitude,
    postcode: result.postcode,
    district: result.admin_district || '',
    county: result.admin_county || result.admin_district || '',
    region: result.region || '',
    country: result.country || 'England',
  };
}

/**
 * Validate a UK postcode format (does not hit network)
 */
function isValidUKPostcode(postcode) {
  const pattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i;
  return pattern.test(postcode.trim());
}

/**
 * Convert miles to metres
 */
function milesToMetres(miles) {
  return Math.round(miles * 1609.34);
}

module.exports = { geocodePostcode, isValidUKPostcode, milesToMetres };
