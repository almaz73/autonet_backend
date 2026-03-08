import PostController from '../posts/PostController.js'
import PhotoSaver from '../photo_normalizer/PhotoSaver.js'

class PhotoPrepareService {
    async getImagesFromACar() {
        const db = global.db;
        let count = 0
        try {
            // Query the a_car table to get the images column
            // language=SQLite
            const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');

            const allImageUrls = [];

            for (const car of cars) {
                if (car.images) {
                    let imageArray = [];
                    imageArray = car.images.split(',').map(url => url.trim());

                    console.log('?? imageArray', imageArray)

                    imageArray.forEach(url => {
                        count++
                        console.log('?? url', url)
                        let zz = PhotoSaver.savePhotoToServer(url);

                        console.log('?? zz', zz)
                    })

                }
            }

            console.log('!!!! Total images processed:', count)
            // return allImageUrls;
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }
}

export default new PhotoPrepareService();
