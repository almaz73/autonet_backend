import fs from 'fs';
import path from 'path';
import {FolderForSitemap} from "../../constants.js";
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

export async function makeSitemap(links_short_need_frendly) {
    let urls = ''
    let frendlies = []
    let newLinks = []

    links_short_need_frendly && links_short_need_frendly.forEach(link => {
        frendlies.push(link.forSitemap)
        urls += `<url>
            <loc>https://xn--80aej9aped4f.xn--p1ai/cars/${link.forSitemap}</loc>
            <lastmod>${new Date().toLocaleDateString('en-CA')}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`
        newLinks.push(`https://xn--80aej9aped4f.xn--p1ai/cars/${link.forSitemap}`)
    })

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`

    try {
        await Promise.all([
            saveFileSitemap(sitemap),
            saveLinksInBD(frendlies),
            saveNewLinks(newLinks)
        ]);
    } catch (e) {
        console.error('Error in makeSitemap:', e);
    }
}



async function saveLinksInBD(frendlies) {
    try {
        // Connect to SQLite client
        const db = await open({
            filename: './client.sqlite',
            driver: sqlite3.Database
        });
        
        // Create history table if it doesn't exist
        // language=SQLite
        await db.run(`
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                count INTEGER NOT NULL,
                carsPerDay TEXT NOT NULL
            )
        `);
        
        const count = frendlies.length;
        const carsPerDay = frendlies.join(',');

        // language=SQLite
        const stmt = await db.prepare(`
            INSERT INTO history (date, count, carsPerDay) VALUES (CURRENT_TIMESTAMP, ?, ?)
        `);

        await stmt.run( count, carsPerDay);
        // await db.close();
        
    } catch (error) {
        console.error('Error saving links in client:', error);
        throw error;
    }
}

async function saveFileSitemap(xmlContent) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(FolderForSitemap, 'sitemap2.xml');
        fs.mkdir(FolderForSitemap, {recursive: true}, (err) => {
            if (err) {
                console.error(`Error creating directory ${FolderForSitemap}:`, err);
                reject(err);
            }
            
            fs.writeFile(filePath, xmlContent, (err) => {
                if (err) {
                    console.error(`Error writing sitemap file ${filePath}:`, err);
                    reject(err);
                }
                resolve();
            });
        });
    });
}

async function saveNewLinks(newLinks) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(FolderForSitemap, 'newLinks.txt');
        fs.mkdir(FolderForSitemap, {recursive: true}, (err) => {
            if (err) {
                console.error(`Error creating directory ${FolderForSitemap}:`, err);
                reject(err);
            }
            
            fs.writeFile(filePath, newLinks.join('\n'), (err) => {
                if (err) {
                    console.error(`Error writing newLinks file ${filePath}:`, err);
                    reject(err);
                }
                resolve();
            });
        });
    });
}