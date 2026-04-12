import fs from "fs";
import {FolderPhoto} from "../constants.js";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getListExistPhoto() {
    try {
        const fotoDir = FolderPhoto

        if (!fs.existsSync(fotoDir)) {
            console.log(`Directory does not exist: ${fotoDir}`);
            return [];
        }

        const files = fs.readdirSync(fotoDir);
        let links = {}

        files.forEach(el=>{
            if(el.indexOf('_big.webp')!==-1) links[el.slice(0,-9)]=1
            else if(el.indexOf('_small.webp')!==-1) links[el.slice(0,-11)]=1
            else links[el.substring(0, el.lastIndexOf('.'))] = 1
        })

        return Object.keys(links);
    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}

async function deleteFileByName(filename) {
    try {
        if (!filename) return {error: 'Filename is required'};

        const uploadDir = path.join(__dirname, '../..', FolderPhoto);
        const filePath = path.join(uploadDir, filename)

        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`       👻  ${filename} - удален`)
        } else {
            // console.log(`👻 👻 👻  File ${filename} не существует`)
        }
    } catch (error) {
        console.log('Error deleting file:', error.message)
        return {error: error.message};
    }
}

async function prepareUnnecesaryPhotoForDelete(deprecatedPhoto) {

    try {
        // Check if directory exists
        if (!fs.existsSync(FolderPhoto)) {
            console.log(`Directory does not exist: ${FolderPhoto}`);
            return [];
        }

        const recentFiles = [];

        for (const file of deprecatedPhoto) {

            ['_small', '_big', ''].forEach( type=>recentFiles.push(file+type+'.webp'))
        }

        // console.log(` 👻 👻 👻 Эти файлы на удаление `, recentFiles.length);
        // console.log(` 👻 👻 👻 Все! `);

        if (recentFiles) {
            for (const filename of recentFiles) {
                await deleteFileByName(filename, FolderPhoto)
            }
        }
        return recentFiles + ' файлов удалено';

    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}

async function getAllImageLinksFromBD(db) {
    try {
        // language=SQLite
        const results = await db.all(`
                SELECT images
                FROM a_car
                WHERE images IS NOT NULL
                  AND images != ''
            `);

        let links = []

        results.forEach(row => {
            if (row.images && typeof row.images === 'string') links.push(...row.images.split(/, /));
        });

        return links;
    } catch (error) {
        console.error('Error counting image links in a_car table:', error.message);
        throw error;
    }
}

export async function clearDeprecatedPhotos(db) {
    try {

        // беру список файлов из папки
        let unicalPhotName = await getListExistPhoto()

        console.log(' 👻 🎁 👻 Фоток в папке', unicalPhotName.length)
        // беру список файлов из базы
        let listBD = await getAllImageLinksFromBD(db)
        console.log(' 👻 🚇 👻 Ссылок в базе', listBD.length)

        listBD = listBD.map(el => {
            const tt = el.split('/').pop()
            return tt.substring(0, tt.lastIndexOf('.'))
        })

        const deprecatedPhoto = unicalPhotName.filter(link => !listBD.includes(link));

        console.log(' 👻 👻 👻 Фоток, которых уже нет в базе, но лежат в папке', deprecatedPhoto.length)


        await prepareUnnecesaryPhotoForDelete(deprecatedPhoto)

        // return ' 👻 👻 👻 Удаление произошло '
        return deprecatedPhoto.length

    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}