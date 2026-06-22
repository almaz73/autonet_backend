import fs from 'fs';
import path from 'path';
import {FolderForSitemap} from "../../constants.js";

export function makeSitemap(links_short) {
    let urls = ''

    links_short && links_short.forEach(link => {
        urls += `<url>
            <loc>https://xn--80aej9aped4f.xn--p1ai/cars/car.html?${link.forSitemap}&id=${link.id}</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
        </url>`
    })

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`

    try {
        saveFileSitemap(sitemap)
    } catch (e) {
    }
}

function saveFileSitemap(xmlContent) {
    const filePath = path.join(FolderForSitemap, 'sitemap2.xml');
    fs.mkdirSync(FolderForSitemap, {recursive: true});
    fs.writeFileSync(filePath, xmlContent);
}