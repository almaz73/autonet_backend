import {FolderPhoto} from "../constants.js";
import fs from "fs";

async function getListExistPhoto() { // список фоток в папке сервера
    try {
        const fotoDir = FolderPhoto

        if (!fs.existsSync(fotoDir)) {
            console.log(`Directory does not exist: ${fotoDir}`);
            return [];
        }

        return fs.readdirSync(fotoDir); // все фотки из папки
    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}

export async function getAllNewCarsWithPhoto(db) {
    try {
        // language=SQLite
        const allCarsWitnPhoto = await db.all(`
            SELECT id, images
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);


        let links_short = [] // список первых фоток из БД (Если его нет, и других значит нет)
        let links_all = {} // список всех фоток для авто
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

        

        // console.log('? links_short.length = ',links_short.length)


        // let count = await addNonExistentPhoto(links_short_need, links_all) // списки машин без первых фоток, нужно фотки скачать в папку

        // return `⚡. New_cars:${links_short_need.length} Added_photos:${count} Removed:${deletedCount}`

        return {links_short_need, links_all, allCarsWitnPhoto, existPhotoslength:existPhotos.length}
    } catch (e) {
        console.log('!!!!!! проблемы обновления фоток ')
        return `⚡. -------- no updated `
    }
}