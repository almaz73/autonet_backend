// src/api/PhotoPrepareService.js
class PhotoPrepareService {
    async getImagesFromACar() {
        const db = global.db;
        try {
            // Query the a_car table to get the images column
            // language=SQLite
            const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');


            const allImageUrls = [];

            let count = 0

            for (const car of cars) {

                if (car.images) {
                    count++
                    // Split the images string by commas to create an array
                    let imageArray = [];

                    imageArray = car.images.split(',').map(url => url.trim());

                    // Add the image URLs to the main array
                    allImageUrls.push(...imageArray);

                    // Log the images for this car
                    console.log('Images for car length:', imageArray.length);

                    if (count === 1) {
                        const firstImageUrl = imageArray[0];
                        await this.savePhotoToServer(firstImageUrl);
                    }
                }
            }

            return allImageUrls;
        } catch (error) {
            console.error('Error retrieving images from a_car table:', error.message);
            throw error;
        }
    }
}

export default new PhotoPrepareService();
