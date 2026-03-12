import express from 'express'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import router from "./src/router.js"; // Updated path to reflect router.js being inside src
import fileUpload from 'express-fileupload';


const HOST = '127.0.0.1'; // Привязка
const PORT = 3000;
const DB_PATH = './database.sqlite'; // Local SQLite file

const app = express()

app.use(express.json())
app.use(express.static('static'))
app.use(fileUpload({}))
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
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

        app.listen(PORT, HOST,() => console.log('SERVER STARTED ON PORT ' + PORT))
    } catch (e) {
        console.log(e)
    }
}

startApp()
