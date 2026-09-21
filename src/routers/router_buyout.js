import Router from 'express'

const router = new Router()

const link = 'https://live.autonet.pro/api/'

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