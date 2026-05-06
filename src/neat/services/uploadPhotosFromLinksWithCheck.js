import {devMode, FolderPhoto} from "../../constants.js";
import fs from "fs";
import PhotoSaver from "./CreaterSmallBigPhotoSteps.js"
import path from "path";
import {fileURLToPath} from 'url';

// Get the current directory name since __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// async function deleteFileByName(filename) {
//     try {
//         if (!filename) return {error: 'Filename is required'};
//
//         const uploadDir = path.join(__dirname, '../..', FolderPhoto);
//         const filePath = path.join(uploadDir, filename)
//
//         if (fs.existsSync(filePath)) {
//             await fs.promises.unlink(filePath);
//             console.log(`       👻  ${filename} - удален`)
//         }
//     } catch (error) {
//         console.log('Error deleting file:', error.message)
//         return {error: error.message};
//     }
// }

// async function deleteOldPhotos(links_for_delete, existPhotos) {
//     try {
//         let forDelete = JSON.parse(JSON.stringify(existPhotos))
//
//         existPhotos.forEach(el => {
//             if (el.indexOf('_big.webp') !== -1 && links_for_delete.includes(el.slice(0, -9))) forDelete = forDelete.filter(item => item !== el)
//             else if (el.indexOf('_small.webp') !== -1 && links_for_delete.includes(el.slice(0, -11))) forDelete = forDelete.filter(item => item !== el)
//         })
//
//         for (let link of forDelete) {
//             await deleteFileByName(link)
//         }
//         return forDelete.length
//     } catch (e) {
//         return []
//     }
// }

async function getListExistPhoto() { // список фоток в папке сервера
    try {
        const fotoDir = FolderPhoto

        if (!fs.existsSync(fotoDir)) {
            console.log(`Directory does not exist: ${fotoDir}`);
            return [];
        }

        return fs.readdirSync(fotoDir);
    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}

async function addNonExistentPhoto(links_short_need, links_all) {
    try {
        if (devMode) links_short_need.length = 2
        console.time('🐾🐾🐾 Общее время размещения фоток')
        let count = 0
        for (const photo of links_short_need) {
            await PhotoSaver.savePhotoToServer(photo, 1, FolderPhoto);
            count += 2
            let placeInLine = 0
            for (const url of links_all[photo]) {
                placeInLine++
                count++
                const urlParts = url.split('/');
                let fileName = urlParts[urlParts.length - 1];
                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
                await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
                if (placeInLine < 6) count++
            }
            console.log('>>> count = ', count)
        }
        console.timeEnd('🐾🐾🐾 Общее время размещения фоток')
        return count
    } catch (error) {
        console.error('Ошибка при добавлении фоток:', error);
        throw error;
    }
}



export async function uploadPhotosFromLinksWithCheck(db) {
    try {
        // для каждой машины берем только первую фотку, и проверяем, есть ли в папке Фотки, если нет, добавляем и все остальные

        // получаем список всех машин с фотками
        // language=SQLite
        const allCarsWitnPhoto = await db.all(`
            SELECT id, images
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);


        console.log('____ allCarsWitnPhoto = ',allCarsWitnPhoto)

        let links_short = [] // список первых фоток из БД (Если его нет, и других значит нет)
        let links_all = {} // список всех фоток для авто
        let links_for_delete = [] // список всех фоток для авто
        allCarsWitnPhoto.forEach(car => {
            if (car.images && typeof car.images === 'string') {
                let urls = car.images.split(/, /)
                let firstLink = ''
                urls.forEach((el, ind) => {
                    if (ind === 0) {
                        firstLink = el
                        links_short.push(firstLink)
                    } else {
                        if (!links_all[firstLink]) links_all[firstLink] = [el]
                        else links_all[firstLink].push(el)
                    }

                    let tt = el.split('/').pop()
                    let link = tt.substring(0, tt.lastIndexOf('.'))
                    links_for_delete.push(link)
                })
            }
        });

        let existPhotos = await getListExistPhoto()

        console.log(`\n\n⚡⚡⚡⚡⚡ В папке всего ${existPhotos.length} фоток ⚡⚡⚡⚡⚡ ( обработка ...)`)


        let links_short_need = []


        links_short.forEach(el => {
            let tt = el.split('/').pop()
            let link = tt.substring(0, tt.lastIndexOf('.'))
            if (!existPhotos.includes(link + '_small.webp')) links_short_need.push(el)
        })


        let count = await addNonExistentPhoto(links_short_need, links_all) // списки машин без первых фоток, нужно фотки скачать в папку
        console.log('>>> >>> added cars count = ',count)

        // let deletedCount = await deleteOldPhotos(links_for_delete, existPhotos) // Удаляем фотки, которых нет в новой базе // todo если фоток уже нет, падает
        // return `⚡. New_cars:${links_short_need.length} Added_photos:${count} Removed:${deletedCount}`
        return `⚡. New_cars:${links_short_need.length} Added_photos:${count}`
    } catch (e) {
        console.log('!!!!!! проблемы обновления фоток ')
        return `⚡. -------- no updated `
    }
}

