import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {news} from '../db.js'
import {FolderNewsPhotos} from '../../constants.js'

const PUBLIC_DIR = '/st/photo/news'

// уникальное имя: после замены фото браузер не должен отдавать старую картинку из кэша
export async function saveNewsPhoto(id, buffer) {
    const item = await news.findByPk(id)
    if (!item) return null

    await fs.promises.mkdir(FolderNewsPhotos, {recursive: true})

    const fileName = `news-${id}-${Date.now()}.webp`
    const processed = await sharp(buffer)
        .rotate() // учитываем EXIF-поворот
        .resize(1600, 900, {fit: 'cover', withoutEnlargement: true})
        .webp({quality: 88})
        .toBuffer()

    await fs.promises.writeFile(path.join(FolderNewsPhotos, fileName), processed)

    const previous = item.image
    const url = `${PUBLIC_DIR}/${fileName}`
    await item.update({image: url})

    // удаляем только ранее загруженные через админку файлы; исходные a1.webp не трогаем
    await removeNewsPhoto(previous)

    return url
}

// удаляет сгенерированное фото статьи; внешние ссылки и исходные картинки остаются
export async function removeNewsPhoto(image) {
    if (!image || !image.startsWith(`${PUBLIC_DIR}/news-`)) return

    const filePath = path.join(FolderNewsPhotos, path.basename(image))
    await fs.promises.unlink(filePath).catch(() => {})
}
