import PrepareXMLService from "../xml_import/PrepareXMLService.js";
import {devMode, FolderPhoto} from "../constants.js";
import PhotoSaver from "../xml_import/CreaterSmallBigPhoto.js";


// лишние фотки в папке, которых уже нет в базе

export async function uploadPhotos(db) {
    const ListExistPhoto = await PrepareXMLService.getListExistPhoto()
    let count = 0
    let addCount = 0
    try {
        // Query the a_car table to get the images column
        // language=SQLite
        const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');

        if(devMode) cars.length = 3

        for (const car of cars) {
            if (car.images) {
                let imageArray = [];
                imageArray = car.images.split(',').map(url => url.trim());


                if (devMode) imageArray.length = 3

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

                    await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
                }
            }
        }

        console.log( `Загружено фоток по ${addCount} ссылкам`)
        return addCount
    } catch (error) {
        console.error('Error retrieving images from a_car table:', error.message);
        throw error;
    }
}