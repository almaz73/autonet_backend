import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import axios from 'axios';

// Get the current directory name since __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PhotoSaver {
    async savePhotoToServer(imageUrl) {
        try {
            let folderName = 'photos'
            if (!imageUrl) return {error: 'Image URL is required'};

            // Create the target folder if it doesn't exist
            const uploadDir = path.join(__dirname, '../..', folderName);

            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});


            // Extract filename from URL or generate a unique name
            const urlObj = new URL(imageUrl);
            const filename = path.basename(urlObj.pathname) || `photo_${Date.now()}.jpg`;
            const filePath = path.join(uploadDir, filename);

            console.log('>> filename', filename)
            // console.log('>> filePath', filePath)

            // Download the image
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream'
            });

            console.log('>> response status', response.status)

            // Save the image to the server
            const writer = fs.createWriteStream(filePath);


            response.data.pipe(writer);

            // Wait for the stream to finish
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            return({
                success: true,
                message: 'Photo saved successfully',
                filename: filename,
                path: filePath
            });
        } catch (error) {
            console.error('Error saving photo to server:', error.message);
            return({
                success: false,
                message: error.message,
            });
        }
    }
}

export default new PhotoSaver();
