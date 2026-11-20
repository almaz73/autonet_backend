import fs from 'node:fs/promises'
import express from 'express'
import A_car from '../API/A_car.js'
import {FEED_FILE_PATH, buildYml} from '../shared/ymlFeed.js'

const router = express.Router()

// готовый файл пишется после обновления сайта (neatCombine), поэтому отдаём его как есть:
// во время импорта Яндекс не получит полупустой каталог. Нет файла — собираем из БД
router.get('/yml.xml', async (req, res) => {
    try {
        const xml = await fs.readFile(FEED_FILE_PATH, 'utf-8')
        res.set('Content-Type', 'application/xml; charset=utf-8')
        return res.send(xml)
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Error reading YML feed file:', error)
    }

    try {
        const cars = await A_car.getCarsForFeed()
        res.set('Content-Type', 'application/xml; charset=utf-8')
        res.send(buildYml(cars).xml)
    } catch (error) {
        console.error('Error building YML feed:', error)
        res.status(503).type('text/plain').send('Feed is temporarily unavailable')
    }
})

export default router
