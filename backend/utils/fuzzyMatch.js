/**
 * Fuzzy business name matching - used to deduplicate results from multiple sources
 * (e.g. "Joe's Plumbing" vs "Joes Plumbing Ltd" vs "Joe Smith Plumbing")
 */

/**
 * Normalise a business name for comparison
 */
function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\b(ltd|limited|plc|llp|llc|co|company|group|uk|the)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings (0-1)
 * Using Dice coefficient on bigrams
 */
function diceSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const getBigrams = str => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if two business names are likely the same entity
 * @returns {boolean}
 */
function isSameBusiness(name1, name2, threshold = 0.7) {
  const n1 = normaliseName(name1);
  const n2 = normaliseName(name2);

  // Exact match after normalisation
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Dice coefficient similarity
  return diceSimilarity(n1, n2) >= threshold;
}

/**
 * Deduplicate a list of businesses from multiple sources
 * Keeps the richest record when duplicates found
 */
function deduplicateBusinesses(businesses) {
  const result = [];

  for (const business of businesses) {
    const existing = result.find(b => {
      // Same name
      if (isSameBusiness(b.name, business.name)) return true;
      // Same phone number
      if (b.phone && business.phone && normalisePhone(b.phone) === normalisePhone(business.phone)) return true;
      return false;
    });

    if (!existing) {
      result.push({ ...business });
    } else {
      // Merge - prefer non-null values
      mergeBusinessData(existing, business);
    }
  }

  return result;
}

function mergeBusinessData(target, source) {
  if (!target.phone && source.phone) target.phone = source.phone;
  if (!target.email && source.email) target.email = source.email;
  if (!target.address && source.address) target.address = source.address;
  if (!target.websiteFromSource && source.websiteFromSource) target.websiteFromSource = source.websiteFromSource;
  if (!target.category || target.category === 'Business') target.category = source.category;

  // Track all sources
  if (!target.sources) target.sources = [target.source];
  if (!target.sources.includes(source.source)) target.sources.push(source.source);
}

function normalisePhone(phone) {
  return phone.replace(/[^0-9]/g, '');
}

module.exports = { isSameBusiness, deduplicateBusinesses, normaliseName };
