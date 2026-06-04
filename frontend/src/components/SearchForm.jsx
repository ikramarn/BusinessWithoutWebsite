import { useState } from "react";

const RADIUS_OPTIONS = [
  { value: "0.25", label: "0.25 miles" },
  { value: "0.5",  label: "0.5 miles" },
  { value: "1",    label: "1 mile" },
  { value: "2",    label: "2 miles" },
  { value: "5",    label: "5 miles" },
  { value: "10",   label: "10 miles" },
];

export default function SearchForm({ onSearch, onCancel, isSearching }) {
  const [postcode, setPostcode] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("2");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = e => {
    e.preventDefault();
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) { setValidationError("Please enter a postcode."); return; }
    const re = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    if (!re.test(trimmed)) { setValidationError("Enter a valid UK postcode (e.g. SW1A 1AA)."); return; }
    setValidationError("");
    onSearch({ postcode: trimmed, radiusMiles: parseFloat(radiusMiles) });
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <h2>Search Nearby Businesses</h2>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="postcode">UK Postcode</label>
          <input
            id="postcode"
            type="text"
            placeholder="e.g. SW1A 1AA"
            value={postcode}
            onChange={e => { setPostcode(e.target.value); setValidationError(""); }}
            disabled={isSearching}
            maxLength={8}
          />
        </div>
        <div className="form-group">
          <label htmlFor="radius">Radius</label>
          <select id="radius" value={radiusMiles} onChange={e => setRadiusMiles(e.target.value)} disabled={isSearching}>
            {RADIUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {validationError && <div style={{ fontSize: "0.76rem", color: "var(--danger)", marginBottom: "6px" }}>{validationError}</div>}
      {!isSearching ? (
        <button type="submit" className="search-btn">
          🔍 Find Businesses
        </button>
      ) : (
        <button type="button" className="search-btn cancel" onClick={onCancel}>
          ✕ Cancel Search
        </button>
      )}
    </form>
  );
}
