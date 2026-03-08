class CityListService {


    // // ... existing code ...
    // async getGearboxTypes() {
    //     const db = global.db
    //     try {
    //         // Query the a_car table for distinct transmission types
    //         // language=SQLite
    //         const gearboxResults = await db.all(`
    //             SELECT DISTINCT prop_transmission_type
    //             FROM a_car
    //             WHERE prop_transmission_type IS NOT NULL
    //             AND prop_transmission_type != ''
    //             ORDER BY prop_transmission_type ASC
    //         `);
    //
    //         // Format the results as {value, title} where value is the index and title is the content
    //         const gearboxTypes = gearboxResults.map((result, index) => ({
    //             value: index,
    //             title: result.prop_transmission_type
    //         }));
    //
    //         return gearboxTypes;
    //     } catch (error) {
    //         console.error('Error retrieving gearbox types from a_car table:', error.message);
    //         throw error;
    //     }
    // }
    //
    // async getEngineTypes() {
    //     const db = global.db
    //     try {
    //         // Query the a_car table for distinct engine types
    //         // language=SQLite
    //         const engineResults = await db.all(`
    //             SELECT DISTINCT prop_engine_type
    //             FROM a_car
    //             WHERE prop_engine_type IS NOT NULL
    //             AND prop_engine_type != ''
    //             ORDER BY prop_engine_type ASC
    //         `);
    //
    //         // Format the results as {value, title} where value is the index and title is the content
    //         const engineTypes = engineResults.map((result, index) => ({
    //             value: index,
    //             title: result.prop_engine_type
    //         }));
    //
    //         return engineTypes;
    //     } catch (error) {
    //         console.error('Error retrieving engine types from a_car table:', error.message);
    //         throw error;
    //     }
    // }
    //
    // async getList( filters = {}) {
    //     const db = global.db
    //     try {
    //         const {
    //             limit,
    //             offset,
    //             brandId,
    //             modelId,
    //             city,
    //             gearboxType,
    //             engineType,
    //             driveType,
    //             wheelType,
    //             bodyType,
    //             colorId,
    //             yearReleasedFrom,
    //             yearReleasedTo,
    //             priceTo,
    //             priceFrom,
    //             milleageFrom,
    //             milleageTo,
    //             engineCapacity
    //         } = filters;
    //
    //         // Build the base query with JOIN to a_section table for brand/model filtering
    //         // language=SQLite
    //         let query = `
    //             SELECT
    //                 ac.id,
    //                 ac.prop_brand as brand,
    //                 ac.prop_model as model,
    //                 ac.prop_year as yearReleased,
    //                 ac.price,
    //                 ac.prop_milleage as milleage,
    //                 ac.prop_power as enginePower,
    //                 ac.prop_engine_capacity as engineCapacity,
    //                 ac.prop_transmission_type as gearboxType,
    //                 ac.prop_body_type as bodyType,
    //                 ac.prop_engine_type as engineType,
    //                 ac.prop_drive as driveType,
    //                 ac.prop_address as fullAddress,
    //                 ac.images
    //             FROM a_car ac
    //         `;
    //
    //         // Add JOIN condition if brandId or modelId is provided
    //         if (brandId || modelId) {
    //             query += ` JOIN a_section ast ON ac.section = ast.id `;
    //         }
    //
    //         // Build WHERE clause
    //         const whereConditions = [];
    //         const params = [];
    //
    //         if (brandId) {
    //             whereConditions.push('ast.id = ?');
    //             params.push(brandId);
    //         }
    //
    //         if (modelId) {
    //             whereConditions.push('ast.id = ?');
    //             params.push(modelId);
    //         }
    //
    //         if (city) {
    //             whereConditions.push('ac.prop_city = ?');
    //             params.push(city);
    //         }
    //
    //         if (gearboxType) {
    //             whereConditions.push('ac.prop_transmission_type = ?');
    //             params.push(gearboxType);
    //         }
    //
    //         if (engineType) {
    //             whereConditions.push('ac.prop_engine_type = ?');
    //             params.push(engineType);
    //         }
    //
    //         if (driveType) {
    //             whereConditions.push('ac.prop_drive = ?');
    //             params.push(driveType);
    //         }
    //
    //         if (wheelType) {
    //             whereConditions.push('ac.prop_steering_wheel = ?');
    //             params.push(wheelType);
    //         }
    //
    //         if (bodyType) {
    //             whereConditions.push('ac.prop_body_type = ?');
    //             params.push(bodyType);
    //         }
    //
    //         if (colorId) {
    //             whereConditions.push('ac.prop_color = ?');
    //             params.push(colorId);
    //         }
    //
    //         if (yearReleasedFrom) {
    //             whereConditions.push('ac.prop_year >= ?');
    //             params.push(yearReleasedFrom);
    //         }
    //
    //         if (yearReleasedTo) {
    //             whereConditions.push('ac.prop_year <= ?');
    //             params.push(yearReleasedTo);
    //         }
    //
    //         if (priceTo) {
    //             whereConditions.push('ac.price <= ?');
    //             params.push(priceTo);
    //         }
    //
    //         if (priceFrom) {
    //             whereConditions.push('ac.price >= ?');
    //             params.push(priceFrom);
    //         }
    //
    //         if (milleageFrom) {
    //             whereConditions.push('ac.prop_milleage >= ?');
    //             params.push(milleageFrom);
    //         }
    //
    //         if (milleageTo) {
    //             whereConditions.push('ac.prop_milleage <= ?');
    //             params.push(milleageTo);
    //         }
    //
    //         if (engineCapacity) {
    //             whereConditions.push('ac.prop_power <= ?');
    //             params.push(engineCapacity);
    //         }
    //
    //         // Add WHERE conditions to query
    //         if (whereConditions.length > 0) {
    //             query += ' WHERE ' + whereConditions.join(' AND ');
    //         }
    //
    //         // Add ORDER BY and LIMIT clauses
    //         query += ' ORDER BY ac.id';
    //
    //         if (limit) {
    //             query += ' LIMIT ?';
    //             params.push(limit);
    //
    //             if (offset) {
    //                 query += ' OFFSET ?';
    //                 params.push(offset);
    //             }
    //         }
    //
    //         // Execute the query to get the filtered results
    //         const items = await db.all(query, params);
    //
    //         // Get the total count for the pagination
    //         let countQuery = `SELECT COUNT(*) as totalCount FROM a_car ac`;
    //         let countParams = [];
    //
    //         if (brandId || modelId) {
    //             countQuery += ` JOIN a_section ast ON ac.section = ast.id `;
    //         }
    //
    //         if (whereConditions.length > 0) {
    //             countQuery += ' WHERE ' + whereConditions.join(' AND ');
    //             countParams = [...params]; // Copy the params for count query (excluding limit and offset)
    //
    //             // Remove limit and offset from count params
    //             if (limit) {
    //                 countParams.pop(); // Remove limit
    //                 if (offset) {
    //                     countParams.pop(); // Remove offset
    //                 }
    //             }
    //         }
    //
    //         const countResult = await db.get(countQuery, countParams);
    //         const totalCount = countResult.totalCount;
    //
    //         return {
    //             items,
    //             totalCount
    //         };
    //     } catch (error) {
    //         console.error('Error retrieving filtered car list:', error.message);
    //         throw error;
    //     }
    // }





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
