import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PrepareXMLService {
    constructor() {
        this.xmlUrls = [
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AVTO_NIGNEKAMSK.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_AMK.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Astrahan.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
        ];
    }

    async saveXmlFilesToPublic() {
        try {
            // Create public/xml directory if it doesn't exist
            const xmlDir = path.join(__dirname, '..', '..', 'public', 'xml');
            if (!fs.existsSync(xmlDir)) {
                fs.mkdirSync(xmlDir, { recursive: true });
                console.log(`Created directory: ${xmlDir}`);
            }

            const savedFiles = [];

            for (const xmlUrl of this.xmlUrls) {
                try {
                    console.log(`Fetching XML from: ${xmlUrl}`);

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

                    console.log(`Saved XML file: ${filePath}`);
                    savedFiles.push({
                        url: xmlUrl,
                        filePath: filePath,
                        fileName: fileName
                    });
                } catch (error) {
                    console.error(`Error saving XML file from ${xmlUrl}:`, error.message);
                }
            }


            console.log(`Successfully saved ${savedFiles.length} XML files to public/xml`);



            return this.getXmlFileDates();
        } catch (error) {
            console.error('Error in saveXmlFilesToPublic:', error.message);
            throw error;
        }
    }

    // Method to get the modification dates of XML files in public/xml folder
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
}

export default new PrepareXMLService();
