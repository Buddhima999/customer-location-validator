"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { GoogleLocationMap } from "@/components/google-location-map";
import type { Coordinates } from "@/lib/distance";

type ApiResponse = { ok: boolean; message: string; distance?: number; geocodedLocation?: Coordinates; formattedAddress?: string; };
type Notice = { kind: "success" | "error" | "info"; message: string } | null;

export function CustomerLocationForm() {
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [confirmedLocation, setConfirmedLocation] = useState<Coordinates | null>(null);
  const [geocodedLocation, setGeocodedLocation] = useState<Coordinates | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: "info", message: "Capture the device location while standing at the customer’s property." });
  const watchIdRef = useRef<number | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (locationTimerRef.current !== null) clearTimeout(locationTimerRef.current);
    watchIdRef.current = null;
    locationTimerRef.current = null;
  }, []);

  useEffect(() => stopLocationWatch, [stopLocationWatch]);

  const updateConfirmedLocation = useCallback((location: Coordinates) => {
    setConfirmedLocation(location);
    setGeocodedLocation(null);
  }, []);

  function captureLocation() {
    if (!navigator.geolocation) {
      setNotice({ kind: "error", message: "This device does not support location services." });
      return;
    }
    if (!window.isSecureContext) {
      setNotice({ kind: "error", message: "GPS requires HTTPS or localhost. Open this application using a secure address." });
      return;
    }

    stopLocationWatch();
    setLocating(true);
    setNotice({ kind: "info", message: "Improving GPS accuracy… keep the device still near an open area." });

    let bestPosition: GeolocationPosition | null = null;

    const applyReading = (position: GeolocationPosition) => {
      if (bestPosition && position.coords.accuracy >= bestPosition.coords.accuracy) return;
      bestPosition = position;
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setDeviceLocation(location);
      setConfirmedLocation(location);
      setGpsAccuracy(position.coords.accuracy);
      setGeocodedLocation(null);
      setNotice({ kind: "info", message: `Best GPS reading: ±${Math.round(position.coords.accuracy)} m. Still checking…` });
    };

    const finish = () => {
      stopLocationWatch();
      setLocating(false);
      if (!bestPosition) {
        setNotice({ kind: "error", message: "No GPS reading was received. Check location permissions and try outdoors." });
        return;
      }
      const accuracy = bestPosition.coords.accuracy;
      if (accuracy > 50) {
        setDeviceLocation(null);
        setConfirmedLocation(null);
      }
      setNotice({
        kind: accuracy <= 50 ? "success" : "error",
        message: accuracy <= 50
          ? `Best location captured with ±${Math.round(accuracy)} m accuracy.`
          : `Location is only accurate to ±${Math.round(accuracy)} m and cannot be saved. Try on a GPS-enabled phone outdoors.`,
      });
    };

    watchIdRef.current = navigator.geolocation.watchPosition((position) => {
      applyReading(position);
      if (position.coords.accuracy <= 15) finish();
    }, (error) => {
      if (bestPosition) finish();
      else {
        stopLocationWatch();
        setLocating(false);
        setNotice({ kind: "error", message: `Location could not be captured: ${error.message}` });
      }
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });

    locationTimerRef.current = setTimeout(finish, 15_000);
  }

  async function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceLocation || !confirmedLocation || gpsAccuracy === null) {
      setNotice({ kind: "error", message: "Capture the device GPS location before saving." });
      return;
    }
    const currentForm = event.currentTarget;
    const form = new FormData(currentForm);
    setSubmitting(true);
    setGeocodedLocation(null);
    setNotice({ kind: "info", message: "Checking the address against the confirmed location…" });
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), phone: form.get("phone"), address: form.get("address"),
          deviceLocation, confirmedLocation, gpsAccuracy,
        }),
      });
      const result = (await response.json()) as ApiResponse;
      if (result.geocodedLocation) setGeocodedLocation(result.geocodedLocation);
      setNotice({ kind: result.ok ? "success" : "error", message: result.message });
      if (result.ok) currentForm.reset();
    } catch {
      setNotice({ kind: "error", message: "The server could not be reached. Nothing was saved." });
    } finally { setSubmitting(false); }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">VP</div>
        <div><p className="eyebrow">Field registration</p><h1>Verify customer location</h1></div>
        <div className="rule-chip"><span />2 km rule</div>
      </header>
      <div className="workspace">
        <section className="map-panel">
          <GoogleLocationMap selectedLocation={confirmedLocation} geocodedLocation={geocodedLocation} onLocationChange={updateConfirmedLocation} />
          <div className="map-legend">
            <span><b className="dot customer" />Confirmed location</span>
            <span><b className="dot address" />Google address</span>
            <span><b className="ring" />2 km address area</span>
          </div>
        </section>
        <section className="form-panel">
          <div className="step-heading"><span>01</span><div><p>Customer record</p><h2>Details & address</h2></div></div>
          <form onSubmit={submitCustomer}>
            <label>Customer name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Nimal Perera" /></label>
            <label>Phone number<input name="phone" required minLength={7} maxLength={25} inputMode="tel" placeholder="e.g. 077 123 4567" /></label>
            <label>Full postal address<textarea name="address" required minLength={8} maxLength={500} rows={3} placeholder="House number, street, city, postal code" /></label>
            <div className="divider" />
            <div className="step-heading compact"><span>02</span><div><p>On-site check</p><h2>Capture GPS position</h2></div></div>
            <button className="location-button" type="button" onClick={captureLocation} disabled={locating}>
              <span className="target-icon">⌖</span>{locating ? "Locating…" : deviceLocation ? "Capture location again" : "Use current location"}
            </button>
            <div className="coordinate-grid">
              <div><small>Latitude</small><strong>{confirmedLocation?.latitude.toFixed(6) ?? "—"}</strong></div>
              <div><small>Longitude</small><strong>{confirmedLocation?.longitude.toFixed(6) ?? "—"}</strong></div>
              <div><small>GPS accuracy</small><strong>{gpsAccuracy === null ? "—" : `±${Math.round(gpsAccuracy)} m`}</strong></div>
            </div>
            {notice && <div className={`notice ${notice.kind}`}><span />{notice.message}</div>}
            <button className="save-button" type="submit" disabled={submitting || !deviceLocation || gpsAccuracy === null || gpsAccuracy > 50}>{submitting ? "Verifying…" : "Verify address & save"}</button>
            <p className="privacy-note">No record is written unless the server confirms the address is within 2,000 meters.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
