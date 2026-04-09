import {devMode, FolderPhoto} from "../constants.js";
import PhotoSaver from "../xml_import/CreaterSmallBigPhoto.js";

// Добавляем фотки новых автомобилей

export async function uploadNewPhotos(db, newCars) {
    let count = 0
    try {
        if (devMode && newCars.length>3) newCars.length = 3 // по три штуки добавляем для дев

        for (const car of newCars) {
            if (car.images) {
                let imageArray = [];
                imageArray = car.images.split(',').map(url => url.trim());

                if (devMode) imageArray.length = 3

                let placeInLine = 0
                for (const url of imageArray) {
                    count++
                    placeInLine++

                    await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
                }
            }
        }

        console.log(`Загружено фоток по ${count} ссылкам`)
        return count
    } catch (error) {
        console.error('Error retrieving images from a_car table:', error.message);
        throw error;
    }
}