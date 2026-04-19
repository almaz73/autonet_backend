import express from 'express'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import router from "./src/router.js"; // Updated path to reflect router.js being inside src
import routerPromo  from "./src/routerPromo.js";
import routerAuth  from "./src/routerAuth.js";

// const HOST = '127.0.0.1'; // Привязка
const PORT = 3000;
const DB_PATH = './database.sqlite'; // Local SQLite file

const app = express()

app.use(express.json())
app.use(express.static('static'))
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const allowedOrigin = 'http://localhost:9173';
    const origin = req.headers.origin;
    
    // Allow requests from the allowed origin
    if (origin && origin === allowedOrigin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
    }
    
    next();
});

app.use('/api/auth', routerAuth)
app.use('/api', router)
app.use('/api', routerPromo)


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
