import {FolderPhoto} from "../../constants.js";
import {makeSitemap} from "./createSitemap.js"
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

function transliterate(text) {
    const converter = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    return text.split('').map(char => {
        // Проверяем регистр, чтобы сохранить его в латинице
        const isUpperCase = char === char.toUpperCase();
        const lowerChar = char.toLowerCase();

        if (converter[lowerChar] !== undefined) {
            const converted = converter[lowerChar];
            return isUpperCase ? converted.charAt(0).toUpperCase() + converted.slice(1) : converted;
        }

        return char; // Оставляем без изменений (например, цифры или знаки)
    }).join('');
}

export async function getAllNewCarsWithPhoto(db) {
    try {
        // language=SQLite
        const allCarsWitnPhoto = await db.all(`
            SELECT id, images, prop_city as sity, prop_year as year, prop_brand as brand, prop_model as model, price, prop_milleage as milleage
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);


        let links_short = [] // список первых фоток из БД (Если его нет, и других значит нет)
        let links_all = {} // список всех фоток для авто
        let links_without_first = [] // все ссылки подряд из базы
        allCarsWitnPhoto.forEach(car => {
            if (car.images && typeof car.images === 'string') {
                let urls = car.images.split(/, /)
                let firstLink = ''

                let forSitemap = car.brand + '-' + car.model + '-' + car.year + '-' + car.sity + '-' + car.price + '-' + car.milleage+'km'
                forSitemap = transliterate(forSitemap)
                forSitemap = forSitemap.replaceAll(" ", "");

                urls.forEach((el, ind) => {
                    if (ind === 0) {
                        firstLink = el
                        links_short.push({firstLink:el, id:car.id, forSitemap})
                    } else {
                        if (!links_all[firstLink]) links_all[firstLink] = [el]
                        else links_all[firstLink].push(el)
                    }

                    let tt = el.split('/').pop()
                    let link = tt.substring(0, tt.lastIndexOf('.'))
                    links_without_first.push(link)
                })
            }
        });

        let existPhotos = await getListExistPhoto()
        let links_short_need = []
        let links_unnecessary =[]

        existPhotos.forEach(el=>{
            if (el.indexOf('_big.webp') !== -1 && !links_without_first.includes(el.slice(0, -9))) links_unnecessary.push(el)
            else if (el.indexOf('_small.webp') !== -1 && !links_without_first.includes(el.slice(0, -11))) links_unnecessary.push(el)
            if (el.indexOf('_big.webp') === -1 && el.indexOf('_small.webp') === -1) links_unnecessary.push(el)
        })

        console.log(' 👻  Фоток в папке', existPhotos.length)
        console.log(' 👻  Ссылок в базе', links_without_first.length)
        console.log(' 👻  Фоток, которых уже нет в базе, но лежат в папке', links_unnecessary.length)

        makeSitemap(links_short)
        
        links_short.forEach(el => {
            let tt = el.firstLink.split('/').pop()
            let link = tt.substring(0, tt.lastIndexOf('.'))
            if (!existPhotos.includes(link + '_small.webp')) {
                links_short_need.push(el.firstLink)
            }
        })

        return {links_short_need, links_all, allCarsWitnPhoto, existPhotoslength:existPhotos.length, links_unnecessary}
    } catch (e) {
        console.log('!!!!!! проблемы обновления фоток ')
        return `⚡. -------- no updated `
    }
}