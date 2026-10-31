export async function _clearBadPhotos(db) {
    // language=SQLite
    const results = await db.all(`
        SELECT id, images, prop_city, name
        FROM cars_table
        WHERE images IS NOT NULL
          AND images != ''
          AND (images LIKE '%kopiya%' OR images LIKE '%pdf%')
    `);

    const badFields = results.map(record => {
        return {id: record.id, city: record.prop_city, name: record.name}
    });

    const deleted = await deleteBadLinkToPhoto(db, badFields)
    if (deleted) return ` Удалены плохие фото-ссылки у ${deleted} авто (kopiya, pdf)`
    if (badFields.length) return ` Плохие фото-ссылки есть у ${badFields.length} авто, но не изменены`
    return ' Плохих фото-ссылок нет'
}


async function deleteBadLinkToPhoto(db, badFields) {
    if (!badFields || badFields.length === 0) {
        return 0;
    }

    // Create placeholders for the SQL query
    const idsPlaceholder = badFields.map(() => '?').join(', ');
    const idsToDelete = badFields.map(field => field.id);

    // language=SQLite
    const query = `
        SELECT id, images
        FROM cars_table
        WHERE id IN (${idsPlaceholder})
    `;

    try {
        // Get the records with bad links
        const records = await db.all(query, idsToDelete);

        // Prepare update statements for each record
        const updatePromises = records.map(record => {
            // Split images by comma
            const images = record.images.split(',').map(image => image.trim());
            
            // Filter out bad links
            const filteredImages = images.filter(image => {
                return !image.includes('kopiya') && !image.includes('pdf');
            });

            // If images were filtered, update the record
            if (filteredImages.length < images.length) {
                // language=SQLite
                return db.run(`
                    UPDATE cars_table
                    SET images = $images
                    WHERE id = $id
                `, {
                    $id: record.id,
                    $images: filteredImages.join(', ')
                });
            }
            
            return Promise.resolve({changes: 0}); // No changes needed
        });

        // Execute all update promises
        const results = await Promise.all(updatePromises);
        
        // Calculate total changes
        return results.reduce((sum, result) => sum + (result?.changes || 0), 0);
    } catch (error) {
        console.error('Error updating bad links:', error);
        throw error;
    }
}