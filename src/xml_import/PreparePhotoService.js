import PhotoSaver from './CreaterSmallBigPhoto.js'
import path from "path";
import fs from "fs";
import {fileURLToPath} from 'url';
import PrepareXMLService from "./PrepareXMLService.js";
import A_car from "../API/A_car.js";
import {devMode, FolderPhoto} from "../constants.js"; // Add this import to define __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PreparePhotoService {

    async getCountUplFilews() {
        const ListExistPhoto = await PrepareXMLService.getListExistPhoto()
        let count = 0
        try {
            let linksBD = await A_car.getAllImageLinksFromBD()

            if (linksBD) {
                for (const url of linksBD) {
                    const tt =  url.split('/').pop()
                    const fileName = tt.substring(0, tt.lastIndexOf('.'))
                    if (!ListExistPhoto.find(el => el === fileName)) count++
                }
                console.log('🐾🐾🐾 Теперь в базе ссылок:', linksBD.length)
                console.log('🐾🐾🐾 В папках уже есть фотки по этим ссылкам:', linksBD.length - count)
                console.log('🐾🐾🐾 Осталось обработать:', count)

            }
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }

    async uploadAllPhotos() {
        await this.getCountUplFilews()
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


                    if (devMode) imageArray.length = 2

                    let placeInLine = 0
                    for (const url of imageArray) {
                        count++
                        placeInLine++
                        const urlParts = url.split('/');
                        let fileName = urlParts[urlParts.length - 1];
                        fileName = fileName.substring(0, fileName.lastIndexOf('.'));

                        let exist = ListExistPhoto.find(el => el === fileName)
                        if (exist) continue

                        addCount++

                        let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
                        console.log(zz, '(', addCount, ')');
                    }
                }
            }

            console.timeEnd('🐾🐾🐾 Общее время оптимизации/копирования фоток')

            await this.unnecessaryPhoto() // удаляем ненужные фотки

            return 'Все. Готово'
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }

    async addNewPhoto(url, placeInLine) {
        let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
        console.log('  ⚡ :::', zz);
    }

    async deleteFileByName(filename) {
        try {
            if (!filename) return {error: 'Filename is required'};

            const uploadDir = path.join(__dirname, '../..', FolderPhoto);
            const filePath = path.join(uploadDir, filename)

            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                console.log(`       👻  ${filename} - удален`)
            } else {
                console.log(`👻 👻 👻  File ${filename} не существует`)
            }
        } catch (error) {
            console.log('Error deleting file:', error.message)
            return {error: error.message};
        }
    }

    async prepareUnnecesaryPhotoForDelete(deprecatedPhoto) {

        try {

            // Check if directory exists
            if (!fs.existsSync(FolderPhoto)) {
                console.log(`Directory does not exist: ${FolderPhoto}`);
                return [];
            }

            const currentTime = new Date();
            const hoar = 24 * 2//24*3; // часы отсечения
            const timeAgo = new Date(currentTime.getTime() - 60 * 60 * 1000 * hoar); // hoar часов назад

            const recentFiles = [];

            for (const file of deprecatedPhoto) {

                // if (recentFiles.length >= 5)
                //     break; // берем только первые несколько файлов

                ['_small', '_big'].forEach( type=>{
                    const filePath = path.join(FolderPhoto, file+type+'.webp');

                    try {
                        const stats = fs.statSync(filePath);

                        if (stats.birthtime < timeAgo) { // старше
                            recentFiles.push(file+type+'.webp');
                        }

                    } catch (error) {
                        // console.error(`Error getting stats for file ${filePath}:`, error.message);
                    }
                })

            }

            console.log(` 👻 👻 👻 Эти файлы устарели ${hoar} часа(ов) - итого на удаление `, recentFiles.length);
            console.log(` 👻 👻 👻 Все! `);

            if(recentFiles) {
                for (const filename of recentFiles) {
                    await this.deleteFileByName(filename, FolderPhoto)
                }
            }

            return recentFiles;
        } catch (error) {
            console.error('Error in getOldPhotoToDelete:', error.message);
            throw error;
        }
    }

    // лишние фотки в папке, которых уже нет в базе
    async unnecessaryPhoto() {
        try {

            // беру список файлов из папки
            let linksFolder = await PrepareXMLService.getListExistPhoto()
            console.log(' 👻 👻 👻 Фоток в папке', linksFolder.length)
            // беру список файлов из базы
            let listBD = await A_car.getAllImageLinksFromBD()
            console.log(' 👻 👻 👻 Ссылок в базе', listBD.length)

            listBD = listBD.map(el => {
                const tt =  el.split('/').pop()
                return tt.substring(0, tt.lastIndexOf('.'))
            })
            const deprecatedPhoto = linksFolder.filter(link => !listBD.includes(link));

            console.log(' 👻 👻 👻 Фоток, которых уже нет в базе, но лежат в папке', deprecatedPhoto.length)


            await this.prepareUnnecesaryPhotoForDelete(deprecatedPhoto)

            return ' 👻 👻 👻 Удаление произошло '
        } catch (error) {
            console.error('Error in getOldPhotoToDelete:', error.message);
            throw error;
        }
    }
}

export default new PreparePhotoService();
