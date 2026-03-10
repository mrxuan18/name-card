"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo } from "react";

export type CardWithLocation = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  lat: number;
  lng: number;
};

type CardMapProps = {
  cards: CardWithLocation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:12px;height:12px;border-radius:9999px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function CardMap({ cards, selectedId, onSelect }: CardMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (cards.length > 0) {
      return [cards[0].lat, cards[0].lng];
    }
    return [31.2304, 121.4737];
  }, [cards]);

  const zoom = cards.length > 0 ? 13 : 4;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cards.map((card) => (
        <Marker
          key={card.id}
          position={[card.lat, card.lng]}
          icon={markerIcon}
          eventHandlers={{
            click: () => onSelect?.(card.id),
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{card.name}</div>
              {card.company && <div>{card.company}</div>}
              {card.phone && <div>{card.phone}</div>}
              {card.email && <div>{card.email}</div>}
              <div className="text-xs text-slate-600">{card.address}</div>
              {card.notes && (
                <div className="mt-1 text-xs text-slate-700">{card.notes}</div>
              )}
              {selectedId === card.id && (
                <div className="mt-1 text-[10px] text-sky-600">当前选中</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default CardMap;

