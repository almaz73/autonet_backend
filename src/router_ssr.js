import Router from 'express'
import A_car from "./API/A_car.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {manifest_links} from './constants.js';
import Controllers from "./xml_import/Controllers.js";



// bd routes
const router = new Router()



// тут нужно будет отдавать страницу ыеликом собранную на сервере.. для индексации
// Route for car details page
router.get('/cars/car_.html', async (req, res) => {
    console.log('43444 = ',4444)

    let manifest = manifest_links['cars/index.html']
    // console.log('manifest = ',manifest)

    
    

    try {
        const carId = req.query.id;
        let carData = await A_car.getFullAutoInfo(carId)
        // console.log('carData = ',carData)



        if (!carData) {
            return res.status(404).send('Car not found');
        }

        // Generate title and description based on car data
        const title = `${carData.brand} ${carData.model} ${carData.yearReleased}  ${carData.prop_address?' - '+carData.prop_address:''}`;
        const description = `Купить ${carData.brand} ${carData.model} ${carData.yearReleased} года выпуска с пробегом в ${carData.city} за ${carData.price} рублей. Характеристики: ${carData.engineType} двигатель, ${carData.enginePower} л.с., ${carData.gearboxType} коробка передач, ${carData.driveType} привод.`;

        console.log('title = ',title)
        console.log('description = ',description)


        // Render the car template with car data
        res.render('car', {
            title,
            description,
            car: carData
        });
    } catch (error) {
        console.error('Error rendering car page:', error);
        res.status(500).send('Internal Server Error');
    }
});



export default router;