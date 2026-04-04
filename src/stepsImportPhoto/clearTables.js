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

export async function clearTables(db) {
    try {
        // Clear all the tables with conditional checks
        await deleteFromTableIfExists(db, 'cars');
        await deleteFromTableIfExists(db, 'cars_table');
        await deleteFromTableIfExists(db, 'sections');
        await deleteFromTableIfExists(db, 'sections_table');
    } catch (error) {
        console.error('Error clearing tables:', error.message);
        throw error;
    }


    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS sections
        (
            id
                INTEGER
                PRIMARY
                    KEY
                AUTOINCREMENT,
            data
                TEXT
        )
    `);

    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS cars
        (
            id
                INTEGER
                PRIMARY
                    KEY
                AUTOINCREMENT,
            data
                TEXT
                NOT
                    NULL
        )
    `);

    // Create a more structured cars table
    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS cars_table
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
            prop_city              TEXT,
            prop_brand             TEXT,
            prop_model             TEXT,
            prop_VIN               TEXT,
            images                 TEXT
        )
    `);

    return '⚡. Таблицы очищены';

}

