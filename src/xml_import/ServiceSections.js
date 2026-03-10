class ServiceSections {


    async clearTables(db) {
        try {
            // Clear all the tables with conditional checks
            await this.deleteFromTableIfExists(db, 'cars');
            await this.deleteFromTableIfExists(db, 'cars_table');
            await this.deleteFromTableIfExists(db, 'sections');
            await this.deleteFromTableIfExists(db, 'sections_table');

            console.log('⚡ success Все предварительные таблицы удалены');
        } catch (error) {
            console.error('Error clearing tables:', error.message);
            throw error;
        }
    }

    async createTables(db) {
        // Create sections table with dynamic columns based on XML structure
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

        // Create cars table with dynamic columns based on XML structure
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

        console.log('⚡ success Предвариельные таблицы созданы');
    }

    async deleteFromTableIfExists(db, tableName) {
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
    async processSections(db) {
        try {
            // Get all sections from the database
            // language=SQLite
            const sections = await db.all('SELECT * FROM sections');

            // Parse the JSON data for each section
            const parsedSections = sections.map(section => ({
                ...section,
                data: JSON.parse(section.data)
            }));

            // Create a new table for sections with id, parentId, Brand, Model
            // language=SQLite
            await db.exec(`
                CREATE TABLE IF NOT EXISTS sections_table
                (
                    id       TEXT PRIMARY KEY,
                    parentId TEXT,
                    Brand    TEXT,
                    Model    TEXT
                )
            `);

            // Process sections and their potential subsections recursively
            await this.processSectionRecursive(parsedSections, db, '');

            // Get the processed data
            // language=SQLite
            const processedData = await db.all('SELECT * FROM sections_table');

            return {
                success: true,
                message: 'Sections processed successfully into sections_table',
                count: processedData.length,
                data: processedData
            };
        } catch (error) {
            console.error('Error processing sections:', error);
            throw error;
        }
    }

    async processSectionRecursive(sections, db, parentInfo) {
        for (const section of sections) {
            const sectionData = section.data;

            // Extract id from the section data
            let id = '';
            if (sectionData.$ && sectionData.$.id) {
                id = this.extractValue(sectionData.$.id);
            } else if (sectionData.id && typeof sectionData.id === 'object' && sectionData.id._) {
                // Handle case where id is an object with a value
                id = this.extractValue(sectionData.id._);
            } else if (sectionData.id) {
                id = this.extractValue(sectionData.id);
            }

            // Skip if id equals 'ap_probeg'
            if (id === 'ap_probeg' || !id) continue;

            // Extract parentId - check various possible locations
            let parentId = parentInfo; // default to parentInfo passed from parent


            parentId = sectionData.$.parentid || sectionData.$.parentId || sectionData.$.parent_id || parentId;


            // Extract Brand and Model from the section data
            let Brand = '';
            let Model = '';

            if (parentId !== 'ap_probeg') Model = sectionData['_']
            else Brand = sectionData['_']


            // Insert into the new table only if we have meaningful data
            if (id && (Brand || Model)) {
                // language=SQLite
                await db.run(
                    'INSERT OR REPLACE INTO sections_table (id, parentId, Brand, Model) VALUES (?, ?, ?, ?)',
                    [id, parentId, Brand, Model]
                );
            }

            // Process subsections if they exist
            if (sectionData.section) {
                const subsections = Array.isArray(sectionData.section)
                    ? sectionData.section
                    : [sectionData.section];

                // Process each subsection recursively, passing current id as parent
                for (const subsection of subsections) {
                    // Create a temporary section-like object for the subsection
                    const tempSection = {data: subsection};
                    await this.processSectionRecursive([tempSection], db, id);
                }
            }
        }
    }

    extractValue(value) {
        if (value && typeof value === 'object' && value._) {
            // Handle XML element with attributes: { _: 'value', $: {...} }
            return value._.toString().trim();

        }
        if (value && typeof value === 'object') {
            // If it's an object but not the attribute format, convert to string
            return JSON.stringify(value);
        }
        return value ? value.toString().trim() : '';
    }
}

export default new ServiceSections();