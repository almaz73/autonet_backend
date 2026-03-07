class SectionsProcessingService {
    async processSections(db) {
        try {
            // Get all sections from the database
            const sections = await db.all('SELECT * FROM sections');

            // Parse the JSON data for each section
            const parsedSections = sections.map(section => ({
                ...section,
                data: JSON.parse(section.data)
            }));

            console.log('999')

            // Create a new table for sections with id, parentId, Brand, Model
            // language=SQLite
            await db.exec(`
                CREATE TABLE IF NOT EXISTS sections_table (
                    id TEXT PRIMARY KEY,
                    parentId TEXT,
                    Brand TEXT,
                    Model TEXT
                )
            `);

            // Clear existing data in sections_table
            await db.exec('DELETE FROM sections_table');

            // Process sections and their potential subsections recursively
            await this.processSectionRecursive(parsedSections, db, '');

            // Get the processed data
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
            } else {
                // Generate an ID if not available
                id = this.generateId();
            }
            
            // Skip if id equals 'ap_probeg'
            if (id === 'ap_probeg') {
                continue;
            }
            
            // Extract parentId - check various possible locations
            let parentId = parentInfo; // default to parentInfo passed from parent


            
            // Check if parentId is provided as an attribute
            if (sectionData.$) {
                if (sectionData.$.parent_id) {
                    parentId = this.extractValue(sectionData.$.parent_id);
                } else if (sectionData.$.parentId) {
                    parentId = this.extractValue(sectionData.$.parentId);
                } else if (sectionData.$.pid) {
                    parentId = this.extractValue(sectionData.$.pid);
                }
            }

            console.log(sectionData)
            
            // Check if parentId is provided as a child element
            if (!parentId && sectionData.parentId) {
                parentId = this.extractValue(sectionData.parentId);
            } else if (!parentId && sectionData.parent_id) {
                parentId = this.extractValue(sectionData.parent_id);
            } else if (!parentId && sectionData.pid) {
                parentId = this.extractValue(sectionData.pid);
            }

            console.log('id=',id,'parentId',parentId)
            
            // Extract Brand and Model from the section data
            let Brand = '';
            let Model = '';
            
            // Extract Brand - look for common fields that might contain brand information
            if (sectionData.brand) {
                Brand = this.extractValue(sectionData.brand);
            } else if (sectionData.name) {
                Brand = this.extractValue(sectionData.name);
            } else if (sectionData.title) {
                Brand = this.extractValue(sectionData.title);
            } else if (sectionData.label) {
                Brand = this.extractValue(sectionData.label);
            } else if (sectionData.value) {
                Brand = this.extractValue(sectionData.value);
            }
            
            // Extract Model - look for common fields that might contain model information
            if (sectionData.model) {
                Model = this.extractValue(sectionData.model);
            } else if (sectionData.description) {
                Model = this.extractValue(sectionData.description);
            } else if (sectionData.name && !Brand) { // If name wasn't used as brand, it might be model
                Model = this.extractValue(sectionData.name);
            } else if (sectionData.title && !Brand) { // If title wasn't used as brand, it might be model
                Model = this.extractValue(sectionData.title);
            }
            
            // Insert into the new table only if we have meaningful data
            if (id && (Brand || Model)) {
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
                    const tempSection = { data: subsection };
                    await this.processSectionRecursive([tempSection], db, id);
                }
            }
        }
    }

    extractValue(value) {

        if (value && typeof value === 'object' && value._) {
            console.log(111, value)
            // Handle XML element with attributes: { _: 'value', $: {...} }
            return value._.toString().trim();

        }
        if (value && typeof value === 'object') {
            console.log(222, value)
            // If it's an object but not the attribute format, convert to string
            return JSON.stringify(value);
        }
        console.log(333, value)
        return value ? value.toString().trim() : '';
    }

    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
}

export default new SectionsProcessingService();