import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import axios from 'axios';
import sharp from "sharp";

// Get the current directory name since __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PhotoSaver {

    // deleteFolder(directory) {
    //     return new Promise((resolve, reject) => {
    //         fs.rm(directory, {recursive: true, force: true}, (err) => {
    //             if (err) reject('!!! НЕ ПОЛУЧИЛОСЬ УДАЛИТЬ ПАПКУ ' + err)
    //             else {
    //                 console.log(`Папка с фотками ${directory} успешно удалена`)
    //
    //                 const uploadDir = path.join(__dirname, '../..', directory);
    //                 fs.mkdirSync(uploadDir, {recursive: true});
    //                 console.log(`Папка для фоток ${directory} создана`)
    //                 resolve()
    //             }
    //         });
    //     })
    // }

    async savePhotoToServer(imageUrl, placeInLine, directory) {
        try {
            if (!imageUrl) return {error: 'Image URL is required'};

            const uploadDir = path.join(__dirname, '../..', directory);

            const urlObj = new URL(imageUrl);
            let originalFilename = path.basename(urlObj.pathname);
            const baseName = path.parse(originalFilename).name;

            if (placeInLine < 6) await createSmallPhoto(baseName, uploadDir, imageUrl);
            await createBigPhoto(baseName, uploadDir, imageUrl)

            return 'Скопирована фоткa №' + placeInLine;
        } catch (error) {
            return {error: error.message};
        }
    }
}

async function createSmallPhoto(baseName, uploadDir, imageUrl) {
    const filename = `${baseName + '_small'}.webp`;
    const filePath = path.join(uploadDir, filename);

    const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'arraybuffer' // Get raw image data
    });

    // Process the image using Sharp and convert to WebP
    const processedBuffer = await sharp(response.data)
        .webp({quality: 73})
        .resize(600, 400, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();

    await fs.promises.writeFile(filePath, processedBuffer);
    console.log('::: small')
}

async function createBigPhoto(baseName, uploadDir, imageUrl) {
    const filename = `${baseName + '_big'}.webp`;
    const filePath = path.join(uploadDir, filename);

    const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'arraybuffer'
    });

    const processedBuffer = await sharp(response.data)
        .webp({quality: 90})
        .resize(1200, 800, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();

    await fs.promises.writeFile(filePath, processedBuffer);
    console.log('::: big')
}

export default new PhotoSaver();
