import path from "path";
import {FolderLINKS, FolderPhoto, isLocal} from "../../constants.js";
import fs from "fs";
import PhotoSaver from "./_сreaterSmallBigPhotoSteps.js";

export async function _addNewPhotos() {
    try {
        const filePath = path.join(FolderLINKS, '_newPhotos.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const newPhotos = [...new Set(JSON.parse(fileContent))]

        if (isLocal && newPhotos.length > 5) newPhotos.length = 5

        let added = 0
        const failed = []

        console.time('🐾 Общее время размещения фоток')
        for (const photo of newPhotos) {
            const result = await PhotoSaver.savePhotoToServer(photo, FolderPhoto);
            if (result === true) added++
            else failed.push(photo)
        }
        console.timeEnd('🐾 Общее время размещения фоток')
        console.log('🐾  загружено новых фоток: ', added, 'из', newPhotos.length)

        if (failed.length) return `${added} из ${newPhotos.length} (ошибок: ${failed.length})`
        return `${added} из ${newPhotos.length}`
    } catch (e) {
        return ' ошибка _addNewPhotos, е' + e
    }
}