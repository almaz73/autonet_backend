import express from 'express'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import router from './src/router.js';
import fileUpload from 'express-fileupload';

const PORT = 5000;
const DB_PATH = './database.sqlite'; // Local SQLite file

const app = express()

app.use(express.json())
app.use(express.static('static'))
app.use(fileUpload({}))
app.use('/api', router)


async function startApp() {
    try {
        // Open SQLite database
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Create sections and cars tables if they don't exist
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // Make db available globally or pass to controllers
        global.db = db;

        app.listen(PORT, () => console.log('SERVER STARTED ON PORT ' + PORT))
    } catch (e) {
        console.log(e)
    }
}

startApp()
