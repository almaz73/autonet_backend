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
            return cityResults.map(result => result.city);;
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
            return gearboxResults.map((result, index) => ({
                value: index,
                title: result.prop_transmission_type
            }));
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
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_engine_type
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getDriveTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`                SELECT DISTINCT prop_drive
                FROM a_car
                WHERE prop_drive IS NOT NULL 
                AND prop_drive != ''
                ORDER BY prop_drive ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_drive
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getWheelTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`                SELECT DISTINCT prop_steering_wheel
                FROM a_car
                WHERE prop_steering_wheel IS NOT NULL 
                AND prop_steering_wheel != ''
                ORDER BY prop_steering_wheel ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_steering_wheel
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getBodyTypes() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`                SELECT DISTINCT prop_body_type
                FROM a_car
                WHERE prop_body_type IS NOT NULL 
                AND prop_body_type != ''
                ORDER BY prop_body_type ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_body_type
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }

    async getColorList() {
        const db = global.db
        try {
            // Query the a_car table for distinct engine types
            // language=SQLite
            const engineResults = await db.all(`                SELECT DISTINCT prop_color
                FROM a_car
                WHERE prop_color IS NOT NULL 
                AND prop_color != ''
                ORDER BY prop_color ASC
            `);

            // Format the results as {value, title} where value is the index and title is the content
            return engineResults.map((result, index) => ({
                value: index,
                title: result.prop_color
            }));
        } catch (error) {
            console.error('Error retrieving engine types from a_car table:', error.message);
            throw error;
        }
    }
}

export default new CityListService();
