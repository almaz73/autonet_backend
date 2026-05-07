import dotenv from 'dotenv';
import express from 'express'
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import router from "./src/router.js"; // Updated path to reflect router.js being inside src
import {fileURLToPath} from 'url';
import path from "path";
import routerAuth from "./src/routerAuth.js";
import routerPromo from "./src/routerPromo.js";
import routerArticles from "./src/routerArticles.js";
import {generationPagesForPromo} from "./src/clientBaza/promo/generationPagesForPromo.js";
import Controllers from "./src/xml_import/Controllers.js";


// Load environment variables from .env file
dotenv.config();

const app = express()

// const HOST = '127.0.0.1'; // Привязка
const PORT = 3000;
const DB_PATH = './database.sqlite'; // Local SQLite file

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '..', 'front');


app.set('view engine', 'ejs');// Установка EJS как движка шаблонов
app.use(express.json())
app.use(express.static(frontendPath)); // 2. Раздаем статику
app.use(express.urlencoded({extended: true}));

app.use('/api/auth', routerAuth)
app.use('/api', router)
app.use('/api', routerPromo)
app.use('/api', routerArticles)

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // console.log('req = ', req.url) // вот тут динамические страницы
    if (req.url.includes('/promo/') && !req.url.includes('/st/')) return generationPagesForPromo(res, req.url)      // отдаем промоакции
    if (!req.url.includes('/pub_auto/')) Controllers.redirectBrand(req.url, res)                                    // открываем страницу cars или бренды

    // Allow requests from the allowed origin
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        // Handle preflight requests
        if (req.method === 'OPTIONS') return res.sendStatus(200)
    }
    return res.status(404).sendFile(path.join(frontendPath, '404.html'));
});

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
            CREATE TABLE IF NOT EXISTS sections
            (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars
            (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
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
