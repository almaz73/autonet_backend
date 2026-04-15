import path from "path";
import {devMode, FolderLINKS, FolderPhoto, FolderXML} from "../constants.js";
import axios from "axios";
import fs from "fs";
import PhotoSaver from "./CreaterSmallBigPhotoSteps.js";

export async function addAllPhotos() {
    try {
        const filePath = path.join(FolderLINKS, 'links_short_need.js');
        const links_short_need = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        const filePath2 = path.join(FolderLINKS, 'links_all.js');
        const links_all = JSON.parse( fs.readFileSync(filePath2, 'utf8'))

        if (devMode) links_short_need.length = 2



        console.time('🐾🐾🐾 Общее время размещения остальных фоток')
        let count = 0
        for (const photo of links_short_need) {
            let placeInLine = 0
            for (const url of links_all[photo]) {
                placeInLine++
                count++
                const urlParts = url.split('/');
                let fileName = urlParts[urlParts.length - 1];
                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
                await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
            }
        }
        console.timeEnd('🐾🐾🐾 Общее время размещения остальных фоток')
        return count
    } catch (e) {

    }
}