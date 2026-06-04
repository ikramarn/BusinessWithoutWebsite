const CHECK_META = {
  sourceWebsite: { icon: "📄", name: "Source Data" },
  dnsGuess:      { icon: "🔌", name: "DNS Lookup" },
  bingSearch:    { icon: "🔍", name: "Bing Search" },
  directHttp:    { icon: "🌐", name: "HTTP Probe" },
};

export default function DetailPanel({ business }) {
  if (!business) {
    return (
      <div className="detail-panel">
        <div className="detail-empty">
          <div className="icon">👆</div>
          <p>Select a business to see details</p>
        </div>
      </div>
    );
  }

  const v = business.verification;
  const hasWebsite = v?.hasWebsite;
  const confidence = v?.noWebsiteConfidence ?? 0;

  const confidenceLevel = confidence >= 70 ? "high" : confidence >= 40 ? "medium" : "low";

  const chQuery = encodeURIComponent(business.name);
  const googleQuery = encodeURIComponent(`${business.name} ${business.address || ""}`);
  const sources = business.sources?.length ? business.sources : [business.source].filter(Boolean);

  return (
    <div className="detail-panel">
      <div className="detail-inner">
        <div className="detail-header-row">
          <div className="detail-business-name">{business.name}</div>
          {business.category && <span className="detail-category-badge">{business.category}</span>}
        </div>

        <div className={`verdict-banner ${hasWebsite ? "has-website" : "no-website"}`}>
          <span className="verdict-icon">{hasWebsite ? "✅" : "🚫"}</span>
          <div className="verdict-text">
            <h3>{hasWebsite ? "Has a Website" : "No Website Detected"}</h3>
            <p>{hasWebsite
              ? `Website found: ${v?.websiteUrl || "see checks below"}`
              : `${confidence}% confident — potential sales opportunity`}
            </p>
          </div>
        </div>

        {!hasWebsite && (
          <div>
            <div className="section-title">No-Website Confidence</div>
            <div className="confidence-meter">
              <div className={`confidence-fill ${confidenceLevel}`} style={{ width: `${confidence}%` }} />
            </div>
            <div className="confidence-label">
              <span>{confidence}% confident no website exists</span>
              <span style={{ textTransform: "capitalize" }}>{confidenceLevel} confidence</span>
            </div>
          </div>
        )}

        {v?.checks && (
          <div>
            <div className="section-title">Verification Checks</div>
            <div className="checks-grid">
              {Object.entries(v.checks).map(([key, check]) => {
                const meta = CHECK_META[key] || { icon: "🔧", name: key };
                const passed = check.found === false || check.checked === false;
                return (
                  <div key={key} className="check-row">
                    <span className="check-icon">{meta.icon}</span>
                    <div className="check-content">
                      <div className="check-name">{meta.name}</div>
                      {check.url && <div className="check-detail">{check.url}</div>}
                      {check.domain && <div className="check-detail">{check.domain}</div>}
                      {check.reason && !check.url && !check.domain && <div className="check-detail">{check.reason}</div>}
                    </div>
                    <span className={`check-status ${check.found || check.checked ? "passed" : "failed"}`}>
                      {check.found || check.checked ? "Found" : "None"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="info-section">
          <div className="section-title">Business Info</div>
          {business.address && (
            <div className="info-row"><span className="info-label">Address</span><span>{business.address}</span></div>
          )}
          {business.phone && (
            <div className="info-row"><span className="info-label">Phone</span><a href={`tel:${business.phone}`}>{business.phone}</a></div>
          )}
          {business.email && (
            <div className="info-row"><span className="info-label">Email</span><a href={`mailto:${business.email}`}>{business.email}</a></div>
          )}
          {v?.websiteUrl && (
            <div className="info-row"><span className="info-label">Website</span><a href={v.websiteUrl} target="_blank" rel="noopener noreferrer">{v.websiteUrl}</a></div>
          )}
          {sources.length > 0 && (
            <div className="info-row"><span className="info-label">Sources</span><span>{sources.join(", ")}</span></div>
          )}
        </div>

        <div className="action-buttons">
          <a
            className="action-btn primary"
            href={`https://www.google.com/search?q=${googleQuery}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔍 Google Search
          </a>
          <a
            className="action-btn"
            href={`https://find-and-update.company-information.service.gov.uk/search?q=${chQuery}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            🏛 Companies House
          </a>
          <button
            className="action-btn"
            onClick={() => {
              const text = [business.name, business.address, business.phone, business.email].filter(Boolean).join("\n");
              navigator.clipboard.writeText(text);
            }}
          >
            📋 Copy Details
          </button>
        </div>
      </div>
    </div>
  );
}
