// src/api/GetListService.js
class GetListService {
    async getList(query) {
        const limit = query.limit || 10; // Default limit
        const offset = query.offset || 0; // Default offset

        const db = global.db;
        try {
            // Query the a_car table with limit and offset, joining with a_section
            // language=SQLite
            const query = `
                SELECT ac.id,
                       ac.prop_brand            as brand,
                       ac.prop_model            as model,
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
                       ac.prop_steering_wheel    as wheelType,
                       ac.images

                FROM a_car ac
                         LEFT JOIN a_section ast ON ac.section = ast.id
                LIMIT ? OFFSET ?
            `;

            // Execute the query with the provided limit and offset
            const items = await db.all(query, [limit, offset]);

            items.map(el => {
                try {
                    el.images = el.images ? el.images.split(',').map(url => url.trim()) : [];
                    el.images.length = 5
                } catch (error) {
                    console.error('Error parsing images for car ID ' + el.id + ':', error.message);
                    el.images = [];
                }
            });

            // Get the total count for the pagination
            // language=SQLite
            const countResult = await db.get('SELECT COUNT(*) as totalCount FROM a_car ac LEFT JOIN a_section ast ON ac.section = ast.id');
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
