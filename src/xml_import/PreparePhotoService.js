import PhotoSaver from './CreaterSmallBigPhoto.js'
import path from "path";
import fs from "fs";
import {fileURLToPath} from 'url'; // Add this import to define __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderName = 'public/foto'

class PreparePhotoService {
    async savePhotos() {
        const db = global.db;
        let count = 0
        try {
            // Query the a_car table to get the images column
            // language=SQLite
            const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');

            console.time('!!!!!!! Общее время создания фоток')
            for (const car of cars) {
                if (car.images) {
                    let imageArray = [];
                    imageArray = car.images.split(',').map(url => url.trim());

                    let placeInLine = 0
                    for (const url of imageArray) {
                        count++
                        placeInLine++
                        let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, folderName);
                        console.log(':::', zz, '(',count,')');
                    }

                    // if (count > 10) break;

                    // count++
                    // await PhotoSaver.savePhotoToServer(imageArray[0], 1);
                }
            }

            console.timeEnd('!!!!!!! Общее время создания фоток')
            console.log('!!!!!!! Общее количество созданных фоток:', count)
            // return allImageUrls;
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }

    async addNewPhoto(url, placeInLine){
        console.log(url)
        let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, folderName);
        console.log('  ⚡ :::', zz);
    }

    async deleteFileByName(filename, directory = folderName) {
        try {
            if (!filename) return {error: 'Filename is required'};

            const uploadDir = path.join(__dirname, '../..', directory);
            const filePath = path.join(uploadDir, filename);

            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                console.log(`  ⚡ File ${filename} удален`)
                return {success: true, message: `File ${filename} deleted successfully from ${directory}`};
            } else {
                console.log(`  ⚡ File ${filename} не существует`)
            }
        } catch (error) {
            console.log('Error deleting file:', error.message)
            return {error: error.message};
        }
    }
}

export default new PreparePhotoService();
