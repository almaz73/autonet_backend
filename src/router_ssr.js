import Router from 'express'
import A_car from "./API/A_car.js";
import {manifest_links, transliterate, RussianBrandsRus, RussianBrandsLat} from './constants.js';
import GetListService from "./API/GetListService.js";


const router = new Router()


router.get('/cars/:number(\\d+)', carsList);
router.get('/cars/:number(\\d+)/:brand(\\D+)', carsList);
// router.get('/cars/:number(\\d+)/:brand(\\D+)/:model(\\D+)', carsList);

router.get('/cars/:brand(\\D+)/:model/:linkId', carAlone);
//http://localhost:3000/cars/Chevrolet/Camaro/2021-Tver-3250000-66525km?id=2b324b07-4ed2-11f1-816e-00505601020a
//http://localhost:3000/cars/Ford/Focus/2011-Tver-699000-242606km?id=679aa189-7d1b-11f1-816e-00505601020a

//http://localhost:3000/cars/Ford/Focus/2011-Tver-699000-242606km
//http://localhost:3000/cars/Chevrolet/Camaro/2021-Tver-3250000-66525km

async function carAlone(req, res) {

    if (req.params.brand.startsWith('src')) {
        return res.send(); // Пропускает этот маршрут и идет искать другие (или выдаст 404)
    }

    console.log('>>11>> carAlone = ')

    try {
        console.log('req.params = ', req.params)
        const carId = req.query.id || req.params.id;


        const {brand, model, linkId} = req.params;
        if (!linkId) return res.send()

        console.log('? ?? ?? ???????? carId = ', carId)

        let manifest = manifest_links['cars/car.html']

        if (!manifest) return res.status(404).send('Vite manifest not found');


        console.log('jfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjfjf')

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

        let carData = await A_car.getFullAutoInfo(carId)
        //
        // console.log(':: carData = ',carData.brand)

        // let carData = await A_car.getFullAutoInfoByLinkId(brand, model, linkId)

        // console.log(':: carData2 = ',carData2.brand)

        if (!carData) {
            return res.render('404', {confirm: '☹ ВОЗМОЖНО АВТОМОБИЛЬ СНЯТ С ПРОДАЖИ'})
        }

        // Generate title and description based on car data
        const title = `${carData.brand} ${carData.model} ${carData.yearReleased}  ${carData.prop_address ? ' - ' + carData.prop_address : ''}`;
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


async function carsList(req, res) {
    console.log('>>22>> carsList >> req.params = ', req.params)
    let {brand, number} = req.params

    const manifest = manifest_links['cars/index.html']
    if (!manifest) return res.status(404).send('Vite manifest not found');

    const js1 = manifest.imports && manifest.imports[0].slice(1)
    const js2 = manifest.imports && manifest.imports[1].slice(1)
    const js3 = manifest.imports && manifest.imports[2].slice(1)
    const js4 = manifest.imports && manifest.imports[3].slice(1)
    const js5 = manifest.imports && manifest.imports[4].slice(1)
    const js6 = manifest.imports && manifest.imports[5].slice(1)
    const js7 = manifest.imports && manifest.imports[6].slice(1)
    const carsjs = manifest.file


    let css1
    const css2 = manifest.css && manifest.css[0]
    const css3 = manifest.css && manifest.css[1]
    for (const manifestKey in manifest_links) {
        if (manifestKey.includes('_style-') && manifestKey.includes('.css')) css1 = manifestKey.slice(1)
    }

    const carCount = await A_car.getCarCount()
    carCount.length = 20

    let brandSearch = brand
    let placeRusBrand = RussianBrandsLat.findIndex(el => el === brand)
    if (placeRusBrand != -1) brandSearch = RussianBrandsRus[placeRusBrand]

    const carList = await GetListService.getList({offset: number * 20, limit: 20, brand: brandSearch})
    carCount.forEach(el => {
        if (RussianBrandsRus.includes(el.name)) el.latBrand = transliterate(el.name).replaceAll(" ", "");
        else el.latBrand = el.name
    })

    console.log('carList = ',carList)

    let page = ''
    for (let i = 1; i <= Math.ceil(carList.totalCount / 20); i++) {
        page += `<a href="/cars/${i - 1}${brand ? '/' + brand : ''}">${i}</a><span> | </span>`;
    }

    console.log('#########:::::::::: ')

    res.render('cars', {
        js1, js2, js3, js4, js5, js6, js7,
        carsjs,
        css1, css2, css3,
        carCount,
        carList,
        page,
        brand
    })
    return res
}


export default router;