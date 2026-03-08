export async function insertIntoSectionTable(section, db) {

    console.log('::::section', section)

    // Extract values from the section object, handling nested properties
    const id = extractValue(section, ['id', '_id']) || generateSectionId(section);
    const name = extractValue(section, ['name', 'title']);
    const title = extractValue(section, ['title', 'name']);
    const address = extractValue(section, ['address', 'addr']);
    const phones = extractValue(section, ['phones', 'phone', 'telephone']);
    const schedule = extractValue(section, ['schedule', 'work_time', 'opening_hours']);
    const services = extractValue(section, ['services', 'service_list']);
    const coordinates = extractValue(section, ['coordinates', 'coords', 'location']);
    const work_time = extractValue(section, ['work_time', 'working_hours', 'schedule']);
    const city = extractValue(section, ['city', 'location_city']);
    const region = extractValue(section, ['region', 'location_region']);
    const district = extractValue(section, ['district', 'location_district']);
    const brand = extractValue(section, ['brand', 'brand_name']);
    const type = extractValue(section, ['type', 'section_type']);
    const subtype = extractValue(section, ['subtype', 'sub_type']);
    const logo = extractValue(section, ['logo', 'logo_url']);
    const image = extractValue(section, ['image', 'img', 'picture']);
    const rating = extractNumericValue(section, ['rating', 'score']);
    const reviews_count = extractNumericValue(section, ['reviews_count', 'review_count']);
    const data = JSON.stringify(section);

    // Insert intothe structured section_table
    // language=SQLite
    await db.run(`
        INSERT
            OR
        REPLACE
        INTO section_table (id, name, title, address, phones, schedule, services, coordinates,
                            work_time, city, region, district, brand, type, subtype, logo,
                            image, rating, reviews_count, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, name, title, address, phones, schedule, services, coordinates,
        work_time, city, region, district, brand, type, subtype, logo,
        image, rating, reviews_count, data
    ]);
}

export async function insertIntoCarsTable(car, db) {
    // Extract values from the car object, handling nested properties
    const id = extractValue(car, ['id', '_id']) || generateCarId(car);
    const name = extractValue(car, ['name', 'title', 'model']);
    const section = extractValue(car, ['section', 'section_id']);
    const price = extractNumericValue(car, ['price', 'cost']);
    const prop_milleage = extractNumericValue(car, ['prop_milleage', 'mileage', 'mileage_value']);
    const prop_year = extractNumericValue(car, ['prop_year', 'year', 'production_year']);
    const prop_color = extractValue(car, ['prop_color', 'color', 'colour']);
    const prop_engine_capacity = extractNumericValue(car, ['prop_engine_capacity', 'engine_capacity', 'engine_size']);
    const prop_engine_type = extractValue(car, ['prop_engine_type', 'engine_type', 'fuel_type']);
    const prop_power = extractNumericValue(car, ['prop_power', 'power', 'horsepower']);
    const prop_transmission_type = extractValue(car, ['prop_transmission_type', 'transmission_type', 'gearbox']);
    const prop_drive = extractValue(car, ['prop_drive', 'drive', 'drive_type']);
    const prop_body_type = extractValue(car, ['prop_body_type', 'body_type', 'car_body']);
    const prop_steering_wheel = extractValue(car, ['prop_steering_wheel', 'steering_wheel', 'wheel_position']);
    const prop_address = extractValue(car, ['prop_address', 'address', 'location']);
    const prop_options = extractValue(car, ['prop_options', 'options', 'complectation']);
    const prop_guarantee = extractValue(car, ['prop_guarantee', 'guarantee', 'warranty']);
    const prop_city = extractValue(car, ['prop_city', 'city', 'location_city']);
    const prop_brand = extractValue(car, ['prop_brand', 'brand', 'make']);
    const prop_model = extractValue(car, ['prop_model', 'model', 'car_model']);
    const prop_VIN = extractValue(car, ['prop_VIN', 'VIN', 'vin']);

    // Handle images -convert array to JSON string if it exists
    let images = null;
    if (car.images && car.images.image) {
        const imageArray = Array.isArray(car.images.image) ? car.images.image : [car.images.image];
        images = JSON.stringify(imageArray);
    } else if (Array.isArray(car.images)) {
        images = JSON.stringify(car.images);
    } else if (typeof car.images === 'string') {
        images = JSON.stringify([car.images]);
    }

    // Insert into the structured cars_table
    // language=SQLite
    await db.run(`
        INSERT
            OR
        REPLACE
        INTO cars_table (id, name, section, price, prop_milleage, prop_year, prop_color,
                         prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
                         prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
                         prop_guarantee, prop_city, prop_brand, prop_model, prop_VIN, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, name, section, price, prop_milleage, prop_year, prop_color,
        prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
        prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
        prop_guarantee, prop_city, prop_brand, prop_model, prop_VIN, images
    ]);
}


//Methodto find and process cars in case they're not under catalog
export async function findAndProcessCars(data, db, path = '') {
    let count = 0;

    if (data && typeof data === 'object') {
        // Check if this object contains carsif (data.cars && data.cars.car) {
        const cars = Array.isArray(data.cars.car)
            ? data.cars.car
            : [data.cars.car];
        count += await this.insertCars(cars, db);
    }

    // Also check for cars arrays that mightnot be nested in a "cars" container
    for (const key in data) {
        if (key.toLowerCase() === 'car' && Array.isArray(data[key])) {
            count += await this.insertCars(data[key], db);
        } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
            //Lookfor individual car objects
            if (looksLikeCarObject(data[key])) {
                // This looks like a car object
                count += await this.insertCars([data[key]], db);
            }
            count += await this.findAndProcessCars(data[key], db, `${path}.${key}`);
        } else if (Array.isArray(data[key])) {
            //Process arrays that might contain cars
            for (const item of data[key]) {
                if (item && typeof item === 'object' && looksLikeCarObject(item)) {
                    count += await insertCars([item], db);
                }
            }
        }
    }
}

// Helper method to determine if an object looks like a car object
function looksLikeCarObject(obj) {
    // Check forcommon car properties
    return obj && (
        obj.name ||
        obj.model ||
        obj.prop_VIN || obj.price ||
        obj.year ||
        obj.mileage ||
        obj.color ||
        obj.engine_capacity ||
        obj.VIN
    );
}

// Helper method to extract a value from an object using multiple possible keys
function extractValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
            return String(obj[key]);
        }
    }
    return null;
}

// Helper method to extract a numeric value from an object using multiple possiblekeys
function extractNumericValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
            const value = parseFloat(obj[key]);
            return isNaN(value) ? null : value;
        }
    }
    return null;
}

// Helper method to generatea uniqueID for acar ifno ID is provided
function generateCarId(car) {
    // Generate a unique ID based on car properties
    const name = extractValue(car, ['name', 'title', 'model']) || '';
    const year = extractNumericValue(car, ['prop_year', 'year']) || '';
    const vin = extractValue(car, ['prop_VIN', 'VIN']) || '';
    return `${name}_${year}_${vin}`.replace(/\s+/g, '_').substring(0, 100);
}

// Helper method to generate a unique ID fora section if no ID is provided
function generateSectionId(section) {
    // Generate a unique ID based on section properties
    const name = extractValue(section, ['name', 'title']) || '';
    const address = extractValue(section, ['address']) || '';
    return `${name}_${address}`.replace(/\s+/g, '_').substring(0, 100);
}

// Helper method to get a name for logging purposes froma car
function getCarName(car) {
    return car.name || car.title || car.model || car.id || 'Unnamed Car';
}

export async function insertCars(cars, db) {
    let insertedCount = 0;
    for (const car of cars) {
        try {
            // Convert the car object to a JSON string to store all fields
            const carData = JSON.stringify(car);

            // Check if car already exists (using a hash of the data to prevent duplicates)
            // language=SQLite
            const existingCar = await db.get(
                'SELECT id FROM cars WHERE data = ?', [carData]
            );

            if (!existingCar) {
                // language=SQLite
                await db.run(
                    'INSERT INTO cars (data) VALUES (?)',
                    [carData]
                );

                // Insert into thestructured cars_table as well
                await insertIntoCarsTable(car, db);
                insertedCount++;
                console.log(`Inserted car: ${getCarName(car)}`);
            } else {
                console.log(`Skipped duplicate car: ${getCarName(car)}`);
            }
        } catch (error) {
            console.error('Error inserting car:', error.message, car);
        }
    }

    return insertedCount;
}