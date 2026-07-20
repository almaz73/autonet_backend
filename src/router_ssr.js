import Router from 'express'
import A_car from "./API/A_car.js";
import {manifest_links} from './constants.js';


const router = new Router()



// отдаем страницу собранную на сервере

router.get('/cars/:brand/:model/:text', carAlone);
//http://localhost:3000/cars/Chevrolet/Camaro/2021-Tver-3250000-66525km?id=2b324b07-4ed2-11f1-816e-00505601020a

async function carAlone(req, res)  {
    let manifest = manifest_links['cars/car.html']

    if (!manifest) return res.status(404).send('Vite manifest not found');

    let js1 = manifest.imports && manifest.imports[0].slice(1)
    let js2 = manifest.imports && manifest.imports[1].slice(1)
    let js3 = manifest.imports && manifest.imports[2].slice(1)
    let js4 = manifest.imports && manifest.imports[3].slice(1)
    let js5 = manifest.imports && manifest.imports[4].slice(1)
    let carjs = manifest.file

    let css1
    let css2 = manifest.css && manifest.css[0]
    let css3 = manifest.css && manifest.css[1]
    for (let manifestKey in manifest_links) {
        if (manifestKey.includes('_style-') && manifestKey.includes('.css')) css1 = manifestKey.slice(1)
    }


    try {
        const carId = req.query.id || req.params.id;
        console.log('carId = ',carId)
        let carData = await A_car.getFullAutoInfo(carId)

        if (!carData) {
            return res.render('404', {confirm: '☹ ВОЗМОЖНО АВТОМОБИЛЬ СНЯТ С ПРОДАЖИ'})
        }

        // Generate title and description based on car data
        const title = `${carData.brand} ${carData.model} ${carData.yearReleased}  ${carData.prop_address?' - '+carData.prop_address:''}`;
        const description = `Купить ${carData.brand} ${carData.model} ${carData.yearReleased} года выпуска с пробегом в ${carData.city} за ${carData.price} рублей. Характеристики: ${carData.engineType} двигатель, ${carData.enginePower} л.с., ${carData.gearboxType} коробка передач, ${carData.driveType} привод.`;
        const keywords = carData.configuration;
        res.render('car', {
            title,
            description,
            keywords,
            js1, js2, js3, js4, js5,
            carjs,
            css1, css2, css3,
            carData
        });
    } catch (error) {
        console.error('Error rendering car page:', error);
        res.status(500).send('Internal Server Error');
    }
    return res

}


export default router;