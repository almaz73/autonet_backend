import path from "path";
import {devMode, FolderLINKS, FolderPhoto} from "../constants.js";
import fs from "fs";
import PhotoSaver from "./CreaterSmallBigPhotoSteps.js";

export async function addFirstPhotos() {
    try {
        const filePath = path.join(FolderLINKS, 'links_short_need.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let links_short_need = JSON.parse(fileContent)

        if (devMode) links_short_need.length = 2

        console.time('🐾🐾🐾 Общее время размещения первых фоток')
        for (const photo of links_short_need) {
            await PhotoSaver.savePhotoToServer(photo, 1, FolderPhoto);
        }
        console.timeEnd('🐾🐾🐾 Общее время размещения первых фоток')
        return links_short_need.length
    } catch (e) {

    }
}