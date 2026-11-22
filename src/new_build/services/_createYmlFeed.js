import fs from 'node:fs/promises'
import path from 'node:path'
import A_car from '../../API/A_car.js'
import {FEED_FILE_PATH, buildYml} from '../../shared/ymlFeed.js'

// фид пересобираем после публикации БД: файл обновляется только когда каталог уже актуален
export async function _createYmlFeed(db) {
    const cars = await A_car.getCarsForFeed(db)
    const {xml, offers} = buildYml(cars)

    await fs.mkdir(path.dirname(FEED_FILE_PATH), {recursive: true})
    // пишем через временный файл: Яндекс не должен получить недописанный XML
    const tmpPath = `${FEED_FILE_PATH}.tmp`
    await fs.writeFile(tmpPath, xml, 'utf-8')
    await fs.rename(tmpPath, FEED_FILE_PATH)

    return `Товарный фид: ${offers} офферов`
}
