import fs from 'fs';
import path from 'path';
import {FolderLINKS} from "../../constants.js";


export async function saveLinks(fileName, data) {
    try {
        if (!fs.existsSync(FolderLINKS)) {
            fs.mkdirSync(FolderLINKS, {recursive: true});
            console.log(`Created directory: ${FolderLINKS}`);
        }

        const filePath = path.join(FolderLINKS, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    } catch (error) {
        console.error('Error in saveXmlFilesToPublic:', error.message);
        throw error;
    }
}
