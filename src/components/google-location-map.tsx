"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/lib/distance";

declare global {
  interface Window { initCustomerMap?: () => void; }
}

type Props = {
  selectedLocation: Coordinates | null;
  geocodedLocation: Coordinates | null;
  onLocationChange: (location: Coordinates) => void;
};

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.marker) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    window.initCustomerMap = resolve;
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: "initCustomerMap",
      v: "weekly",
      libraries: "marker",
      region: "LK",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

function markerLabel(label: string, className: string) {
  const element = document.createElement("div");
  element.className = `map-pin ${className}`;
  element.textContent = label;
  return element;
}

export function GoogleLocationMap({ selectedLocation, geocodedLocation, onLocationChange }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const selectedMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const addressMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  useEffect(() => {
    if (!apiKey || !elementRef.current) return;
    let active = true;
    loadGoogleMaps(apiKey).then(() => {
      if (!active || !elementRef.current || mapRef.current) return;
      const map = new google.maps.Map(elementRef.current, {
        center: { lat: 7.8731, lng: 80.7718 },
        zoom: 8,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });
      map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) onLocationChange({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
      mapRef.current = map;
      setMapReady(true);
    }).catch((reason: Error) => setError(reason.message));
    return () => { active = false; };
  }, [apiKey, onLocationChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!selectedLocation) {
      if (selectedMarkerRef.current) selectedMarkerRef.current.map = null;
      selectedMarkerRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      return;
    }
    const position = { lat: selectedLocation.latitude, lng: selectedLocation.longitude };
    if (!selectedMarkerRef.current) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        gmpDraggable: true,
        title: "Confirmed customer location",
        content: markerLabel("C", "customer-pin"),
      });
      marker.addEventListener("gmp-dragend", () => {
        const updatedPosition = marker.position;
        if (!updatedPosition) return;
        const point = updatedPosition instanceof google.maps.LatLng
          ? { latitude: updatedPosition.lat(), longitude: updatedPosition.lng() }
          : { latitude: Number(updatedPosition.lat), longitude: Number(updatedPosition.lng) };
        onLocationChange(point);
      });
      selectedMarkerRef.current = marker;
      circleRef.current = new google.maps.Circle({
        map, center: position, radius: 2_000, strokeColor: "#16a34a", strokeOpacity: 0.9,
        strokeWeight: 2, fillColor: "#22c55e", fillOpacity: 0.16,
      });
    } else {
      selectedMarkerRef.current.position = position;
      circleRef.current?.setCenter(position);
    }
    map.panTo(position);
    if ((map.getZoom() ?? 0) < 19) map.setZoom(19);
  }, [selectedLocation, onLocationChange, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!geocodedLocation) {
      if (addressMarkerRef.current) addressMarkerRef.current.map = null;
      addressMarkerRef.current = null;
      return;
    }
    const position = { lat: geocodedLocation.latitude, lng: geocodedLocation.longitude };
    if (!addressMarkerRef.current) {
      addressMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map, position, title: "Address location from Google", content: markerLabel("A", "address-pin"),
      });
    } else addressMarkerRef.current.position = position;
  }, [geocodedLocation, mapReady]);

  if (!apiKey) {
    return <div className="map-fallback"><span>Map waiting for Google API key</span><small>Add NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to .env.local</small></div>;
  }

  return <div className="map-shell"><div ref={elementRef} className="map-canvas" aria-label="Customer location map" />{error && <div className="map-error">{error}</div>}</div>;
}
