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
                // console.log(`Inserted car: ${getCarName(car)}`);
            } else {
                console.log(`Skipped duplicate car: ${getCarName(car)}`);
            }
        } catch (error) {
            console.error('Error inserting car:', error.message, car);
        }
    }

    return insertedCount;
}

async function insertIntoCarsTable(car, db) {
    // Extract values from the car object, handling nested properties
    const id = extractValue(car, ['id', 'Id', '_id']) || generateCarId(car);
    const name = extractValue(car, ['Наименование', 'name', 'title', 'model']);
    const section = extractValue(car, ['section', 'section_id']);
    const price = extractNumericValue(car, ['price', 'cost']);
    const prop_milleage = extractNumericValue(car, ['Пробег', 'prop_milleage', 'mileage', 'mileage_value']);
    const prop_year = extractNumericValue(car, ['ГодВыпуска', 'year', 'production_year']);
    const prop_color = extractValue(car, ['Цвет', 'color', 'colour']);
    const prop_engine_capacity = extractNumericValue(car, ['ОбъемДвигателя', 'engine_capacity']);
    const prop_engine_type = extractValue(car, ['ТипДвигателя', 'engine_type', 'fuel_type']);
    const prop_power = extractNumericValue(car, ['Мощность', 'power']);
    const prop_transmission_type = extractValue(car, ['ТипКПП', 'transmission_type', 'gearbox']);
    const prop_drive = extractValue(car, ['Привод', 'drive', 'drive_type']);
    const prop_body_type = extractValue(car, ['ТипКузова', 'body_type', 'car_body']);
    const prop_steering_wheel = extractValue(car, ['Руль', 'steering_wheel', 'wheel_position']);
    const prop_address = extractValue(car, ['Адрес', 'address', 'location']);
    const prop_options = extractValue(car, ['Опции', 'options', 'complectation']);
    const prop_city = extractValue(car, ['Город', 'city', 'location_city']);
    const prop_brand = extractValue(car, ['Марка', 'brand', 'make']);
    const prop_model = extractValue(car, ['Модель', 'model', 'car_model']);
    const prop_VIN = extractValue(car, ['VIN', 'vin']);

    let images = null;
    let imgArr = []

    if(car && car.Images && car.Images.Image) {
        car.Images.Image.forEach((img) => imgArr.push(img.$.url))
        if (imgArr) images = imgArr.join(', ')
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
                         prop_city, prop_brand, prop_model, prop_VIN, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, name, section, price, prop_milleage, prop_year, prop_color,
        prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
        prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
        prop_city, prop_brand, prop_model, prop_VIN, images
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
        if (obj && obj.properties && obj.properties[key] !== undefined && obj.properties[key] !== null) {
            return String(obj.properties[key])
        }

        if (obj && obj[key] !== undefined && obj[key] !== null) {
            return String(obj[key]);
        }
    }
    return null;
}

// Helper method to extract a numeric value from an object using multiple possiblekeys
function extractNumericValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj && obj.properties && obj.properties[key] !== undefined && obj.properties[key] !== null) {
            const value = parseFloat(obj.properties[key]);
            return isNaN(value) ? null : value;
        }

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
    const name = extractValue(car, ['Наименование', 'name', 'Name']) || '';
    const year = extractNumericValue(car, ['ГодВыпуска', 'Year', 'year']) || '';
    const vin = extractValue(car, ['VIN', 'vin', 'Vin']) || '';
    return `${name}_${year}_${vin}`.replace(/\s+/g, '_').substring(0, 100);
}


// Helper method to get a name for logging purposes froma car
function getCarName(car) {
    return car.name || car.title || car.model || car.id || 'Unnamed Car';
}

