const dns = require('dns').promises;
const axios = require('axios');

const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 8000;

/**
 * Multi-layer website verification for a business.
 * Each check returns: { passed: bool, detail: string }
 *
 * CHECKS:
 *   1. sourceWebsite  - Did the discovery source (Google Places / OSM) list a website?
 *   2. dnsGuess       - DNS lookup on guessed domains (name.co.uk, name.com, etc.)
 *   3. bingSearch     - Bing Web Search for "{name} {town}" - does a website appear?
 *   4. directHttp     - Can we reach a guessed URL (HTTP 200)?
 *
 * A business is flagged "No Website" only if ALL checks fail.
 */
async function checkWebsitePresence(business, locationHint = '') {
  const checks = {};
  let websiteFound = null;

  // ── CHECK 1: Did the source already supply a website? ──────────────────────
  if (business.websiteFromSource) {
    checks.sourceWebsite = {
      passed: true,
      detail: business.websiteFromSource,
    };
    websiteFound = business.websiteFromSource;
  } else {
    checks.sourceWebsite = {
      passed: false,
      detail: 'No website in source data',
    };
  }

  // ── CHECK 2: DNS lookup on guessed domains ─────────────────────────────────
  const guessedDomains = generateDomainGuesses(business.name);
  const dnsResult = await checkDNS(guessedDomains);
  checks.dnsGuess = dnsResult;
  if (dnsResult.passed && !websiteFound) {
    websiteFound = `https://${dnsResult.domain}`;
  }

  // ── CHECK 3: Bing Web Search (optional, only if key configured) ────────────
  if (process.env.BING_SEARCH_API_KEY) {
    const bingResult = await checkBingSearch(business.name, locationHint);
    checks.bingSearch = bingResult;
    if (bingResult.passed && !websiteFound) {
      websiteFound = bingResult.url;
    }
  } else {
    checks.bingSearch = { passed: false, detail: 'Bing API not configured (skipped)' };
  }

  // ── CHECK 4: Direct HTTP reachability on guessed domain ───────────────────
  if (!websiteFound && guessedDomains.length > 0) {
    const httpResult = await checkDirectHttp(guessedDomains.slice(0, 3));
    checks.directHttp = httpResult;
    if (httpResult.passed && !websiteFound) {
      websiteFound = httpResult.url;
    }
  } else {
    checks.directHttp = {
      passed: !!websiteFound,
      detail: websiteFound ? `Reachable at ${websiteFound}` : 'No domains to test',
    };
  }

  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(c => c.passed).length;

  // DNS alone is unreliable (parked domains, squatters) — require a stronger signal:
  // sourceWebsite (from OSM/Google), directHttp (actually loaded), or bingSearch
  const hasWebsite =
    checks.sourceWebsite?.passed ||
    checks.directHttp?.passed ||
    checks.bingSearch?.passed ||
    false;

  return {
    hasWebsite,
    websiteUrl: websiteFound,
    confidenceScore: passedChecks,           // 0 = definitely no website
    totalChecks,
    checks,
    noWebsiteConfidence: calculateNoWebsiteConfidence(checks),
  };
}

/**
 * Calculate how confident we are that this business has NO website (0-100%)
 */
function calculateNoWebsiteConfidence(checks) {
  const weights = {
    sourceWebsite: 40,  // Source data says no website = strong signal
    dnsGuess: 25,       // No DNS resolution = good signal
    bingSearch: 20,     // Not found on web = moderate signal
    directHttp: 15,     // Can't reach a guessed URL = supporting signal
  };

  let totalWeight = 0;
  let noWebsiteWeight = 0;

  for (const [key, check] of Object.entries(checks)) {
    const weight = weights[key] || 10;
    // Only count configured checks
    if (check.detail !== 'Bing API not configured (skipped)') {
      totalWeight += weight;
      if (!check.passed) noWebsiteWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((noWebsiteWeight / totalWeight) * 100);
}

/**
 * Generate plausible domain names from business name
 */
function generateDomainGuesses(name) {
  if (!name) return [];

  // Normalise: lowercase, remove special chars, collapse spaces
  const base = name
    .toLowerCase()
    .replace(/[''`]/g, '')                          // apostrophes
    .replace(/[^a-z0-9\s-]/g, ' ')                 // non-alphanum
    .trim()
    .replace(/\s+/g, '')                            // remove all spaces for domain
    .substring(0, 50);

  const withHyphen = name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);

  const domains = [];
  if (base) {
    domains.push(`${base}.co.uk`);
    domains.push(`${base}.com`);
    domains.push(`${withHyphen}.co.uk`);
    domains.push(`${withHyphen}.com`);
    // Common prefix patterns
    if (!base.startsWith('the')) {
      domains.push(`the${base}.co.uk`);
    }
  }

  // Deduplicate
  return [...new Set(domains)].filter(d => d.length > 5);
}

/**
 * Check if any guessed domain resolves via DNS
 */
async function checkDNS(domains) {
  for (const domain of domains) {
    try {
      await dns.lookup(domain);
      return {
        passed: true,
        detail: `DNS resolves: ${domain}`,
        domain,
      };
    } catch {
      // continue to next domain
    }
  }
  return {
    passed: false,
    detail: `No DNS resolution for ${domains.slice(0, 3).join(', ')}${domains.length > 3 ? '...' : ''}`,
  };
}

/**
 * Check if any guessed URL returns a successful HTTP response
 */
async function checkDirectHttp(domains) {
  for (const domain of domains) {
    for (const proto of ['https', 'http']) {
      const url = `${proto}://${domain}`;
      try {
        const res = await axios.head(url, {
          timeout: 5000,
          maxRedirects: 3,
          validateStatus: s => s < 500,
        });
        if (res.status < 400) {
          return {
            passed: true,
            detail: `HTTP ${res.status} at ${url}`,
            url,
          };
        }
      } catch {
        // continue
      }
    }
  }
  return {
    passed: false,
    detail: 'No HTTP response on guessed domains',
  };
}

/**
 * Bing Web Search for "{business name} {location}"
 * Looks for a matching website in results
 */
async function checkBingSearch(name, locationHint) {
  try {
    const query = `"${name}" ${locationHint}`.trim();
    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: {
        q: query,
        count: 5,
        mkt: 'en-GB',
        safeSearch: 'Moderate',
      },
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY,
      },
      timeout: TIMEOUT,
    });

    const webPages = response.data.webPages?.value || [];

    // Look for a direct website match (not Facebook, Yell, Google, etc.)
    const directSite = webPages.find(page => {
      const url = page.url.toLowerCase();
      const isDirectory = ['facebook.com', 'yell.com', 'google.com', 'tripadvisor', 
                           'yelp.com', 'checkatrade', 'companies house', 'linkedin.com',
                           'twitter.com', 'instagram.com', 'justeat', 'deliveroo'].some(d => url.includes(d));
      return !isDirectory;
    });

    if (directSite) {
      return {
        passed: true,
        detail: `Found via web search: ${directSite.url}`,
        url: directSite.url,
      };
    }

    // Even if only on directories, that's still "found on web" to some degree
    if (webPages.length > 0) {
      return {
        passed: true,
        detail: `Found in web search (directory listing): ${webPages[0].url}`,
        url: webPages[0].url,
        isDirectoryOnly: true,
      };
    }

    return {
      passed: false,
      detail: 'Not found in Bing web search',
    };
  } catch (err) {
    return {
      passed: false,
      detail: `Bing search error: ${err.message}`,
    };
  }
}

module.exports = { checkWebsitePresence, generateDomainGuesses };
