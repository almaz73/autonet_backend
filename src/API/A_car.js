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

    async getGearboxTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct transmission types
            // language=SQLite
            const gearboxResults = await db.all(`
                SELECT DISTINCT prop_transmission_type
                FROM a_car
                WHERE prop_transmission_type IS NOT NULL
                  AND prop_transmission_type != ''
                ORDER BY prop_transmission_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            const gearboxTypes = gearboxResults.map((result, index) => ({
                value: index,
                title: result.prop_transmission_type
            }));

            return gearboxTypes;
        } catch (error) {
            console.error('Error retrieving gearbox types from a_car table:', error.message);
            throw error;
        }
    }

    async getEngineTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`                SELECT DISTINCT prop_engine_type
                FROM a_car
                WHERE prop_engine_type IS NOT NULL 
                AND prop_engine_type != ''
                ORDER BY prop_engine_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            const engineTypes = engineResults.map((result, index) => ({
                value: index,
                title: result.prop_engine_type
            }));

            return engineTypes;
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }
}

export default new CityListService();
