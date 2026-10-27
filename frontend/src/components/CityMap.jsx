import { useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const sonipatCenter = [28.9931, 77.0151];
const layers = [
  ['all', 'All'],
  ['water', 'Water'],
  ['sanitation', 'Safai'],
  ['pollution', 'Air'],
  ['health', 'Health'],
  ['safety', 'Safety'],
  ['weather', 'Weather'],
  ['power', 'Power'],
  ['roads', 'Roads'],
];

const layerCategories = {
  water: ['water', 'drainage'],
  safai: ['sanitation'],
  air: ['pollution'],
  health: ['health'],
  safety: ['safety'],
  weather: ['weather'],
  power: ['electricity', 'streetlights'],
  roads: ['roads', 'traffic'],
};

function markerColor(complaint) {
  if (complaint.status === 'resolved') return '#4b8a69';
  if (complaint.status === 'in_progress') return '#5689a4';
  if (complaint.priority === 'high') return '#bb5b4b';
  return '#c58a42';
}

function MapPin({ complaint }) {
  return (
    <CircleMarker
      center={[Number(complaint.latitude), Number(complaint.longitude)]}
      radius={8}
      pathOptions={{
        color: '#ffffff',
        weight: 2,
        fillColor: markerColor(complaint),
        fillOpacity: 0.96,
      }}
    >
      <Popup>
        <strong>{complaint.title}</strong>
        <br />
        {complaint.category.replace('_', ' ')} · {complaint.status.replace('_', ' ')}
        <br />
        {complaint.location}
      </Popup>
    </CircleMarker>
  );
}

export default function CityMap({ complaints }) {
  const [activeLayer, setActiveLayer] = useState('all');
  const pinnedComplaints = useMemo(
    () => complaints.filter((complaint) => (
      Number.isFinite(Number(complaint.latitude))
      && Number.isFinite(Number(complaint.longitude))
      && complaint.latitude !== null
      && complaint.longitude !== null
    )),
    [complaints],
  );
  const visibleComplaints = pinnedComplaints.filter((complaint) => (
    activeLayer === 'all'
    || layerCategories[activeLayer]?.includes(complaint.category)
  ));

  return (
    <section className="surface map-card">
      <div className="card-heading map-card-heading">
        <div><p className="eyebrow">FIELD ACTIVITY · OPENSTREETMAP</p><h2>City service map</h2></div>
        <span className="subtle-count"><i /> {pinnedComplaints.length} GPS-pinned reports</span>
      </div>
      <div className="map-layer-tabs" role="group" aria-label="Filter city map by service">
        {layers.map(([value, label]) => (
          <button
            type="button"
            className={activeLayer === value ? 'map-layer-tab selected' : 'map-layer-tab'}
            key={value}
            onClick={() => setActiveLayer(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="real-map">
        <MapContainer
          center={sonipatCenter}
          zoom={12}
          scrollWheelZoom
          zoomControl={false}
          aria-label="Interactive street map centered on Sonipat"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />
          {visibleComplaints.map((complaint) => (
            <MapPin key={complaint.id} complaint={complaint} />
          ))}
        </MapContainer>
        {!pinnedComplaints.length && (
          <div className="map-overlay-empty">
            <strong>City map is ready</strong>
            <span>Allow location access when submitting a report to pin it here. Your address still works without GPS.</span>
          </div>
        )}
      </div>
      <div className="map-legend">
        <span><i className="legend-open" /> Needs attention</span>
        <span><i className="legend-progress" /> In progress</span>
        <span><i className="legend-done" /> Resolved</span>
        <span><i className="legend-urgent" /> High priority</span>
      </div>
    </section>
  );
}
