async function deleteFromTableIfExists(db, tableName) {
    try {
        // Check if the table exists
        const result = await db.get(`SELECT name
                                         FROM sqlite_master
                                         WHERE type = 'table'
                                           AND name = '${tableName}'`);

        if (result) {
            // Table exists, proceed with deletion
            await db.exec(`DELETE
                               FROM ${tableName};`);
        } else {
            // Table doesn't exist, log and continue
            console.log(`Table ${tableName} does not exist, skipping...`);
        }
    } catch (error) {
        console.warn(`Warning: Could not clear table ${tableName}:`, error.message);
    }
}
async function copyTableData(db, sourceTable, targetTable) {
    try {
        // Check if source table exists
        const sourceExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${sourceTable}'`);

        if (!sourceExists) {
            console.log(`⚡ Source table ${sourceTable} does not exist, skipping copy to ${targetTable}`);
            return;
        }

        // Get all data from source table
        const sourceData = await db.all(`SELECT * FROM ${sourceTable}`);

        if (sourceData.length > 0) {
            // Build the column list dynamically
            const columns = Object.keys(sourceData[0]).join(', ');

            // Prepare placeholders for the INSERT statement
            const placeholders = Array(Object.keys(sourceData[0]).length).fill('?').join(', ');

            // Create INSERT statement
            const insertSql = `INSERT INTO ${targetTable} (${columns}) VALUES (${placeholders})`;

            // Insert all rows
            for (const row of sourceData) {
                const values = Object.values(row);
                await db.run(insertSql, values);
            }

            // console.log(`⚡ Copied ${sourceData.length} rows from ${sourceTable} to ${targetTable}`);
            console.log(`⚡   Скопировано ${sourceData.length} строк в ${targetTable}`)
        } else {
            console.log(`No data to copy from ${sourceTable} to ${targetTable}`);
        }
    } catch (error) {
        console.error(`Error copying data from ${sourceTable} to ${targetTable}:`, error.message);
        // Don't throw the error, just log it to allow the process to continue
    }
}
export async function publicBD(db) {
    console.log('⚡ Публикуем обновленную базу ')
    console.log('⚡ ====================================')
    try {
        await deleteFromTableIfExists(db, 'a_car');
        await deleteFromTableIfExists(db, 'a_section');

        // Create a_car table if it doesn't exist (matching cars_table structure)
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS a_car
            (
                id                     TEXT PRIMARY KEY,
                name                   TEXT,
                section                TEXT,
                price                  REAL,
                prop_milleage          INTEGER,
                prop_year              INTEGER,
                prop_color             TEXT,
                prop_engine_capacity   REAL,
                prop_engine_type       TEXT,
                prop_power             INTEGER,
                prop_transmission_type TEXT,
                prop_drive             TEXT,
                prop_body_type         TEXT,
                prop_steering_wheel    TEXT,
                prop_address           TEXT,
                prop_options           TEXT,
                prop_guarantee         TEXT,
                prop_city              TEXT,
                prop_brand             TEXT,
                prop_model             TEXT,
                prop_VIN               TEXT,
                images                 TEXT
            )
        `);

        // Create a_section table if it doesn't exist (matching sections_table structure)
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS a_section
            (
                id       TEXT PRIMARY KEY,
                parentId TEXT,
                Brand    TEXT,
                Model    TEXT
            )
        `);

        // Copy data from cars_table to a_car
        await copyTableData(db, 'cars_table', 'a_car');

        // Copy data from sections_table to a_section
        await copyTableData(db, 'sections_table', 'a_section');

        return '⚡. Таблицы опубликованы'

    } catch (error) {
        return 'Error copying data to info tables:' + error.message;
    }
}