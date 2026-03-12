import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

// Resolve __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PrepareXMLService {
    constructor() {
        this.xmlUrls = [
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/AVTO_NIGNEKAMSK.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_AMK.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Astrahan.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
        ];

        this.xmlUrlsFromPublic = [];
        this.loadXmlUrlsFromPublic();
    }

    loadXmlUrlsFromPublic() {
        try {
            const xmlDir = path.join(__dirname, '..', '..', 'public', 'xml');
            if (fs.existsSync(xmlDir)) {
                const files = fs.readdirSync(xmlDir);
                files.forEach(file => {
                    if (path.extname(file).toLowerCase() === '.xml') {
                        this.xmlUrlsFromPublic.push(path.join(xmlDir, file));
                    }
                });
            }
        } catch (error) {
            console.error('Error loading XML URLs from public folder:', error.message);
        }
    }

    async getXMLContent(xmlName) {
        console.log('      Заполняем базу из', xmlName)
        const xmlFolderPath = path.join(process.cwd(), 'public', 'xml');
        let xmlData = '';
        const filePath = path.join(xmlFolderPath, xmlName);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        xmlData += fileContent; // Combine all XML files content
        return xmlData;
    }

    async saveXmlFilesToPublic() {
        try {
            // Create public/xml directory if it doesn't exist
            const xmlDir = path.join(__dirname, '..', '..', 'public', 'xml');
            if (!fs.existsSync(xmlDir)) {
                fs.mkdirSync(xmlDir, {recursive: true});
                console.log(`Created directory: ${xmlDir}`);
            }

            const savedFiles = [];

            for (const xmlUrl of this.xmlUrls) {
                try {
                    // Extract filename from URL
                    const urlParts = xmlUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    const filePath = path.join(xmlDir, fileName);

                    // Fetch the XML data from the URL
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


            console.log(`⚡ Удачно сохранены ${savedFiles.length} XML файла из интернета в серверную папку`);
            return `⚡ Удачно сохранены ${savedFiles.length} XML файла из интернета в серверную папку` ;
        } catch (error) {
            console.error('Error in saveXmlFilesToPublic:', error.message);
            throw error;
        }
    }

    // deprecated Method to get the modification dates of XML files in public/xml folder
    async getXmlFileDates() {
        console.log('getXmlFileDates ...........')
        try {
            const xmlDir = path.join(__dirname, '..', '..', 'public', 'xml');

            // Check if directory exists
            if (!fs.existsSync(xmlDir)) {
                console.log(`Directory does not exist: ${xmlDir}`);
                return [];
            }

            // Read all files in the directory
            const files = fs.readdirSync(xmlDir);

            const xmlFilesWithDates = [];

            for (const file of files) {
                // Only process XML files
                if (path.extname(file).toLowerCase() === '.xml') {
                    const filePath = path.join(xmlDir, file);

                    try {
                        const stats = fs.statSync(filePath);

                        xmlFilesWithDates.push({
                            fileName: file,
                            modifiedDate: stats.mtime, // Last modification time
                            createdDate: stats.birthtime, // Creation time
                        });
                    } catch (error) {
                        console.error(`Error getting stats for file ${filePath}:`, error.message);
                    }
                }
            }

            console.log('xmlFilesWithDates', xmlFilesWithDates)

            return xmlFilesWithDates;
        } catch (error) {
            console.error('Error in getXmlFileDates:', error.message);
            throw error;
        }
    }


    async getOldPhotoToDelete() {
        try {
            const fotoDir = path.join(__dirname, '..', '..', 'public', 'foto');

            // Check if directory exists
            if (!fs.existsSync(fotoDir)) {
                console.log(`Directory does not exist: ${fotoDir}`);
                return [];
            }

            const files = fs.readdirSync(fotoDir);
            const currentTime = new Date();
            const hoar = 24*10//24*3; // часы отсечения
            const timeAgo = new Date(currentTime.getTime() - 60 * 60 * 1000 * hoar); // hoar часов назад

            const recentFiles = [];

            for (const file of files) {
                if (recentFiles.length >= 5) break; // берем только первые несколько файлов

                const filePath = path.join(fotoDir, file);

                try {
                    const stats = fs.statSync(filePath);

                    if (stats.birthtime < timeAgo) { // старше
                        recentFiles.push(file + ' : ' + stats.birthtime.toLocaleDateString('ru-RU'));
                    }
                } catch (error) {
                    console.error(`Error getting stats for file ${filePath}:`, error.message);
                }
            }

            console.log(`⚡ ⚡ ⚡ список файлов созданных давно (${hoar} часа(ов) назад)`, recentFiles);
            return recentFiles;
        } catch (error) {
            console.error('Error in getOldPhotoToDelete:', error.message);
            throw error;
        }
    }

    async getListExistPhoto() {
        try {
            const fotoDir = path.join(__dirname, '..', '..', 'public', 'foto');

            // Check if directory exists
            if (!fs.existsSync(fotoDir)) {
                console.log(`Directory does not exist: ${fotoDir}`);
                return [];
            }

            const files = fs.readdirSync(fotoDir);
            let links = {}

            files.forEach(el => {
                el = el.replace('_big.webp', '')
                el = el.replace('_small.webp', '')
                links[el] = 1
            })

            return Object.keys(links);
        } catch (error) {
            console.error('Error in getOldPhotoToDelete:', error.message);
            throw error;
        }
    }


}

export default new PrepareXMLService();
