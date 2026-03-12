class CityListService {
    async getFullAutoInfo(guid) {
        const db = global.db
        try {
            // Query the a_car table and join with a_section to get the brandId
            // language=SQLite
            const result = await db.get(`
                SELECT ac.id,
                       ac.price,
                       ac.prop_brand             as brand,
                       sec.id                    as brandId,
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
                         LEFT JOIN a_section sec ON ac.prop_brand = sec.brand
                WHERE ac.id = ?
            `, [guid]);

            if (!result) {
                console.log('No car found with guid:', guid);
                return null; // Return null if no car is found with the given guid
            }

            return result;
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
                         LEFT JOIN a_car ac ON sec.brand = ac.prop_brand
                WHERE sec.brand IS NOT NULL
                  AND sec.brand != ''
                GROUP BY sec.id, sec.brand
                ORDER BY sec.brand
            `);

            results = results.sort((a, b) => b.count - a.count)

            if (results.length > 20) results.length = 20
            console.log('results', results)
            return results;
        } catch (error) {
            console.error('Error retrieving car count by brand from a_car and a_section tables:', error.message);
            throw error;
        }
    }

    async getSpecials(city) {
        const db = global.db
        try {
            let query;
            let params;

            if (city) {
                // If city is provided, filter by specific city
                //  language=SQLite
                query = `
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
                           ac.prop_steering_wheel    as wheelType,
                           ac.images
                    FROM a_car ac
                    WHERE prop_city = ?
                      AND price > 400000
                      AND price < 800000
                    LIMIT 5
                `;
                params = [city];
            } else {
                // If no city is provided, return results from all cities
                //  language=SQLite
                query = `
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
                           ac.prop_steering_wheel    as wheelType,
                           ac.images
                    FROM a_car ac
                    WHERE price > 400000
                      AND price < 800000
                    LIMIT 5
                `;
                params = [];
            }

            const results = await db.all(query, params);

            results.map(el => {
                try {
                    el.images = el.images ? el.images.split(',').map(url => url.trim()) : [];
                    el.images.length = 5
                } catch (error) {
                    console.error('Error parsing images for car ID ' + el.id + ':', error.message);
                    el.images = [];
                }
            });

            return results;
        } catch (error) {
            console.error('Error retrieving special cars from a_car table:', error.message);
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

    async getImageLinksCount(withoutComments) {
        const db = global.db
        try {
            // Query the a_car table to get all non-null images
            // language=SQLite
            const results = await db.all(`
                SELECT images
                FROM a_car
                WHERE images IS NOT NULL
                  AND images != ''
            `);

            let totalLinks = 0;
            let group = ''

            results.forEach(row => {
                if (row.images && typeof row.images === 'string') {
                    // Split the images string by whitespace and count non-empty links
                    const links = row.images.split(/\s+/).filter(link => link.trim() !== '');
                    // console.log('links', links.length)
                    group += links.length + ', '
                    totalLinks += links.length;
                }
            });

            if (!withoutComments) {
                console.log('group', group)
                console.log('Общее количество прикрепленных фоток: ', totalLinks);
                console.log('Автомобилей с фотками: ', results.length);
            } else  return results.length

            return `Всего ссылок на фотo: ${totalLinks}  /  Автомобилей с фотками: ${results.length}`;
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
