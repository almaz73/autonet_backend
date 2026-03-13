// src/api/GetListService.js
class GetListService {
    async getList(filter) {
        const limit = filter.limit || 10; // Default limit
        const offset = filter.offset || 0; // Default offset

        console.log('filter', filter)

        const db = global.db;
        try {
            //  language=SQLite
            let baseQuery = `
                SELECT ac.id,
                       ac.prop_brand             as brand,
                       ac.prop_model             as model,
                       ac.prop_year              as yearReleased,
                       ac.price,
                       ac.prop_milleage          as milleage,
                       ac.prop_color             as color,
                       ac.prop_engine_capacity   as engineCapacity,
                       ac.prop_engine_type       as engineType,
                       ac.prop_power             as enginePower,
                       ac.prop_transmission_type as gearboxType,
                       ac.prop_drive             as driveType,
                       ac.prop_body_type         as bodyType,
                       ac.prop_address           as fullAddress,
                       ac.prop_city              as city,
                       ac.prop_steering_wheel    as wheelType,
                       ac.images

                FROM a_car ac
                         LEFT JOIN a_section ast ON ac.section = ast.id
            `;

            // Build WHERE clause dynamically based on filters
            const whereConditions = [];
            const params = [];

            if (filter.city) {
                whereConditions.push('UPPER(ac.prop_city) = UPPER(?)');
                params.push(filter.city);
            }

            if (filter.yearReleasedFrom) {
                whereConditions.push('ac.prop_year >= ?');
                params.push(filter.yearReleasedFrom);
            }

            if (filter.yearReleasedTo) {
                whereConditions.push('ac.prop_year <= ?');
                params.push(filter.yearReleasedTo);
            }

            if (filter.priceFrom) {
                whereConditions.push('ac.price >= ?');
                params.push(filter.priceFrom);
            }

            if (filter.priceTo) {
                whereConditions.push('ac.price <= ?');
                params.push(filter.priceTo);
            }

            if (filter.milleageFrom) {
                whereConditions.push('ac.prop_milleage >= ?');
                params.push(filter.milleageFrom);
            }

            if (filter.milleageTo) {
                whereConditions.push('ac.prop_milleage <= ?');
                params.push(filter.milleageTo);
            }

            if (filter.bodyType) {
                whereConditions.push('UPPER(ac.prop_body_Type) = UPPER(?)');
                params.push(filter.bodyType)
            }

            if (filter.engineType) {
                whereConditions.push('UPPER(ac.prop_engine_type) = UPPER(?)');
                params.push(filter.engineType)
            }

            if (filter.driveType) {
                whereConditions.push('UPPER(ac.prop_drive) = UPPER(?)');
                params.push(filter.driveType)
            }

            if (filter.wheelType) {
                whereConditions.push('UPPER(ac.prop_steering_wheel) = UPPER(?)');
                params.push(filter.wheelType)
            }

            if (filter.engineCapacity) {
                whereConditions.push('UPPER(ac.prop_steering_wheel) = UPPER(?)');
                params.push(filter.engineCapacity)
            }


            if (filter.brand) {
                whereConditions.push('UPPER(ac.prop_brand) = UPPER(?)');
                params.push(filter.brand)
            }

            if (filter.modelId) {
                whereConditions.push('ac.section = ?');
                params.push(filter.modelId)
            }

            if (filter.color) {
                whereConditions.push('UPPER(ac.prop_color) = UPPER(?)');
                params.push(filter.color)
            }

            let query = baseQuery;

            if (whereConditions.length > 0) {
                query += 'WHERE ' + whereConditions.join(' AND ');
            }

            // Add pagination
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            // Execute the query with the parameters
            console.log('params', params)
            const items = await db.all(query, params);

            items.map(el => {
                try {
                    el.images = el.images ? el.images.split(',').map(url => url.trim()) : [];
                    el.images.length = 5
                } catch (error) {
                    console.error('Error parsing images for car ID ' + el.id + ':', error.message);
                    el.images = [];
                }
            });

            // Build count query with the same filters
            // language=SQLite
            let countQuery = 'SELECT COUNT(*) as totalCount FROM a_car ac LEFT JOIN a_section ast ON ac.section = ast.id';
            let countParams = [];

            if (whereConditions.length > 0) {
                countQuery += ' WHERE ' + whereConditions.join(' AND ');
                // Use only the filter parameters for count query (not limit/offset)
                countParams = params.slice(0, -2); // Remove limit and offset from params
            }

            const countResult = await db.get(countQuery, countParams);
            const totalCount = countResult.totalCount;

            return {
                items,
                totalCount
            };
        } catch (error) {
            console.error('Error retrieving car list with pagination:', error.message);
            throw error;
        }
    }
}

export default new GetListService();
