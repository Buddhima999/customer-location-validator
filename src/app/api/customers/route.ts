import { NextResponse } from "next/server";
import database from "@/lib/db";
import { distanceInMeters } from "@/lib/distance";
import { geocodeAddress } from "@/lib/google-geocoding";
import { customerSubmissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_ADDRESS_DISTANCE_METERS = Number(process.env.MAX_ADDRESS_DISTANCE_METERS ?? 2_000);
const MAX_MARKER_DISTANCE_METERS = 25;
const MAX_GPS_ACCURACY_METERS = Number(process.env.MAX_GPS_ACCURACY_METERS ?? 50);

export async function POST(request: Request) {
  try {
    const parsed = customerSubmissionSchema.safeParse(await request.json());
    if (!parsed.success) {
      const invalidFields = [...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter(Boolean))];
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_INPUT",
          message: invalidFields.length
            ? `Please correct these fields: ${invalidFields.join(", ")}. Nothing was saved.`
            : "Please provide valid customer, address, and GPS details. Nothing was saved.",
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    if (input.gpsAccuracy > MAX_GPS_ACCURACY_METERS) {
      return NextResponse.json({
        ok: false,
        code: "GPS_ACCURACY_TOO_LOW",
        message: `GPS accuracy is ${Math.round(input.gpsAccuracy)} m. Move to an open area and try again (maximum ${MAX_GPS_ACCURACY_METERS} m).`,
      }, { status: 422 });
    }

    const markerDistance = distanceInMeters(input.deviceLocation, input.confirmedLocation);
    if (markerDistance > MAX_MARKER_DISTANCE_METERS) {
      return NextResponse.json({
        ok: false,
        code: "MARKER_TOO_FAR_FROM_GPS",
        distance: markerDistance,
        message: `The selected point is ${Math.round(markerDistance)} m from the device location. It must be within ${MAX_MARKER_DISTANCE_METERS} m.`,
      }, { status: 422 });
    }

    const geocoded = await geocodeAddress(input.address);
    const addressDistance = distanceInMeters(input.confirmedLocation, geocoded.coordinates);
    if (addressDistance > MAX_ADDRESS_DISTANCE_METERS) {
      return NextResponse.json({
        ok: false,
        code: "ADDRESS_LOCATION_MISMATCH",
        distance: addressDistance,
        geocodedLocation: geocoded.coordinates,
        formattedAddress: geocoded.formattedAddress,
        message: `The entered address is ${Math.round(addressDistance)} m from the selected location. Nothing was saved.`,
      }, { status: 422 });
    }

    const insert = database.prepare(`
      INSERT INTO customers (
        name, phone, entered_address, formatted_address, place_id,
        device_latitude, device_longitude, confirmed_latitude, confirmed_longitude,
        geocoded_latitude, geocoded_longitude, gps_accuracy_meters,
        address_distance_meters, geocode_location_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = database.transaction(() => insert.run(
      input.name, input.phone, input.address, geocoded.formattedAddress, geocoded.placeId,
      input.deviceLocation.latitude, input.deviceLocation.longitude,
      input.confirmedLocation.latitude, input.confirmedLocation.longitude,
      geocoded.coordinates.latitude, geocoded.coordinates.longitude,
      input.gpsAccuracy, addressDistance, geocoded.locationType,
    ))();

    return NextResponse.json({
      ok: true,
      id: Number(result.lastInsertRowid),
      distance: addressDistance,
      geocodedLocation: geocoded.coordinates,
      formattedAddress: geocoded.formattedAddress,
      message: `Customer saved. Address is ${Math.round(addressDistance)} m from the confirmed location.`,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    const configurationError = message.includes("GOOGLE_MAPS_SERVER_KEY");
    return NextResponse.json(
      { ok: false, code: configurationError ? "CONFIGURATION_ERROR" : "SERVER_ERROR", message },
      { status: configurationError ? 503 : 500 },
    );
  }
}
