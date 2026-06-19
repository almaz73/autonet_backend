export async function clearBadPhotos(db) {
    try {
        // language=SQLite
        const results = await db.all(`
            SELECT id, images, prop_city, name
            FROM cars_table
            WHERE images LIKE '%kopiya%' OR images LIKE '%pdf%'
                AND images != ''
        `);

        const badFields = results.map(record => {
            return {id:record.id, city: record.prop_city, name:  record.name}
        });

        const deleted =  await deleteBadLinkToPhoto (db, badFields)
        return deleted && badFields.length
    } catch (error) {
        throw error;
    }

    return '⚡. Плохие ссылки на фото удалены';
}

/*async function deleteBadFields(db, badFields) {
    if (!badFields || badFields.length === 0) {
        // console.log('No bad fields to delete.');
        return 0;
    }

    const idsToDelete = badFields.map(field => field.id);
    const idsPlaceholder = idsToDelete.map((_, i) => `$${i + 1}`).join(', ');

    // language=SQLite
    const query = `        DELETE FROM cars_table
        WHERE id IN (${idsPlaceholder})
    `;

    try {
        const result = await db.run(query, idsToDelete);
        console.log(`Deleted ${result.changes} record(s) from cars_table`);
        return result.changes;
    } catch (error) {
        console.error('Error deleting bad fields:', error);
        throw error;
    }
}*/

async function deleteBadLinkToPhoto(db, badFields) {
    if (!badFields || badFields.length === 0) {
        return 0;
    }

    // Create placeholders for the SQL query
    const idsPlaceholder = badFields.map((_, i) => `$${i + 1}`).join(', ');
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
            const images = record.images.split(',');
            
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
                    $images: filteredImages.join(',')
                });
            }
            
            return Promise.resolve({changes: 0}); // No changes needed
        });

        // Execute all update promises
        const results = await Promise.all(updatePromises);
        
        // Calculate total changes
        const totalChanges = results.reduce((sum, result) => sum + result.changes, 0);
        return totalChanges;
    } catch (error) {
        console.error('Error updating bad links:', error);
        throw error;
    }
}