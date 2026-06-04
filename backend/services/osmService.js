const axios = require('axios');

// Multiple Overpass mirrors — tried in order until one succeeds
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 15000;

// OSM tags that indicate a commercial business
const BUSINESS_TAGS = [
  'shop', 'amenity', 'craft', 'office', 'tourism', 'leisure',
  'healthcare', 'beauty', 'trade', 'service',
];

// OSM amenity values that are NOT businesses (filter these out)
const EXCLUDED_AMENITIES = new Set([
  'parking', 'bench', 'waste_basket', 'post_box', 'recycling',
  'telephone', 'toilets', 'drinking_water', 'bicycle_parking',
  'fuel', 'atm', 'bus_station', 'taxi', 'car_rental', 'car_wash',
  'charging_station', 'vending_machine', 'shelter',
]);

/**
 * Query OpenStreetMap via Overpass API for businesses near a coordinate
 * @param {number} lat
 * @param {number} lng  
 * @param {number} radiusMetres
 * @returns {Promise<Array>}
 */
async function getNearbyBusinesses(lat, lng, radiusMetres) {
  // Build Overpass QL query for shops, amenities, crafts, offices within radius
  const query = `
    [out:json][timeout:25];
    (
      node["shop"](around:${radiusMetres},${lat},${lng});
      way["shop"](around:${radiusMetres},${lat},${lng});
      node["amenity"~"restaurant|cafe|pub|bar|fast_food|clinic|pharmacy|dentist|doctors|veterinary|bank|bureau_de_change|post_office|library|nightclub|theatre|cinema|gym|fitness_centre|hairdresser|beauty|laundry|dry_cleaning|tailor|travel_agency|car_rental|car_repair|car_dealership|motorcycle_shop|electronics|hardware|garden_centre|mobile_phone|optician|hearing_aids|jeweller|watchmaker|shoes|clothes|sports|stationery|gift|florist|bakery|butcher|deli|greengrocer|fishmonger|cheese|chocolate|beverages|wine|off_licence|bookshop|records|toys|art|frame|tattoo|piercing|estate_agent|accountant|solicitor|notary|insurance|financial_advisor|recruitment|marketing|advertising|printing|photography|it|software|consulting"](around:${radiusMetres},${lat},${lng});
      way["amenity"~"restaurant|cafe|pub|bar|fast_food|clinic|pharmacy|dentist|doctors|veterinary|bank|bureau_de_change|post_office"](around:${radiusMetres},${lat},${lng});
      node["craft"](around:${radiusMetres},${lat},${lng});
      way["craft"](around:${radiusMetres},${lat},${lng});
      node["office"~"estate_agent|accountant|insurance|lawyer|solicitor|it|marketing|advertising|consulting|financial|recruitment|travel_agent|architect|engineer"](around:${radiusMetres},${lat},${lng});
      node["tourism"~"hotel|hostel|guest_house|motel|bed_and_breakfast|apartment"](around:${radiusMetres},${lat},${lng});
    );
    out body center qt;
  `;

  // Try each mirror in turn until one succeeds
  let response;
  let lastError;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      response = await axios.post(
        mirror,
        `data=${encodeURIComponent(query)}`,
        {
          timeout: TIMEOUT + 5000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'BusinessFinder/1.0 (UK business website checker)',
          },
        }
      );
      console.log(`[OSM] Used mirror: ${mirror}`);
      break;
    } catch (err) {
      console.warn(`[OSM] Mirror ${mirror} failed: ${err.response?.status || err.message}`);
      lastError = err;
    }
  }
  if (!response) throw lastError;

  const elements = response.data.elements || [];
  const businesses = [];
  const seenNames = new Set();

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;

    // Skip unnamed or unnamed duplicates
    if (!name || seenNames.has(name.toLowerCase())) continue;

    // Skip excluded amenity types
    if (tags.amenity && EXCLUDED_AMENITIES.has(tags.amenity)) continue;

    seenNames.add(name.toLowerCase());

    // Get coordinates (nodes have lat/lon directly, ways have center)
    const lat = el.lat || (el.center && el.center.lat);
    const lng = el.lon || (el.center && el.center.lon);

    const category = deriveCategory(tags);

    businesses.push({
      id: `osm_${el.type}_${el.id}`,
      source: 'OpenStreetMap',
      name,
      address: buildAddress(tags),
      phone: tags.phone || tags['contact:phone'] || null,
      email: tags.email || tags['contact:email'] || null,
      websiteFromSource: tags.website || tags['contact:website'] || tags.url || null,
      category,
      lat,
      lng,
      osmTags: {
        shop: tags.shop,
        amenity: tags.amenity,
        craft: tags.craft,
        office: tags.office,
        opening_hours: tags.opening_hours,
      },
    });
  }

  return businesses;
}

function buildAddress(tags) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:postcode'],
  ].filter(Boolean);
  return parts.join(', ') || null;
}

function deriveCategory(tags) {
  if (tags.shop) return `Shop: ${formatTag(tags.shop)}`;
  if (tags.craft) return `Craft: ${formatTag(tags.craft)}`;
  if (tags.amenity) return `${formatTag(tags.amenity)}`;
  if (tags.office) return `Office: ${formatTag(tags.office)}`;
  if (tags.tourism) return `Tourism: ${formatTag(tags.tourism)}`;
  if (tags.healthcare) return `Healthcare: ${formatTag(tags.healthcare)}`;
  return 'Business';
}

function formatTag(val) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = { getNearbyBusinesses };
