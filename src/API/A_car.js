class CityListService {
    async getFullAutoInfo(guid) {
        const db = global.db
        try {
            // Query the a_car table and join with a_section to get the brandId
            // language=SQLite
            const result = await db.get(`
                SELECT ac.id,
                       ac.price,
                       sec.id                    as brandId,
                       ac.prop_milleage          as milleage,
                       ac.prop_color             as color,
                       ac.prop_engine_capacity   as engineCapacity,
                       ac.prop_engine_type       as engineType,
                       ac.prop_power             as enginePower,
                       ac.prop_transmission_type as gearboxType,
                       ac.prop_drive             as driveType,
                       ac.prop_body_type         as bodyType,
                       ac.prop_steering_wheel    as wheelType,
                       ac.prop_address           as fullAddress,
                       ac.prop_options           as сonfiguration,
                       ac.images

                FROM a_car ac
                         LEFT JOIN a_section sec ON ac.prop_brand = sec.brand
                WHERE ac.id = ?
            `, [guid]);

            if (!result) {
                console.log('No car found with guid:', guid);
                return null; // Return null if no car is found with the given guid
            }

            return result;
        } catch (error) {
            console.error('Error retrieving car info from a_car table:', error.message);
            throw error;
        }
    }


// ... existing code ...
    async getCarCount() {
        const db = global.db
        try {
            // Query the a_section table joined with a_car to get brand counts
            // language=SQLite
            const results = await db.all(`
                SELECT sec.id as brandId,
                       COUNT(ac.id) as count,
                       sec.brand as name
                FROM a_section sec
                LEFT JOIN a_car ac ON sec.brand = ac.prop_brand
                WHERE sec.brand IS NOT NULL AND sec.brand != ''
                GROUP BY sec.id, sec.brand
                ORDER BY sec.brand
            `);

            return results;
        } catch (error) {
            console.error('Error retrieving car count by brand from a_car and a_section tables:', error.message);
            throw error;
        }
    }

// ... existing code ...



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
--                 ORDER BY prop_city ASC
            `);

            // Extract just the city names from the results
            return cityResults.map(result => result.city);
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
--                 ORDER BY prop_transmission_type ASC
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
            const engineResults = await db.all(`                
                SELECT DISTINCT prop_engine_type
                FROM a_car
                WHERE prop_engine_type IS NOT NULL 
                AND prop_engine_type != ''
--                 ORDER BY prop_engine_type ASC
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
            const engineResults = await db.all(`                
                SELECT DISTINCT prop_drive
                FROM a_car
                WHERE prop_drive IS NOT NULL 
                AND prop_drive != ''
--                 ORDER BY prop_drive ASC
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
            const engineResults = await db.all(`                
                SELECT DISTINCT prop_steering_wheel
                FROM a_car
                WHERE prop_steering_wheel IS NOT NULL 
                AND prop_steering_wheel != ''
--                 ORDER BY prop_steering_wheel ASC
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
            const engineResults = await db.all(`                
                SELECT DISTINCT prop_body_type
                FROM a_car
                WHERE prop_body_type IS NOT NULL 
                AND prop_body_type != ''
--                 ORDER BY prop_body_type ASC
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
            const engineResults = await db.all(`                
                SELECT DISTINCT prop_color
                FROM a_car
                WHERE prop_color IS NOT NULL 
                AND prop_color != ''
--                 ORDER BY prop_color ASC
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
