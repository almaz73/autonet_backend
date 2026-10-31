import {transliterate} from "../../constants.js";

async function deleteFromTableIfExists(db, tableName) {
    const result = await db.get(`SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name = '${tableName}'`);

    if (result) {
        await db.exec(`DELETE
                       FROM ${tableName};`);
    } else {
        console.log(`Table ${tableName} does not exist, skipping...`);
    }
}

async function copyTableData(db, sourceTable, targetTable) {
    // Check if source table exists
    const sourceExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${sourceTable}'`);

    if (!sourceExists) {
        throw new Error(`Source table ${sourceTable} does not exist`);
    }

    // Get all data from source table
    const sourceData = await db.all(`SELECT * FROM ${sourceTable}`);

    if (!sourceData.length) return 0;

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

    return sourceData.length;
}

async function makeLinkid(db) {
    // убираем пробелы, переводим в латиницу создаем ссылку
    const rows = await db.all(`SELECT id, prop_brand, prop_model, prop_year, prop_city, price, prop_milleage FROM a_car`);
    for (const row of rows) {
        const cityLat = transliterate(row.prop_city || '').replace(/\s+/g, '');
        // const brand = transliterate(String(row.prop_brand || '')).replace(/\s+/g, '');
        // const model = transliterate(String(row.prop_model || '')).replace(/\s+/g, '');
        const linkId = `${row.prop_year}-${cityLat}-${Math.floor(row.price || 0)}-${row.prop_milleage}km`;

        // 3. Записываем обработанные поля
        await db.run(`UPDATE a_car SET prop_guarantee = ? WHERE id = ?`, [linkId, row.id]);
        // await db.run(`UPDATE a_car SET prop_brand = ? WHERE id = ?`, [brand, row.id]);
        // await db.run(`UPDATE a_car SET prop_model = ? WHERE id = ?`, [model, row.id]);
    }
}

export async function _publicBD(db) {
    // публикация в одной транзакции: при ошибке старая витрина остаётся нетронутой
    await db.exec('BEGIN')
    try {
        await deleteFromTableIfExists(db, 'a_car');
        await deleteFromTableIfExists(db, 'a_section');

        // Create a_car table if it doesn't exist (matching cars_table structure)
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS a_car
            (
                id                     TEXT PRIMARY KEY,
                prop_guarantee         TEXT,
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
        const copiedCars = await copyTableData(db, 'cars_table', 'a_car');

        // Copy data from sections_table to a_section
        await copyTableData(db, 'sections_table', 'a_section');

        // публикуем только если скопировалось всё
        const publicCars = await db.get('SELECT COUNT(*) AS count FROM a_car');
        if (publicCars.count !== copiedCars) {
            throw new Error(`Опубликовано ${publicCars.count} из ${copiedCars} авто`);
        }

        await makeLinkid(db)
        await db.exec('COMMIT')

        return `успешно, авто: ${copiedCars}`
    } catch (error) {
        await db.exec('ROLLBACK')
        throw error
    }
}