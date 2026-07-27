"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type Park = {
  park_number: number;
  park: string;
  province: string;
  place: string;
  note?: string;
  website?: string;
  full_address?: string;
  latitude: number;
  longitude: number;
  geocode_status?: string;
  land_status?: string;
  land_confidence?: string;
  land_source?: string;
  land_researched_on?: string;
};

const provinces = [
  "Alle provincies", "Groningen", "Friesland", "Drenthe", "Overijssel",
  "Flevoland", "Gelderland", "Utrecht", "Noord-Holland", "Zuid-Holland",
  "Zeeland", "Noord-Brabant", "Limburg",
];

export default function Home() {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<ReturnType<LeafletMap["createPane"]> | null>(null);
  const markers = useRef<LeafletMarker[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("Alle provincies");
  const [selected, setSelected] = useState<Park | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetch("/parks.json").then((r) => r.json()).then(setParks);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("nl");
    return parks.filter((park) => {
      const provinceMatch = province === "Alle provincies" || park.province === province;
      const queryMatch = !term || `${park.park} ${park.place} ${park.province}`.toLocaleLowerCase("nl").includes(term);
      return provinceMatch && queryMatch;
    });
  }, [parks, province, query]);

  useEffect(() => {
    if (!mapElement.current || map.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapElement.current) return;
      const instance = L.map(mapElement.current, {
        center: [52.18, 5.35],
        zoom: 7,
        zoomControl: false,
        minZoom: 7,
        maxBounds: [[50.55, 2.7], [54.1, 7.7]],
      });
      L.control.zoom({ position: "bottomright" }).addTo(instance);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap-bijdragers",
        maxZoom: 18,
      }).addTo(instance);
      map.current = instance;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      const bounds: [number, number][] = [];

      filtered.forEach((park) => {
        if (!Number.isFinite(park.latitude) || !Number.isFinite(park.longitude)) return;
        const approximate = park.geocode_status?.startsWith("Plaatscentrum");
        const icon = L.divIcon({
          className: "park-marker-wrap",
          html: `<span class="park-marker ${approximate ? "approximate" : ""}" aria-hidden="true"></span>`,
          iconSize: [24, 30],
          iconAnchor: [12, 28],
        });
        const marker = L.marker([park.latitude, park.longitude], {
          icon,
          title: park.park,
          keyboard: true,
        }).addTo(map.current!);
        marker.bindTooltip(park.park, {
          direction: "top",
          offset: [0, -25],
          className: "park-label",
          permanent: false,
          opacity: 1,
        });
        marker.on("click", () => {
          setSelected(park);
          map.current?.flyTo([park.latitude, park.longitude], Math.max(map.current.getZoom(), 11), { duration: 0.6 });
        });
        markers.current.push(marker);
        bounds.push([park.latitude, park.longitude]);
      });
      if (filtered.length > 0 && filtered.length < parks.length && bounds.length) {
        map.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });
      }
    });
    return () => { cancelled = true; };
  }, [filtered, mapReady, parks.length]);

  function choosePark(park: Park) {
    setSelected(park);
    map.current?.flyTo([park.latitude, park.longitude], 12, { duration: 0.7 });
    const marker = markers.current.find((m) => {
      const pos = m.getLatLng();
      return pos.lat === park.latitude && pos.lng === park.longitude;
    });
    marker?.openTooltip();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Investeringsverkenner</p>
          <h1>Vakantieparken in Nederland</h1>
        </div>
        <div className="counter" aria-live="polite">
          <strong>{filtered.length}</strong>
          <span>parken op de kaart</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="filters">
            <label>
              <span>Zoek een park of plaats</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bijv. Putten of De Boshoek"
              />
            </label>
            <label>
              <span>Provincie</span>
              <select value={province} onChange={(event) => setProvince(event.target.value)}>
                {provinces.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="legend">
            <span><i className="legend-pin exact" /> gevonden parklocatie</span>
            <span><i className="legend-pin approximate" /> globale plaatslocatie</span>
          </div>

          <div className="park-list" role="list">
            {filtered.map((park, index) => (
              <button
                className={`park-row ${selected === park ? "active" : ""}`}
                key={`${park.park}-${park.place}-${index}`}
                onClick={() => choosePark(park)}
                role="listitem"
              >
                <span className="park-index">#{String(park.park_number).padStart(3, "0")}</span>
                <span>
                  <strong>{park.park}</strong>
                  <small>{park.place} · {park.province}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="map-panel">
          <div ref={mapElement} className="map" aria-label="Kaart van Nederland met vakantieparken" />
          <div className="map-hint">Beweeg over een pin voor de naam · klik voor details</div>

          {selected && (
            <article className="detail-card" aria-live="polite">
              <button className="close" onClick={() => setSelected(null)} aria-label="Details sluiten">×</button>
              <p className="eyebrow">{selected.province}</p>
              <h2>{selected.park}</h2>
              <p className="park-number">Parknummer #{String(selected.park_number).padStart(3, "0")}</p>
              <p className="location">{selected.full_address || `${selected.place}, Nederland`}</p>
              {selected.note && <p className="notice">{selected.note}</p>}
              <div className="quality">
                <span className={selected.geocode_status?.startsWith("Plaatscentrum") ? "dot amber" : "dot"} />
                {selected.geocode_status}
              </div>
              <section className="land-status">
                <span>Grondpositie</span>
                <strong>{selected.land_status || "Onbekend - per object controleren"}</strong>
                <small>
                  {selected.land_confidence || "Niet op parkniveau vastgesteld"}
                  {selected.land_researched_on ? ` · gecontroleerd ${selected.land_researched_on}` : ""}
                </small>
                {selected.land_source && (
                  <a href={selected.land_source} target="_blank" rel="noreferrer">Bron grondinformatie</a>
                )}
              </section>
              <p className="land-caveat">
                De grondpositie kan binnen hetzelfde park per woning of kavel verschillen. Controleer altijd de koopakte en verkoopbrochure.
              </p>
              <div className="actions">
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noreferrer">Website openen</a>
                )}
                <a
                  className="secondary"
                  href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Route bekijken
                </a>
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
