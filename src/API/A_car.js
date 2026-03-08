// src/xml_import/cityListService.js
class CityListService {
    async getCitiesFromACar() {
        const db = global.db
        try {
            // Query the a_car table for distinct cities
            // language=SQLite
            const cityResults = await db.all(`
                SELECT DISTINCT prop_city as city
                FROM a_car
                WHERE prop_city IS NOT NULL
                  AND prop_city != ''
                ORDER BY prop_city ASC
            `);

            // Extract just the city names from the results
            const cities = cityResults.map(result => result.city);

            return cities;
        } catch (error) {
            console.error('Error retrieving cities from a_car table:', error.message);
            throw error;
        }
    }
}

export default new CityListService();
