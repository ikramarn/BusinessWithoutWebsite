export default function BusinessCard({ business, selected, onSelect, isNew }) {
  const v = business.verification;
  const confidence = v?.noWebsiteConfidence ?? 0;
  const hasWebsite = v?.hasWebsite;

  let badgeClass = "has-website";
  let badgeText = "Has Website";
  if (!hasWebsite) {
    if (confidence >= 70) { badgeClass = "high"; badgeText = `${confidence}%`; }
    else if (confidence >= 40) { badgeClass = "medium"; badgeText = `${confidence}%`; }
    else { badgeClass = "low"; badgeText = `${confidence}%`; }
  }

  const sources = business.sources?.length ? business.sources : [business.source].filter(Boolean);
  const categoryShort = business.category ? business.category.split(" / ")[0] : null;

  return (
    <div
      className={`business-card${selected ? " selected" : ""}${isNew ? " streaming" : ""}`}
      onClick={() => onSelect(business)}
    >
      <div className="card-header">
        <span className="card-name">{business.name}</span>
        <span className={`confidence-badge ${badgeClass}`}>{badgeText}</span>
      </div>
      <div className="card-inline-meta">
        {categoryShort && <span className="card-cat-inline">{categoryShort}</span>}
        {business.address && <span className="card-addr">{business.address}</span>}
      </div>
    </div>
  );
}
