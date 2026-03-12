import PhotoSaver from './CreaterSmallBigPhoto.js'
import path from "path";
import fs from "fs";
import {fileURLToPath} from 'url';
import PrepareXMLService from "./PrepareXMLService.js";
import A_car from "../API/A_car.js"; // Add this import to define __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderName = 'public/foto'

class PreparePhotoService {
    async uploadAllPhotos() {
        const ListExistPhoto = await PrepareXMLService.getListExistPhoto()
        const db = global.db;
        let count = 0
        let addCount = 0
        try {
            // Query the a_car table to get the images column
            // language=SQLite
            const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');

            console.time('🐾🐾🐾 Общее время оптимизации/копирования фоток')
            for (const car of cars) {
                if (car.images) {
                    let imageArray = [];
                    imageArray = car.images.split(',').map(url => url.trim());


                    let placeInLine = 0
                    for (const url of imageArray) {

                        count++
                        placeInLine++


                        const urlParts = url.split('/');
                        let fileName = urlParts[urlParts.length - 1];
                        fileName = fileName.substring(0, fileName.lastIndexOf('.'));

                        let exist = ListExistPhoto.find(el => el === fileName)
                        if (exist) continue

                        // нужно перепрыгивать если файл уже существует


                        addCount++

                        if (addCount > 5) { // ТОДО временно ограничиваю на время разработки
                            break
                        } // не более за раз

                        let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, folderName);
                        console.log( zz, '(', count, ')');
                    }
                }
            }

            console.timeEnd('🐾🐾🐾 Общее время оптимизации/копирования фоток')
            console.log('🐾🐾🐾 Было в системе ссылок с созданными файлами до этого:', ListExistPhoto.length, ' (Около для ' + parseInt(ListExistPhoto.length / 10) + ' АВТО)')
            console.log('🐾🐾🐾 Всего сейчас добавлено:', addCount)
            console.log('🐾🐾🐾 Общее количество АВТО требующих создания фоток (там по 20):', await A_car.getImageLinksCount(true))
            // return allImageUrls;
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }

    async addNewPhoto(url, placeInLine) {
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
