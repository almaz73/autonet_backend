import express from 'express'
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import router from "./src/router.js";
import fileUpload from 'express-fileupload';
import xmlImportService from './src/xmlImportService.js'; // Import the XML import service
import sectionsProcessingService from './src/sectionsProcessingService.js'; // Import the sections processing service

const PORT = 5000;
const DB_PATH = './database.sqlite'; // Local SQLite file

const app = express()

app.use(express.json())
app.use(express.static('static'))
app.use(fileUpload({}))
app.use('/api', router)

// Add an endpoint to trigger XML data import
app.get('/api/import-xml', async (req, res) => {
    try {
        console.log('Starting XML import process...');
        const result = await xmlImportService.importXmlData(global.db);
        res.json({ 
            success: true, 
            message: 'XML data imported successfully', 
            imported: result 
        });
    } catch (error) {
        console.error('Error during XML import:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add endpoint to process sections according to requirements
app.get('/api/process-sections', async (req, res) => {
    try {
        const result = await sectionsProcessingService.processSections(global.db);
        res.json(result);
    } catch (error) {
        console.error('Error processing sections:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add endpoints to get sections and cars
app.get('/api/sections', async (req, res) => {
    try {
        const sections = await global.db.all('SELECT * FROM sections');
        // Parse the JSON data for each section
        const sectionsWithParsedData = sections.map(section => ({
            ...section,
            data: JSON.parse(section.data)
        }));
        res.json(sectionsWithParsedData);
    } catch (error) {
        console.error('Error getting sections:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cars', async (req, res) => {
    try {
        const cars = await global.db.all('SELECT * FROM cars');
        // Parse the JSON data for each car
        const carsWithParsedData = cars.map(car => ({
            ...car,
            data: JSON.parse(car.data)
        }));
        res.json(carsWithParsedData);
    } catch (error) {
        console.error('Error getting cars:', error);
        res.status(500).json({ error: error.message });
    }
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
