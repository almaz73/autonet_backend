import path from "path";
import {FolderLINKS} from "../../constants.js";
import fs from "fs";

function getListNewCarArrives() {
    try {
        const filePath = path.join(FolderLINKS, 'links_short_need.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let links_short_need = JSON.parse(fileContent)
        let ids = []
        for (let link of links_short_need) {
            ids.push(link.split('/')[4])
        }
        console.log('ids = ', ids)
        return ids
    } catch (e) {
        console.log('нет последних поступлений. Возможно нет файла links_short_need.js')
    }
}

async getLatestCarArrivials(page) {
    console.log('page = ',page)
    // TODO
    const db = global.db
    try {
        // language=SQLite
        let query = `
                SELECT ac.id,
                       ac.prop_brand             as brand,
                       ac.prop_model             as model,
                       ac.prop_year              as yearReleased,
                       ac.price,
                       ac.prop_milleage          as milleage,
                       ac.prop_power             as enginePower,
                       ac.prop_engine_capacity   as engineCapacity,
                       ac.prop_transmission_type as gearboxType,
                       ac.prop_body_type         as bodyType,
                       ac.prop_engine_type       as engineType,
                       ac.prop_drive             as driveType,
                       ac.prop_address           as fullAddress,
                       ac.prop_color             as color,
                       ac.prop_city              as city,
                       ac.prop_steering_wheel    as wheelType, 
                       ac.images
                FROM a_car ac
                WHERE id = ?
                LIMIT 15
            `;
        // language=SQLite
        const result = await db.get(query, [id]);

        if (!result) {
            console.log('No new car today');
            return null;
        }

        if (result.images) {
            result.images = result.images.split(',').map(url => url.trim())
            result.images = result.images.map(el => '/pub_auto/' + el.split('/').pop().split('.')[0] + '_big.webp')
        }
        return result;
    } catch (error) {
        console.error('Error retrieving car info from a_car table:', error.message);
        throw error;
    }
}

// getListNewCarArrives()