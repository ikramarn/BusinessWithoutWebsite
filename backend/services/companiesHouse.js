const axios = require('axios');

const CH_BASE = 'https://api.company-information.service.gov.uk';
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 8000;

/**
 * Search Companies House for businesses near a given postcode district
 * @param {string} postcode - e.g. "SW1A 1AA"
 * @param {string} companyName - optional: fuzzy match a specific name  
 * @returns {Promise<Array>}
 */
async function searchByPostcode(postcode, maxResults = 20) {
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    console.log('[CompaniesHouse] No API key configured, skipping');
    return [];
  }

  // Use the outward code (first part) for area search
  const outwardCode = postcode.trim().split(' ')[0].toUpperCase();

  try {
    const response = await axios.get(`${CH_BASE}/advanced-search/companies`, {
      params: {
        registered_office_address: outwardCode,
        company_status: 'active',
        size: maxResults,
      },
      auth: {
        username: process.env.COMPANIES_HOUSE_API_KEY,
        password: '',
      },
      timeout: TIMEOUT,
    });

    const items = response.data.items || [];

    return items.map(company => ({
      companyNumber: company.company_number,
      name: company.company_name,
      address: formatCHAddress(company.registered_office_address),
      postcode: company.registered_office_address?.postal_code || null,
      sicCodes: company.sic_codes || [],
      category: deriveCategoryFromSIC(company.sic_codes),
      incorporationDate: company.date_of_creation,
      status: company.company_status,
      companyType: company.company_type,
    }));
  } catch (err) {
    if (err.response?.status === 401) {
      console.error('[CompaniesHouse] Invalid API key');
    } else {
      console.error('[CompaniesHouse] Error:', err.message);
    }
    return [];
  }
}

/**
 * Look up a specific company by name to find its official record
 */
async function searchByName(name) {
  if (!process.env.COMPANIES_HOUSE_API_KEY) return null;

  try {
    const response = await axios.get(`${CH_BASE}/search/companies`, {
      params: { q: name, items_per_page: 5 },
      auth: {
        username: process.env.COMPANIES_HOUSE_API_KEY,
        password: '',
      },
      timeout: TIMEOUT,
    });

    const items = response.data.items || [];
    if (!items.length) return null;

    // Return first active match
    const match = items.find(i => i.company_status === 'active') || items[0];
    return {
      companyNumber: match.company_number,
      name: match.title,
      address: match.address_snippet,
      postcode: match.address?.postal_code || null,
      status: match.company_status,
    };
  } catch (err) {
    return null;
  }
}

function formatCHAddress(addr) {
  if (!addr) return null;
  return [
    addr.premises,
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
  ].filter(Boolean).join(', ');
}

// Basic SIC code to category mapping (UK SIC 2007)
function deriveCategoryFromSIC(sicCodes) {
  if (!sicCodes || !sicCodes.length) return 'Business';
  const code = parseInt(sicCodes[0]);

  if (code >= 1000 && code <= 9999) return 'Agriculture / Mining';
  if (code >= 10000 && code <= 33999) return 'Manufacturing';
  if (code >= 35000 && code <= 39999) return 'Utilities';
  if (code >= 41000 && code <= 43999) return 'Construction / Trades';
  if (code >= 45000 && code <= 47999) return 'Retail / Trade';
  if (code >= 49000 && code <= 53999) return 'Transport / Logistics';
  if (code >= 55000 && code <= 56999) return 'Hospitality / Food';
  if (code >= 58000 && code <= 63999) return 'Media / IT / Software';
  if (code >= 64000 && code <= 66999) return 'Financial Services';
  if (code >= 68000 && code <= 68999) return 'Real Estate';
  if (code >= 69000 && code <= 75999) return 'Professional Services';
  if (code >= 77000 && code <= 82999) return 'Administrative Services';
  if (code >= 85000 && code <= 85999) return 'Education';
  if (code >= 86000 && code <= 88999) return 'Health / Social Care';
  if (code >= 90000 && code <= 93999) return 'Arts / Entertainment';
  if (code >= 94000 && code <= 96999) return 'Personal Services';
  return 'Business';
}

module.exports = { searchByPostcode, searchByName };
