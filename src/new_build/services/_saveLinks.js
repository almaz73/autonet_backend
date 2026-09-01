import fs from 'fs';
import path from 'path';
import {FolderForSitemap, FolderLINKS} from "../../constants.js";


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

export async function _saveNewLinks(newLinks) {
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
