// async function getNewLinks(db) {
//     try {
//         // language=SQLite
//         const results = await db.all(`
//             SELECT images
//             FROM cars_table
//             WHERE images IS NOT NULL
//               AND images != ''
//         `);
//
//         let totalLinks = [];
//         results.forEach(row => {
//             if (row.images && typeof row.images === 'string') {
//                 const links = row.images.split(/, /).filter(link => link.trim() !== '');
//                 totalLinks.push(...links)
//             }
//         });
//
//         return totalLinks
//     } catch (error) {
//         return 'Error counting image links in a_car table: ' + error.message;
//     }
// }
//
// async function getOldLinks(db) {
//     try {
//         // Проверка наличия
//         const tableInfo = await db.all("PRAGMA table_info(a_car)");
//         const hasImagesColumn = tableInfo.some(column => column.name === 'images');
//
//         // language=SQLite
//         let results = []
//         if (hasImagesColumn) {
//             results = await db.all(`
//                 SELECT images
//                 FROM a_car
//                 WHERE images IS NOT NULL
//                   AND images != ''
//             `);
//         }
//
//         let totalLinks = [];
//         results.forEach(row => {
//             if (row.images && typeof row.images === 'string') {
//                 const links = row.images.split(/, /).filter(link => link.trim() !== '');
//                 totalLinks.push(...links)
//             }
//         });
//
//         return totalLinks
//     } catch (error) {
//         return 'Error counting image links in a_car table: ' + error.message;
//     }
// }

async function getNewCars(db) {
    try {
        // language=SQLite
        const results = await db.all(`
            SELECT id, images
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);

        return results
    } catch (error) {
        return 'Error counting image links in cars_table table: ' + error.message;
    }
}

async function getOldCars(db) {
    try {
        // Проверка наличия
        const tableInfo = await db.all("PRAGMA table_info(cars_table)");
        const hasImagesColumn = tableInfo.some(column => column.name === 'images');

        // language=SQLite
        let results = []
        if (hasImagesColumn) {
            results = await db.all(`
                SELECT id, images
                FROM cars_table
                WHERE images IS NOT NULL
                  AND images != ''
            `);
        }

        return results
    } catch (error) {
        return 'Error counting image links in cars_table table: ' + error.message;
    }
}

export async function countNewCars(db) {
    let newCars = await getNewCars(db)
    let oldCars = await getOldCars(db)

    return newCars.filter(car => !oldCars.find(el=>el.id===car.id));
}