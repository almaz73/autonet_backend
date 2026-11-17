import {
    FolderLINKS,
    NEW_AUTO_IDS_TTL_MS,
    getNewAutoIds,
    isFreshNewAutoIds,
} from "../constants.js";
import fs from 'fs';
import path from "path";
import {catalogSlug} from '../shared/catalogUrls.js';

class CityListService {
    async getAutoByParams(brand, model, linkId, isSmallPhoto) {
        const result = await this.getAutoByLinkId(linkId, isSmallPhoto)
        if (!result) return null

        // адрес карточки может прийти слагами: «vaz-lada» вместо «ВАЗ (LADA)»
        if (brand && catalogSlug(brand) !== catalogSlug(result.brand)) {
            console.log('Car brand mismatch:', brand, linkId);
            return null
        }
        return result
    }

    // поиск по linkId без учёта регистра: строчные и старые варианты адреса
    // должны редиректить на канон, а не отдавать 410
    async getAutoByLinkId(linkId, isSmallPhoto) {
        const db = global.db
        try {
            // Query the a_car table and join with a_section to get the brandId
            // language=SQLite
            const result = await db.get(`
                SELECT ac.id,
                       ac.price,
                       ac.prop_guarantee         as linkId,
                       ac.prop_brand             as brand,
                       ac.prop_model             as model,
                       sec.id                    as brandId,
                       ac.prop_city              as city,
                       ac.prop_milleage          as milleage,
                       ac.prop_color             as color,
                       ac.prop_engine_capacity   as engineCapacity,
                       ac.prop_engine_type       as engineType,
                       ac.prop_power             as enginePower,
                       ac.prop_transmission_type as gearboxType,
                       ac.prop_drive             as driveType,
                       ac.prop_body_type         as bodyType,
                       ac.prop_steering_wheel    as wheelType,
                       ac.prop_address           as fullAddress,
                       ac.prop_options           as configuration,
                       ac.prop_year              as yearReleased,
                       ac.images

                FROM a_car ac
                         LEFT JOIN a_section sec ON UPPER(ac.prop_brand) = UPPER(sec.brand)
                WHERE UPPER(ac.prop_guarantee) = UPPER(?)
                LIMIT 1`, [linkId]);

            if (!result) {
                console.log('No car found with link:', linkId);
                return null; // Return null if no car is found with the given guid
            }

            if (result.images) {
                result.images = result.images.split(',').map(url => url.trim())
                let typePhoto = isSmallPhoto === 'true' ? '_small.webp' : '_big.webp'
                result.images = result.images.map(el => '/pub_auto/' + el.split('/').pop().split('.')[0] + typePhoto)
            }
            return result;
        } catch (error) {
            console.error('Error retrieving car info from a_car table:', error.message);
            throw error;
        }
    }

    // карточка авто по VIN: старые ссылки /reserve?vin=... ведём на актуальную страницу
    async getAutoByVin(vin) {
        const db = global.db
        try {
            // language=SQLite
            return await db.get(`
                SELECT prop_brand     as brand,
                       prop_model     as model,
                       prop_guarantee as linkId
                FROM a_car
                WHERE UPPER(prop_VIN) = UPPER(?)
                LIMIT 1`, [vin]) || null
        } catch (error) {
            console.error('Error retrieving car by VIN:', error.message);
            throw error;
        }
    }


    /**
     * Список последних поступлений,
     */
    async getLatestCarArrivials(startPage, city) {
        let pageSize = 5
        let ids = []
        const db = global.db
        const filePath = path.join(FolderLINKS, '_newAutoIDS.js'); // вытаскивание по дате
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const mtime = fs.statSync(filePath).mtime;
            const data = JSON.parse(fileContent);
            if (isFreshNewAutoIds(data, mtime.getTime())) ids = getNewAutoIds(data)
            else console.log('[getLatestCarArrivials] файл устарел', {
                file: filePath,
                mtime: mtime.toString(),
                generatedAt: data?.generatedAt,
                now: new Date().toString(),
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ttlHours: NEW_AUTO_IDS_TTL_MS / 3600000,
            })
        } catch (e) {
            console.log('[getLatestCarArrivials] не удалось прочитать файл', {
                file: filePath,
                cwd: process.cwd(),
                error: e.message,
            })
        }
        if (!ids || ids.length === 0) {
            console.log('[getLatestCarArrivials] нет актуальных id новых авто', {
                file: filePath,
                cwd: process.cwd(),
                now: new Date().toString(),
            })
            return null
        }

        // выбранный город показываем первым, остальные авто добивают блок до 5 позиций
        if (city && city !== 'Россия') {
            try {
                // language=SQLite
                const cityRows = await db.all(
                    `SELECT id FROM a_car WHERE id IN (${ids.map(() => '?').join(',')}) AND UPPER(prop_city) = UPPER(?)`,
                    [...ids, city]
                )
                const cityIds = new Set(cityRows.map(row => row.id))
                if (cityIds.size && cityIds.size < ids.length) {
                    ids = [
                        ...ids.filter(id => cityIds.has(id)),
                        ...ids.filter(id => !cityIds.has(id))
                    ]
                }
            } catch (error) {
                console.error('Error prioritizing new cars by city:', error.message);
            }
        }

        if (!startPage || isNaN(startPage) || startPage == 0) startPage = 1

        let pageIds = []
        let totalPages = Math.ceil(ids.length / pageSize) // общее количество новых

        // список для краулеров
        if ((startPage - 1) * pageSize > ids.length) return null
        else pageIds = ids.slice((startPage - 1) * pageSize, startPage * pageSize);

        try {
            // language=SQLite
            let query = `
                SELECT ac.id,
                       ac.prop_guarantee         as linkId,
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
                WHERE ac.id IN (${pageIds.map(() => '?').join(',')}) AND ac.images IS NOT NULL AND ac.images != ''
                ORDER BY CASE ac.id ${pageIds.map((_, index) => `WHEN ? THEN ${index}`).join(' ')}
                END
            `;

            // Execute query with the page IDs
            const results = await db.all(query, [...pageIds, ...pageIds]);

            if (!results || results.length === 0) {
                console.log('No new cars found for this page');
                return []
            }
            for (const el of results) {
                try {
                    if (el.engineCapacity) el.engineCapacity = parseFloat(el.engineCapacity)
                    if (el.gearboxType) {
                        if (el.gearboxType === 'Механическая') el.gearboxType = 'MT'
                        if (el.gearboxType === 'Автоматическая') el.gearboxType = 'АT'
                        if (el.gearboxType === 'Робот') el.gearboxType = 'AMT'
                        if (el.gearboxType === 'Вариатор') el.gearboxType = 'CVT'
                    }
                    el.images = el.images ? el.images.split(',').map(url => url.trim()) : [];
                    el.images.length = 5
                    el.images = el.images.map(item => '/pub_auto/' + item.split('/').pop().split('.')[0] + '_small.webp')
                } catch (error) {
                    console.error('Error parsing images for car ID ' + el.id + ':', error.message);
                    el.images = [];
                }
            }
            return {items: results,totalPages} ;
        } catch (error) {
            console.error('Error retrieving car info from a_car table:', error.message);
            throw error;
        }
    }

    async getCarCount() {
        const db = global.db
        try {
            // Query the a_section table joined with a_car to get brand counts
            // language=SQLite
            let results = await db.all(`
                SELECT sec.id       as brandId,
                       COUNT(ac.id) as count,
                       sec.brand    as name
                FROM a_section sec
                         LEFT JOIN a_car ac ON UPPER(sec.brand) = UPPER(ac.prop_brand)
                WHERE sec.brand IS NOT NULL
                  AND sec.brand != ''
                GROUP BY sec.id, sec.brand
                ORDER BY sec.brand
            `);

            results = results.sort((a, b) => b.count - a.count)

            return results;
        } catch (error) {
            console.error('Error retrieving car count by brand from a_car and a_section tables:', error.message);
            throw error;
        }
    }

    // модели бренда с количеством и диапазоном цен/годов — для посадочных страниц моделей
    async getModelCounts(brand) {
        const db = global.db
        try {
            const params = []
            let where = `prop_model IS NOT NULL AND prop_model != ''`
            if (brand) {
                where += ' AND UPPER(prop_brand) = UPPER(?)'
                params.push(brand)
            }
            // language=SQLite
            return await db.all(`
                SELECT prop_brand as brand,
                       prop_model as model,
                       COUNT(*)   as count,
                       MIN(price) as priceFrom,
                       MAX(price) as priceTo,
                       MIN(prop_year) as yearFrom,
                       MAX(prop_year) as yearTo
                FROM a_car
                WHERE ${where}
                GROUP BY prop_brand, prop_model`, params)
        } catch (error) {
            console.error('Error retrieving model counts:', error.message);
            throw error;
        }
    }

    // города с количеством машин — для городских посадочных
    async getCityCounts() {
        const db = global.db
        try {
            // language=SQLite
            return await db.all(`
                SELECT prop_city as city, COUNT(*) as count
                FROM a_car
                WHERE prop_city IS NOT NULL
                  AND prop_city != ''
                GROUP BY prop_city`)
        } catch (error) {
            console.error('Error retrieving city counts:', error.message);
            throw error;
        }
    }

    // модель + город с количеством машин; опционально по бренду
    async getModelCityCounts(brand) {
        const db = global.db
        try {
            const params = []
            let where = `prop_model IS NOT NULL AND prop_model != '' AND prop_city IS NOT NULL AND prop_city != ''`
            if (brand) {
                where += ' AND UPPER(prop_brand) = UPPER(?)'
                params.push(brand)
            }
            // language=SQLite
            return await db.all(`
                SELECT prop_model as model, prop_city as city, COUNT(*) as count
                FROM a_car
                WHERE ${where}
                GROUP BY prop_model, prop_city`, params)
        } catch (error) {
            console.error('Error retrieving model-city counts:', error.message);
            throw error;
        }
    }

    // раздел каталога по id: нужен, когда фильтр пришёл как /cars?modelId=...
    async getSectionInfo(id) {
        const db = global.db
        try {
            // language=SQLite
            return await db.get(`
                SELECT CASE
                           WHEN s.Brand IS NOT NULL AND s.Brand != '' THEN s.Brand
                           ELSE p.Brand
                           END      as brand,
                       s.Model      as model
                FROM a_section s
                         LEFT JOIN a_section p ON p.id = s.parentId
                WHERE s.id = ?`, [id]) || null
        } catch (error) {
            console.error('Error retrieving section info:', error.message);
            throw error;
        }
    }


    async getCitiesFromACar() {
        const db = global.db
        try {
            // Query the a_car table for distinct cities
            // language=SQLite
            const cityResults = await db.all(`
                SELECT DISTINCT prop_city as city
                FROM a_car
                WHERE prop_city IS NOT NULL
                  AND prop_city != ''
--                 ORDER BY prop_city ASC
            `);

            // Extract just the city names from the results
            return cityResults.map(result => result.city);
        } catch (error) {
            console.error('Error retrieving cities from a_car table:', error.message);
            throw error;
        }
    }

    async getGearboxTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct transmission types
            // language=SQLite
            const gearboxResults = await db.all(`
                SELECT DISTINCT prop_transmission_type
                FROM a_car
                WHERE prop_transmission_type IS NOT NULL
                  AND prop_transmission_type != ''
--                 ORDER BY prop_transmission_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return gearboxResults.map((result, index) => ({
                value: index,
                title: result.prop_transmission_type
            }));
        } catch (error) {
            console.error('Error retrieving gearbox types from a_car table:', error.message);
            throw error;
        }
    }

    async getEngineTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`
                SELECT DISTINCT prop_engine_type
                FROM a_car
                WHERE prop_engine_type IS NOT NULL
                  AND prop_engine_type != ''
--                 ORDER BY prop_engine_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_engine_type
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getDriveTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`
                SELECT DISTINCT prop_drive
                FROM a_car
                WHERE prop_drive IS NOT NULL
                  AND prop_drive != ''
--                 ORDER BY prop_drive ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_drive
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getWheelTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`
                SELECT DISTINCT prop_steering_wheel
                FROM a_car
                WHERE prop_steering_wheel IS NOT NULL
                  AND prop_steering_wheel != ''
--                 ORDER BY prop_steering_wheel ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_steering_wheel
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getBodyTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`
                SELECT DISTINCT prop_body_type
                FROM a_car
                WHERE prop_body_type IS NOT NULL
                  AND prop_body_type != ''
--                 ORDER BY prop_body_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_body_type
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getColorList() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`
                SELECT DISTINCT prop_color
                FROM a_car
                WHERE prop_color IS NOT NULL
                  AND prop_color != ''
--                 ORDER BY prop_color ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_color
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getYearGap() {
        const db = global.db
        try {
            // Query the a_car table for min and max years
            // language=SQLite
            const result = await db.get(`
                SELECT MIN(prop_year) as fromYear,
                       MAX(prop_year) as toYear
                FROM a_car
                WHERE prop_year IS NOT NULL
            `);

            if (!result) return {from: "2000", to: "2026"};


            // Return the result in the requested format
            return {from: result.fromYear, to: result.toYear}
        } catch (error) {
            console.error('Error retrieving year gap from a_car table:', error.message);
            throw error;
        }
    }

    async checkDuplicateVINs() {
        const db = global.db
        try {
            // Query to find duplicate prop_VIN values
            // language=SQLite
            const results = await db.all(`
                SELECT prop_VIN, COUNT(*) as count
                FROM a_car
                WHERE prop_VIN IS NOT NULL
                  AND prop_VIN != ''
                GROUP BY prop_VIN
                HAVING COUNT(*) > 1
            `);


            let results2
            if (results.length) {
                // language=SQLite
                results2 = await db.all(`
                    SELECT prop_VIN, name, prop_city as 'Город'
                    FROM a_car
                    WHERE prop_VIN = ?
                `, results[0].prop_VIN);
            }

            console.log('Дубликатов VIN:', results.length ? results : 'НЕТ');
            if (results2) console.log('results2', results2)
            return results.length ? results2 : 'Нет дубликатов VIN';
        } catch (error) {
            console.error('Error checking duplicate VINs in a_car table:', error.message);
            throw error;
        }
    }

    async getAllImageLinksFromBD() {
        const db = global.db
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
                if (row.images && typeof row.images === 'string') {
                    links.push(...row.images.split(/, /));
                }
            });


            return links;
        } catch (error) {
            console.error('Error counting image links in a_car table:', error.message);
            throw error;
        }
    }

    async getImageLinksCount(withoutComments) {
        try {
            let links = await this.getAllImageLinksFromBD()
            let group = links.length
            let totalLinks = links.length;

            if (!withoutComments) {
                console.log('group', group)
                console.log('Общее количество прикрепленных фоток: ', totalLinks);
                console.log('Автомобилей с фотками: ', links.length);
            } else return links.length

            return `Всего ссылок на фотo: ${totalLinks}  /  Автомобилей с фотками: ${links.length}`;
        } catch (error) {
            console.error('Error counting image links in a_car table:', error.message);
            throw error;
        }
    }

    async getNewLinks() {
        const db = global.db
        try {
            // Query the a_car table to get all non-null images
            // language=SQLite
            const results = await db.all(`
                SELECT images
                FROM cars_table
                WHERE images IS NOT NULL
                  AND images != ''
            `);

            let totalLinks = [];
            results.forEach(row => {
                if (row.images && typeof row.images === 'string') {
                    const links = row.images.split(/, /).filter(link => link.trim() !== '');
                    totalLinks.push(...links)
                }
            });

            return totalLinks
        } catch (error) {
            console.error('Error counting image links in a_car table:', error.message);
            throw error;
        }
    }

    async getOldLinks() {
        const db = global.db
        try {
            // Проверка наличия
            const tableInfo = await db.all("PRAGMA table_info(a_car)");
            const hasImagesColumn = tableInfo.some(column => column.name === 'images');

            // Query the a_car table to get all non-null images
            // language=SQLite
            let results = []
            if (hasImagesColumn) {
                results = await db.all(`
                    SELECT images
                    FROM a_car
                    WHERE images IS NOT NULL
                      AND images != ''
                `);
            }

            let totalLinks = [];
            results.forEach(row => {
                if (row.images && typeof row.images === 'string') {
                    const links = row.images.split(/, /).filter(link => link.trim() !== '');
                    totalLinks.push(...links)
                }
            });

            return totalLinks
        } catch (error) {
            console.error('Error counting image links in a_car table:', error.message);
            throw error;
        }
    }


    // тупиковая идея
    /*
    async getNotExistLinks(listExistPhoto) {
        const db = global.db
        try {
            // Query the a_car table to get all non-null images
            // language=SQLite
            const results = await db.all(`
                SELECT images
                FROM cars_table
                WHERE images IS NOT NULL
                  AND images != ''
            `);
            let totalLinks = [];
            results.forEach(row => {
                if (row.images && typeof row.images === 'string') {
                    const links = row.images.split(/, /).filter(link => link.trim() !== '');
                    totalLinks.push(...links)
                }
            });
            let tableLinks = []
            totalLinks.forEach(link => {
                const urlParts = link.split('/');
                let fileName = urlParts[urlParts.length - 1];
                fileName = fileName.substring(0, fileName.lastIndexOf('.'));
                tableLinks.push(fileName)
            })
            // 1. Создаем Set для быстрого поиска
            const removeSet = new Set(listExistPhoto);
            // 2. Фильтруем и убираем дубликаты
            const result = [...new Set(tableLinks.filter(item => !removeSet.has(item)))];
            // console.log(result); // ["apple", "orange"]
            //
            // console.log('>>>> >>>> result', result)
            return result
        } catch (error) {
            console.error('Error counting image links in a_car table:', error.message);
            throw error;
        }
    }
     */


}

export default new CityListService();
