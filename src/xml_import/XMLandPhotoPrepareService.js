import PhotoSaver from './CreaterSmallBigPhoto.js'
const folderName = 'public/foto_dev'

class XMLandPhotoPrepareService {
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
}

export default new XMLandPhotoPrepareService();
