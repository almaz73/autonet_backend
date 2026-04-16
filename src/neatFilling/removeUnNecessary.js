import path from "path";
import {devMode, FolderLINKS, FolderPhoto} from "../constants.js";
import fs from "fs";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../..', FolderPhoto);


async function deleteFileByName(filename) {
    try {
        if (!filename) return {error: 'Filename is required'};
        const filePath = path.join(uploadDir, filename)
        await fs.promises.unlink(filePath);
        console.log(`       👻  ${filename} - удален`)
    } catch (error) {
        console.log('Error deleting file:', error.message)
        return {error: error.message};
    }
}

export async function removeUnNecessary() {
    try {
        const filePath = path.join(FolderLINKS, 'links_unnecessary.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let links_short_need = JSON.parse(fileContent)

        if (devMode) links_short_need.length = 2

        let count = 0
        for (const photo of links_short_need) {
            await deleteFileByName(photo);
            count++
        }
        return count
    } catch (e) {

    }
}