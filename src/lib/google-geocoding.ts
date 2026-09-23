import type { Coordinates } from "@/lib/distance";

type GeocodingResponse = {
  results: Array<{
    formattedAddress: string;
    placeId?: string;
    location: { latitude: number; longitude: number };
    granularity: string;
  }>;
};

type GoogleErrorResponse = {
  error?: { message?: string };
};

export type GeocodedAddress = {
  coordinates: Coordinates;
  formattedAddress: string;
  placeId: string | null;
  locationType: string;
};

export async function geocodeAddress(address: string): Promise<GeocodedAddress> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_SERVER_KEY is not configured on the server.");

  const params = new URLSearchParams({
    addressQuery: address,
    regionCode: "LK",
  });
  const response = await fetch(
    `https://geocode.googleapis.com/v4/geocode/address?${params}`,
    {
      cache: "no-store",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "results.location,results.formattedAddress,results.placeId,results.granularity",
      },
    },
  );
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as GoogleErrorResponse;
    const detail = errorData.error?.message;
    throw new Error(detail ? `Google Geocoding error: ${detail}` : "The address service is temporarily unavailable.");
  }

  const data = (await response.json()) as GeocodingResponse;
  if (!data.results?.length) throw new Error("Google could not find that address. Please enter a more complete address.");

  const result = data.results[0];
  return {
    coordinates: {
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    },
    formattedAddress: result.formattedAddress,
    placeId: result.placeId ?? null,
    locationType: result.granularity,
  };
}
