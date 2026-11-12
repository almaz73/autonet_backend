import Router from 'express'
import A_car from '../API/A_car.js'

const router = new Router()

const link = 'https://live.autonet.pro/api/'
// const link = 'http://r1.dev.autonet.pro/api/'


// города берём из a_car.prop_city; список меняется вместе с импортом авто,
// поэтому за сутки запрашиваем его из БД один раз
let citiesCache = {date: '', items: null}
let citiesPending = null

function todayKey() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function getCitiesFromDb() {
    const today = todayKey()
    if (citiesCache.date === today && citiesCache.items) return citiesCache.items

    if (!citiesPending) {
        citiesPending = A_car.getCitiesFromACar()
            .then((rows) => {
                const cities = [...new Set(rows.map((city) => String(city).trim()).filter(Boolean))]
                    .sort((a, b) => a.localeCompare(b, 'ru'))
                // пустой справочник не кешируем: БД могла обновляться
                if (!cities.length) return cities

                // «Россия» — вариант «все города», всегда первым пунктом
                const items = cities.includes('Россия') ? cities : ['Россия', ...cities]
                citiesCache = {date: today, items}
                return items
            })
            .finally(() => {
                citiesPending = null
            })
    }

    return citiesPending
}


router.post('/Appeals/PostExternalAppeal', async (req, res) => {
    try {
        const targetUrl = link + `Appeals/PostExternalAppeal`; // Адрес стороннего сервера
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(req.body)
        });

        res.json(response.ok);
    } catch (e) {
        console.error('error auto/PostExternalAppeal= ', e)
    }
})

router.get('/auto/getCities', async (req, res) => {
    try {
        const items = await getCitiesFromDb()
        res.json({count: items.length, items})
    } catch (e) {
        console.error('error auto/getCities = ', e)
        res.status(500).json({error: 'cities unavailable'})
    }
})


router.get('/auto/getBrands', async (req, res) => {
    try {
        const targetUrl = link + 'auto/getBrands'; // Адрес стороннего сервера
        const response = await fetch(targetUrl);
        const data = await response.json(); // Парсим JSON из ответа
        res.json(data);
    } catch (e) {
        console.error('error auto/getBrands= ', e)
    }
})

router.get('/auto/getModels', async (req, res) => {
    try {
        const targetUrl =link + `auto/getModels?brandId=${req.query.brandId}`; // Адрес стороннего сервера
        const response = await fetch(targetUrl);
        const data = await response.json(); // Парсим JSON из ответа
        res.json(data);
    } catch (e) {
        console.error('error auto/getModels= ', e)
    }
})

router.get('/auto/getGenerations', async (req, res) => {
    try {
        const targetUrl =link + `auto/getGenerations?modelId=${req.query.modelId}`; // Адрес стороннего сервера
        const response = await fetch(targetUrl);
        const data = await response.json(); // Парсим JSON из ответа
        res.json(data);
    } catch (e) {
        console.error('error auto/getGenerations= ', e)
    }
})

router.get('/auto/getModifications', async (req, res) => {
    try {
        const targetUrl =link + `auto/getModifications?generationId=${req.query.generationId}`; // Адрес стороннего сервера
        const response = await fetch(targetUrl);
        const data = await response.json(); // Парсим JSON из ответа
        res.json(data);
    } catch (e) {
        console.error('error auto/getModifications= ', e)
    }
})

router.get('/auto/getComplectations', async (req, res) => {
    try {
        const targetUrl =link + `auto/getComplectations?modificationId=${req.query.modificationId}`; // Адрес стороннего сервера
        const response = await fetch(targetUrl);
        const data = await response.json(); // Парсим JSON из ответа
        res.json(data);
    } catch (e) {
        console.error('error auto/getComplectations= ', e)
    }
})


export default router;