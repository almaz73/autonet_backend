import path from "path";
import {devMode, FolderLINKS, FolderPhoto, FolderXML} from "../constants.js";
import axios from "axios";
import fs from "fs";
import PhotoSaver from "./CreaterSmallBigPhotoSteps.js";

export async function addFirstPhotos() {
    try {
        const filePath = path.join(FolderLINKS, 'links_short_need.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let links_short_need = JSON.parse(fileContent)

        if (devMode) links_short_need.length = 2



        console.time('🐾🐾🐾 Общее время размещения первых фоток')
        let count = 0
        for (const photo of links_short_need) {
            await PhotoSaver.savePhotoToServer(photo, 1, FolderPhoto);
            // count += 2
            // let placeInLine = 0
            // for (const url of links_all[photo]) {
            //     placeInLine++
            //     count++
            //     const urlParts = url.split('/');
            //     let fileName = urlParts[urlParts.length - 1];
            //     fileName = fileName.substring(0, fileName.lastIndexOf('.'));
            //     await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
            //     if (placeInLine < 6) count++
            // }
            // console.log('>>> count = ', count)
        }
        console.timeEnd('🐾🐾🐾 Общее время размещения первых фоток')
        return links_short_need.length




        // return links_short_need.length
    } catch (e) {

    }
}