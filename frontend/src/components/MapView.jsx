import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const RED_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const GREEN_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function FlyToSelected({ business }) {
  const map = useMap();
  useEffect(() => {
    if (business?.lat && business?.lng) {
      map.flyTo([business.lat, business.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    }
  }, [business, map]);
  return null;
}

function FlyToCenter({ center }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (center?.lat && center?.lng) {
      const key = `${center.lat},${center.lng}`;
      if (key !== prev.current) {
        prev.current = key;
        map.flyTo([center.lat, center.lng], 14, { duration: 1 });
      }
    }
  }, [center, map]);
  return null;
}

export default function MapView({ businesses, selectedBusiness, center, onSelectBusiness }) {
  const defaultCenter = [51.505, -0.09];
  const defaultZoom = 13;
  const mapCenter = center?.lat ? [center.lat, center.lng] : defaultCenter;

  return (
    <div className="map-container">
      <MapContainer center={mapCenter} zoom={defaultZoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {center?.lat && (
          <Circle
            center={[center.lat, center.lng]}
            radius={(center.radiusMetres) || 1609}
            pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.05, weight: 2 }}
          />
        )}
        {businesses.map(b => {
          if (!b.lat || !b.lng) return null;
          const hasWebsite = b.verification?.hasWebsite;
          const icon = hasWebsite ? GREEN_ICON : RED_ICON;
          return (
            <Marker
              key={b.id}
              position={[b.lat, b.lng]}
              icon={icon}
              eventHandlers={{ click: () => onSelectBusiness(b) }}
            >
              <Popup>
                <strong>{b.name}</strong><br />
                {b.address && <span>{b.address}<br /></span>}
                {b.phone && <span>📞 {b.phone}<br /></span>}
                <span style={{ color: hasWebsite ? "green" : "red" }}>
                  {hasWebsite ? "✅ Has website" : "🚫 No website"}
                </span>
              </Popup>
            </Marker>
          );
        })}
        <FlyToCenter center={center} />
        <FlyToSelected business={selectedBusiness} />
      </MapContainer>
    </div>
  );
}
