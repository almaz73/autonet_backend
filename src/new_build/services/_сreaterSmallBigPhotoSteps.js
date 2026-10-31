import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import axios from 'axios';
import sharp from "sharp";

// Get the current directory name since __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CreaterSmallBigPhoto {

    async savePhotoToServer(imageUrl, directory) {
        // imageUrl - Это прежняя ссылка из XML
        try {
            if (!imageUrl) return {error: 'Image URL is required'};

            const uploadDir = path.join(__dirname, '../../..', directory);

            const urlObj = new URL(imageUrl);
            let originalFilename = path.basename(urlObj.pathname);
            const baseName = path.parse(originalFilename).name;
            if (!baseName) return {error: 'Не удалось определить имя файла ' + imageUrl};
            console.log(' ⚡ добавим фотки для = ', baseName)

            // один запрос на фотографию: оригинал нужен и для small, и для big
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'arraybuffer',
                timeout: 60000
            });

            await createSmallPhoto(baseName, uploadDir, response.data);
            await createBigPhoto(baseName, uploadDir, response.data)
            return true
        } catch (error) {
            console.log('savePhotoToServer: не удалось сохранить', imageUrl, error.message)
            return {error: error.message};
        }
    }
}

async function createSmallPhoto(baseName, uploadDir, imageBuffer) {
    const filename = `${baseName + '_small'}.webp`;
    const filePath = path.join(uploadDir, filename);

    // Process the image using Sharp and convert to WebP
    const processedBuffer = await sharp(imageBuffer)
        .webp({quality: 73})
        .resize(600, 400, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();

    await fs.promises.writeFile(filePath, processedBuffer);
    // console.log('  ⚡ small')
}

async function createBigPhoto(baseName, uploadDir, imageBuffer) {
    const filename = `${baseName + '_big'}.webp`;
    const filePath = path.join(uploadDir, filename);

    const processedBuffer = await sharp(imageBuffer)
        .webp({quality: 90})
        .resize(1200, 800, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);
    // console.log('  ⚡ big')
}

export default new CreaterSmallBigPhoto();
