import { useState, useEffect, useRef } from "react";
import { fetchSources, startStreamSearch } from "./api";
import BusinessList from "./components/BusinessList";
import DetailPanel from "./components/DetailPanel";
import SearchForm from "./components/SearchForm";
import MapView from "./components/MapView";
import "./App.css";

export default function App() {
  const [sources, setSources] = useState(null);
  const [searchState, setSearchState] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("no-website");
  const esRef = useRef(null);

  useEffect(() => {
    fetchSources().then(setSources).catch(() => {});
  }, []);

  const handleSearch = ({ postcode, radiusMiles }) => {
    if (esRef.current) esRef.current.close();
    setSearchState("searching");
    setBusinesses([]);
    setSelectedBusiness(null);
    setError(null);
    setProgress({ processed: 0, total: 0 });
    setStatusMsg("Starting search...");

    const es = startStreamSearch(
      { postcode, radiusMiles, filter: "all" },
      {
        onStatus: data => {
          setStatusMsg(data.message);
          setProgress(p => ({ ...p, step: data.step, totalSteps: data.totalSteps, total: data.total ?? p.total }));
        },
        onLocation: data => setSearchMeta(prev => ({ ...prev, location: data })),
        onSources: data => setSearchMeta(prev => ({ ...prev, sources: data })),
        onBusiness: biz => setBusinesses(prev => [...prev, biz]),
        onProgress: data => setProgress(p => ({ ...p, ...data })),
        onComplete: data => { setSearchState("done"); setSearchMeta(prev => ({ ...prev, ...data })); },
        onError: data => { setError(data.message || "Search failed"); setSearchState("error"); },
      }
    );
    esRef.current = es;
  };

  const handleCancel = () => {
    if (esRef.current) esRef.current.close();
    setSearchState("done");
  };

  const filtered = businesses.filter(b => {
    if (activeFilter === "no-website") return !b.verification?.hasWebsite;
    if (activeFilter === "has-website") return b.verification?.hasWebsite;
    return true;
  });

  const noCount = businesses.filter(b => !b.verification?.hasWebsite).length;
  const yesCount = businesses.filter(b => b.verification?.hasWebsite).length;

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">🔍</span>
        <div>
          <h1>UK Business Without Website Finder</h1>
          <p>Find local businesses with no online presence</p>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <SearchForm
            onSearch={handleSearch}
            onCancel={handleCancel}
            isSearching={searchState === "searching"}
          />

          {sources && (
            <div className="api-status">
              <span className="api-badge active">✓ OSM</span>
              <span className={`api-badge ${sources.googlePlaces ? "active" : "inactive"}`}>
                {sources.googlePlaces ? "✓" : "○"} Google Places
              </span>
              <span className={`api-badge ${sources.companiesHouse ? "active" : "inactive"}`}>
                {sources.companiesHouse ? "✓" : "○"} Companies House
              </span>
              <span className={`api-badge ${sources.bingSearch ? "active" : "inactive"}`}>
                {sources.bingSearch ? "✓" : "○"} Bing Search
              </span>
              <span className="api-badge active">✓ DNS Check</span>
            </div>
          )}

          {searchState === "searching" && (
            <div className="progress-section">
              <div className="progress-label">
                <span className="loading-spinner" />
                {statusMsg}
              </div>
              {progress.total > 0 && (
                <>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="progress-step">
                    Checked {progress.processed} / {progress.total} businesses
                  </div>
                </>
              )}
            </div>
          )}

          {error && <div className="error-msg">⚠️ {error}</div>}

          {businesses.length > 0 && (
            <div className="results-header">
              <div className="results-count">
                <strong>{noCount}</strong> without website · {businesses.length} total
              </div>
              <div className="filter-tabs">
                <button className={`filter-tab ${activeFilter === "no-website" ? "active" : ""}`} onClick={() => setActiveFilter("no-website")}>
                  No Site ({noCount})
                </button>
                <button className={`filter-tab ${activeFilter === "has-website" ? "active" : ""}`} onClick={() => setActiveFilter("has-website")}>
                  Has Site ({yesCount})
                </button>
                <button className={`filter-tab ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")}>
                  All ({businesses.length})
                </button>
              </div>
            </div>
          )}

          <BusinessList
            businesses={filtered}
            selectedId={selectedBusiness?.id}
            onSelect={setSelectedBusiness}
            isStreaming={searchState === "searching"}
            searchState={searchState}
          />

          {filtered.length > 0 && searchState !== "searching" && (
            <div className="export-bar">
              <span>{filtered.length} results shown</span>
              <button onClick={() => exportCSV(filtered)}>↓ Export CSV</button>
            </div>
          )}
        </aside>

        <main className="main-content">
          <MapView
            businesses={filtered}
            selectedBusiness={selectedBusiness}
            center={searchMeta?.location}
            onSelectBusiness={setSelectedBusiness}
          />
          <DetailPanel business={selectedBusiness} />
        </main>
      </div>
    </div>
  );
}

function exportCSV(businesses) {
  const headers = ["Name", "Category", "Address", "Phone", "Sources", "No-Website Confidence %", "Website Found"];
  const rows = businesses.map(b => [
    b.name,
    b.category || "",
    b.address || "",
    b.phone || "",
    (b.sources || [b.source]).join(" + "),
    b.verification?.noWebsiteConfidence ?? "",
    b.verification?.websiteUrl || "",
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "no-website-businesses-" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
}
