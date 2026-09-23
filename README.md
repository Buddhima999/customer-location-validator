# Customer Location Validator

A mobile-friendly field registration app that saves a customer only when the
Google-geocoded address is within 2,000 metres of the confirmed on-site GPS point.

## Google Cloud setup

Create two restricted API keys in a billing-enabled Google Cloud project:

1. Browser key: enable **Maps JavaScript API**, restrict it to website referrers
   (`http://localhost:3000/*` while developing).
2. Server key: enable **Geocoding API v4**. Keep this key private and apply
   suitable API and server restrictions for the deployment environment. For a
   no-billing prototype, the same Maps Demo Key can be used for both variables.

Copy `.env.example` to `.env.local` and add both keys.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite database is created automatically at
`data/customers.db` after the first server request.

## Validation rules

- Device GPS accuracy must be 50 m or better (configurable).
- A manually adjusted marker must remain within 25 m of device GPS.
- The geocoded address must be within 2,000 m of the confirmed marker.
- All checks run again on the server before one transactional database insert.
- Failed validation never inserts a customer row.
