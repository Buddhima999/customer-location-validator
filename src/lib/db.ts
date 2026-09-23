import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, "customers.db"));
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    entered_address TEXT NOT NULL,
    formatted_address TEXT NOT NULL,
    place_id TEXT,
    device_latitude REAL NOT NULL,
    device_longitude REAL NOT NULL,
    confirmed_latitude REAL NOT NULL,
    confirmed_longitude REAL NOT NULL,
    geocoded_latitude REAL NOT NULL,
    geocoded_longitude REAL NOT NULL,
    gps_accuracy_meters REAL NOT NULL,
    address_distance_meters REAL NOT NULL,
    geocode_location_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

export default database;
