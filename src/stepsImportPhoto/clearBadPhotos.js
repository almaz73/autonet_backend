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

        
        console.log('pdfFields = ',badFields)
        const deleted =  deleteBadFields (db, badFields)

        // You can add additional processing here, like logging or removing the records

        return deleted && badFields.length
    } catch (error) {
        throw error;
    }

    return '⚡. Плохие ссылки на фото удалены';
}

function deleteBadFields(db, badFields) {

}