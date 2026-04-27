// создание client.sqlite если нет

import sqlite3 from 'sqlite3';
import path from "path";
import fs from "fs";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../client.sqlite');

// Create database connection
export function getDB() {
    const dbExists = fs.existsSync(DB_FILE);
    const db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
            return;
        }
        console.log(`Connected to database at ${DB_FILE}`);
    });
    if (!dbExists) createTables(db);

    return db;
}

// Create tables
function createTables(db) {
    // language=SQLite
    const createPromoTable = `
        CREATE TABLE IF NOT EXISTS promo
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            onMain      BOOLEAN NOT NULL DEFAULT 1,
            priority    INTEGER NOT NULL DEFAULT 0,
            active      BOOLEAN NOT NULL DEFAULT 1,
            description TEXT,
            code        TEXT,
            photo278    TEXT,
            photo585    TEXT,
            photo1200   TEXT
        )
    `;

    db.run(createPromoTable, (err) => {
        if (err) {
            console.error('Error creating promo table', err.message);
        } else {
            console.log('Promo table created successfully');
        }
    });
}
