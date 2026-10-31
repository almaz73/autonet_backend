import fs from "fs";
import {FolderXML, isLocal, xmlUrls, xmlUrls_forDev} from "../../constants.js";
import path from "path";
import {fileURLToPath} from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const XML_DIR = path.join(__dirname, '../../..', FolderXML)


export async function _copyXml() {
    // создаем папку, если нет
    if (!fs.existsSync(XML_DIR)) fs.mkdirSync(XML_DIR, {recursive: true});

    const savedFiles = [];
    const failed = [];

    let URLS = xmlUrls
    if (isLocal) URLS = xmlUrls_forDev

    for (const xmlUrl of URLS) {
        const urlParts = xmlUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = path.join(XML_DIR, fileName);

        try {
            const response = await axios.get(xmlUrl, {
                timeout: 30000,
                headers: {'User-Agent': 'Mozilla/5.0 (compatible; AutoNetBot/1.0)'},
                responseType: 'text' // Ensure we get the raw text content
            });

            await fs.promises.writeFile(filePath, response.data, 'utf8');
            savedFiles.push(fileName);
        } catch (error) {
            failed.push(`${fileName}: ${error.message}`);
            console.error(`Error saving XML file from ${xmlUrl}:`, error.message);
        }
    }

    // при ошибке на диске остаются файлы прошлого запуска — их использует парсер,
    // но об этом нужно явно сообщить, чтобы отчёт не выглядел успешным
    if (failed.length) throw new Error(`не обновлены ${failed.length} XML (${failed.join('; ')})`);

    return ` Скопированы ${savedFiles.length} XML`;
}
