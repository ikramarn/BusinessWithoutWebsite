import { useRef, useEffect } from "react";
import BusinessCard from "./BusinessCard";

export default function BusinessList({ businesses, selectedId, onSelect, isStreaming, searchState }) {
  const prevLen = useRef(0);

  useEffect(() => {
    prevLen.current = businesses.length;
  });

  if (searchState === "idle") {
    return (
      <div className="business-list">
        <div className="empty-state">
          <div className="icon">🏪</div>
          <p>Enter a postcode to search for<br />businesses without a website.</p>
        </div>
      </div>
    );
  }

  if (businesses.length === 0 && !isStreaming) {
    return (
      <div className="business-list">
        <div className="empty-state">
          <div className="icon">🔎</div>
          <p>No businesses found for this filter.<br />Try selecting "All" to see all results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="business-list">
      {businesses.map((b, i) => (
        <BusinessCard
          key={b.id}
          business={b}
          selected={b.id === selectedId}
          onSelect={onSelect}
          isNew={i >= prevLen.current && isStreaming}
        />
      ))}
      {isStreaming && businesses.length === 0 && (
        <div className="empty-state">
          <div className="loading-spinner" style={{ width: 22, height: 22, borderWidth: 3 }} />
          <p style={{ marginTop: 10 }}>Discovering businesses...</p>
        </div>
      )}
    </div>
  );
}
