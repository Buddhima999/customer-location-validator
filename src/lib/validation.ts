import { z } from "zod";

const coordinate = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const customerSubmissionSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(25),
  address: z.string().trim().min(8).max(500),
  deviceLocation: coordinate,
  confirmedLocation: coordinate,
  gpsAccuracy: z.number().positive().max(10_000),
});
