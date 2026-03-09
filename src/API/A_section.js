// src/xml_import/sectionBrandService.js
class SectionBrandService {
    async getBrandList() {
        const db = global.db

        try {
            // Query the a_section table for records that have a brand value
            // language=SQLite
            const sections = await db.all(`
                SELECT id, brand as Brand
                FROM a_section
                WHERE brand IS NOT NULL 
                AND brand != ''
            `);

            // Return the formatted result
            return sections.map(section => ({
                id: section.id,
                name: section.Brand
            }));
        } catch (error) {
            console.error('Error retrieving sections with brand:', error.message);
            throw error;
        }
    }

    async getModelList(id) {
        const db = global.db

        try {
            // Query the a_section table for records where parentId matches the provided brand ID
            // language=SQLite
            const sections = await db.all(`
                SELECT id, model as Model
                FROM a_section
                WHERE parentId = ?
                AND model IS NOT NULL
                AND model != ''
            `, [id]);

            return sections.map(section =>{
                return ({
                id: section.id,
                name: section.Model
            })});
        } catch (error) {
            console.error('Error retrieving models for brand:', error.message);
            throw error;
        }
    }
}

export default new SectionBrandService();
