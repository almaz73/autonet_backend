
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

            // Create a new table for processed sections
            await db.exec(`                CREATE TABLE IF NOT EXISTS processed_sections (
                    id TEXT PRIMARY KEY,
                    parentId TEXT,
                    brand TEXT,
                    model TEXT
                )
            `);

            // Clear existing data in processed_sections table
            await db.exec('DELETE FROM processed_sections');

            // Process sections: separate brands (id="ap_probeg") from models
            for (const section of parsedSections) {
                const sectionData = section.data;

                // If section data has an id attribute
                if (sectionData.id) {
                    if (sectionData.id === "ap_probeg") {
                        // These are brands - process subsections as brands
                        if (sectionData.subsection) {
                            const subsections = Array.isArray(sectionData.subsection)
                                ? sectionData.subsection
                                : [sectionData.subsection];

                            for (const subSection of subsections) {
                                if (subSection) {
                                    const id = this.getValue(subSection.id) || this.generateId();
                                    const parentId = this.getValue(sectionData.id) || '';
                                    const brand = this.getValue(subSection.name || subSection.title || subSection.label || subSection.value || '');

                                    await db.run(
                                        'INSERT OR REPLACE INTO processed_sections (id, parentId, brand, model) VALUES (?, ?, ?, ?)',
                                        [id, parentId, brand, '']
                                    );
                                }
                            }
                        }
                    } else if (sectionData.id !== "ap_probeg") {
                        // These are models (excluding the special "ap_probeg" section)
                        const id = this.getValue(sectionData.id) || this.generateId();
                        const parentId = this.getValue(sectionData.parentId || sectionData.parent || sectionData.groupId || '') || '';
                        const model = this.getValue(sectionData.name || sectionData.title || sectionData.label || sectionData.value || '');

                        // Try to determine the brand from parent or context
                        let brand = '';

                        // If there's a reference to a parent brand section, get its name
                        if (parentId) {
                            const parentBrandRecord = await db.get(
                                'SELECT brand FROM processed_sections WHERE id = ?',
                                [parentId]
                            );
                            if (parentBrandRecord) {
                                brand = parentBrandRecord.brand;
                            }
                        }

                        await db.run(
                            'INSERT OR REPLACE INTO processed_sections (id, parentId, brand, model) VALUES (?, ?, ?, ?)',
                            [id, parentId, brand, model]
                        );
                    }
                }
            }

            // Get the processed data
            const processedData = await db.all('SELECT * FROM processed_sections');

            return {
                success: true,
                message: 'Sections processed successfully',
                count: processedData.length,
                data: processedData
            };
        } catch (error) {
            console.error('Error processing sections:', error);
            throw error;
        }
    }

    getValue(value) {
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

    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }
}

export default new SectionsProcessingService();