import path from "path";
import {devMode, FolderLINKS, FolderPhoto} from "../../constants.js";
import fs from "fs";
import PhotoSaver from "./_сreaterSmallBigPhotoSteps.js";

export async function _addNewPhotos() {
    try {
        const filePath = path.join(FolderLINKS, '_newPhotos.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let newPhotos = JSON.parse(fileContent)

        if (devMode && newPhotos.length > 5) newPhotos.length = 5

        // console.time('🐾 Общее время размещения фоток')
        for (const photo of newPhotos) {
            await PhotoSaver.savePhotoToServer(photo, FolderPhoto);
        }
        // console.timeEnd('🐾 Общее время размещения фоток')
        console.log('🐾  загружено новых фоток: ',newPhotos.length)
        return newPhotos.length
    } catch (e) {

    }
}