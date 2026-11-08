async function getNewLinks(db) {
    try {
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
        return 'Error counting image links in a_car table: ' + error.message;
    }
}

async function getOldLinks(db) {
    try {
        // Проверка наличия
        const tableInfo = await db.all("PRAGMA table_info(a_car)");
        const hasImagesColumn = tableInfo.some(column => column.name === 'images');

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
        return 'Error counting image links in a_car table: ' + error.message;
    }
}

export async function countNewPhoto(db) {
    // Считаем общее количество ссылок на фото
    let newPhotos = await getNewLinks(db)
    let oldPhotos = await getOldLinks(db)

    return newPhotos.filter(link => !oldPhotos.includes(link));
}