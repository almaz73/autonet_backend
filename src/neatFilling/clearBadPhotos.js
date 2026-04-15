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

        
        // console.log('pdfFields = ', badFields)


        const deleted =  await deleteBadFields (db, badFields)
        return deleted && badFields.length
    } catch (error) {
        throw error;
    }

    return '⚡. Плохие ссылки на фото удалены';
}

async function deleteBadFields(db, badFields) {
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
}