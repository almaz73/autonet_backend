import fs from 'fs';
import path from 'path';
import {FolderLINKS} from "../../constants.js";


export async function _saveLinks(fileName, data) {
    try {
        if (!fs.existsSync(FolderLINKS)) {
            fs.mkdirSync(FolderLINKS, {recursive: true});
            console.log(`Created directory: ${FolderLINKS}`);
        }

        const filePath = path.join(FolderLINKS, fileName);
        await new Promise((resolve, reject) => {
            fs.writeFile(filePath, JSON.stringify(data), 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing file ${filePath}:`, err);
                    reject(err);
                }
                resolve();
            });
        });
    } catch (error) {
        console.error('Error in saveXmlFilesToPublic:', error.message);
        throw error;
    }
}
