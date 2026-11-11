import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {dealers} from '../db.js'
import {FolderDealerPhotos} from '../../constants.js'

const PUBLIC_DIR = '/st/photo/contacts'

// уникальное имя: замена фото не должна отдаваться из кэша браузера
export async function saveDealerPhoto(id, buffer) {
    const dealer = await dealers.findByPk(id)
    if (!dealer) return null

    await fs.promises.mkdir(FolderDealerPhotos, {recursive: true})

    const fileName = `${id}-${Date.now()}.webp`
    const processed = await sharp(buffer)
        .rotate() // учитываем EXIF-поворот
        .resize(1200, 1942, {fit: 'inside', withoutEnlargement: true})
        .webp({quality: 90})
        .toBuffer()

    await fs.promises.writeFile(path.join(FolderDealerPhotos, fileName), processed)

    const url = `${PUBLIC_DIR}/${fileName}`
    await dealer.update({url})
    return url
}
