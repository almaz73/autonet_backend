// Заполнение таблицы dealers данными из фронтенд-массива dealers
import {sequelize, dealers as Dealers} from '../db.js'
import {buildDealerLink} from './dealerLink.js'
import {dealers} from '../../../../autonet/src/js/global-constants.js'

await Dealers.sync()

let created = 0
let updated = 0

for (const item of dealers) {
    const data = {
        city: item.city,
        url: item.url || null,
        coords: item.coords || null,
        address: item.address,
        tel: item.tel || null,
        days: item.days || null,
    }
    const link = buildDealerLink(data.city, data.address)
    const existing = await Dealers.findOne({where: {link}})

    if (existing) {
        // profile и brands не трогаем, чтобы не затереть ручные правки
        await existing.update(data)
        updated++
    } else {
        await Dealers.create({...data, link})
        created++
    }
}

console.log(`dealers: создано ${created}, обновлено ${updated}, всего в таблице ${await Dealers.count()}`)
await sequelize.close()
