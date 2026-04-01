import fs from "fs";
import {devMode, FolderXML, xmlUrls} from "../constants.js";
import path from "path";
import axios from "axios";


export async function copyXmlToFolder() {


    try {
        // создаем папку, если нет
        if (!fs.existsSync(FolderXML)) fs.mkdirSync(FolderXML, {recursive: true});

        const savedFiles = [];

        let URLS = xmlUrls

        // if (devMode) URLS = ['https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml','https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml']
        if (devMode) URLS = ['https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml']
        for (const xmlUrl of URLS) {
            try {
                const urlParts = xmlUrl.split('/');
                const fileName = urlParts[urlParts.length - 1];
                const filePath = path.join(FolderXML, fileName);

                const response = await axios.get(xmlUrl, {
                    timeout: 30000, // 30 seconds timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; AutoNetBot/1.0)'
                    },
                    responseType: 'text' // Ensure we get the raw text content
                });

                // Write the XML content to the file
                fs.writeFileSync(filePath, response.data, 'utf8');

                savedFiles.push({
                    url: xmlUrl,
                    filePath: filePath,
                    fileName: fileName
                });
            } catch (error) {
                console.error(`Error saving XML file from ${xmlUrl}:`, error.message);
            }
        }

        return `⚡ Удачно. Скопирован ${savedFiles.length} XML в папку`;
    } catch (error) {
        return 'Ошибка копирования XML: ' + error.message;
    }

}