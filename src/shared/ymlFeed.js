import path from 'node:path'
import {FolderForSitemap} from '../constants.js'
import {carFriendly, carPath} from './catalogUrls.js'

export const FEED_FILE_PATH = path.join(FolderForSitemap, 'yml.xml')

const SITE_ORIGIN = 'https://xn--80aej9aped4f.xn--p1ai'
const SHOP_NAME = 'Автосеть.РФ'
const SALES_NOTES = 'Проверка, кредит, обмен. 8-800-500-11-56'
const IMAGES_PER_OFFER = 5

const GEARBOX_NAMES = {
    'Механическая': 'механика',
    'Автоматическая': 'автомат',
    'Робот': 'робот',
    'Вариатор': 'вариатор',
}
const DRIVE_NAMES = {'Передний': 'передний', 'Задний': 'задний', 'Полный': 'полный'}
const WHEEL_NAMES = {'Левый': 'левый', 'Правый': 'правый'}

// символы, недопустимые в XML 1.0: мусор из импортированных данных не должен ломать выгрузку
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

function esc(value) {
    return String(value ?? '')
        .replace(INVALID_XML_CHARS, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// YML ждёт локальное время каталога в формате «ГГГГ-ММ-ДД чч:мм»
function feedDate(date) {
    const pad = value => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function engineVolume(capacity) {
    const liters = Number(capacity) / 1000
    if (!Number.isFinite(liters) || liters <= 0) return ''
    return liters.toFixed(1).replace(/\.0$/, '')
}

function mappedName(map, value) {
    return map[value] || value || ''
}

// фото в фиде — те же обработанные файлы, что отдаёт сайт, только абсолютными адресами
function carPictures(images) {
    return String(images || '')
        .split(',')
        .map(url => url.trim())
        .filter(Boolean)
        .slice(0, IMAGES_PER_OFFER)
        .map(url => {
            const base = url.split('/').pop().split('.')[0]
            return `${SITE_ORIGIN}/pub_auto/${base}_big.webp`
        })
}

function carDescription(car) {
    const parts = [`${car.brand} ${car.model}, ${car.year} год`]
    if (car.engineCapacity) parts.push(`${engineVolume(car.engineCapacity)} л`)
    if (car.power) parts.push(`${car.power} л.с.`)
    if (car.gearbox) parts.push(mappedName(GEARBOX_NAMES, car.gearbox))
    if (car.drive) parts.push(`${mappedName(DRIVE_NAMES, car.drive)} привод`)
    if (car.mileage) parts.push(`пробег ${Number(car.mileage).toLocaleString('ru-RU')} км`)
    if (car.color) parts.push(`цвет ${car.color.toLowerCase()}`)
    const place = car.city ? `, ${car.city}` : ''
    return `${parts.join(', ')}. В наличии в автосалоне ${SHOP_NAME}${place}.`
}

function carParams(car) {
    return [
        ['Год выпуска', car.year],
        ['Пробег', car.mileage, 'км'],
        ['Двигатель', engineVolume(car.engineCapacity), 'л'],
        ['Тип двигателя', car.engineType],
        ['Мощность', car.power, 'л.с.'],
        ['Коробка передач', mappedName(GEARBOX_NAMES, car.gearbox)],
        ['Привод', mappedName(DRIVE_NAMES, car.drive)],
        ['Тип кузова', car.body],
        ['Цвет', car.color],
        ['Руль', mappedName(WHEEL_NAMES, car.wheel)],
        ['Состояние', Number(car.mileage) > 0 ? 'б/у' : 'новый'],
        ['VIN', car.vin],
        ['Город', car.city],
    ]
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        .map(([name, value, unit]) => `        <param name="${esc(name)}"${unit ? ` unit="${esc(unit)}"` : ''}>${esc(value)}</param>`)
}

function offerXml(car) {
    const linkId = car.linkId || carFriendly(car.year, car.city, car.price, car.mileage)
    const url = SITE_ORIGIN + carPath(car.brand, car.model, linkId)

    return [
        `      <offer id="${esc(car.id)}" type="vendor.model" available="true">`,
        `        <url>${esc(url)}</url>`,
        `        <price>${Math.round(Number(car.price))}</price>`,
        '        <currencyId>RUR</currencyId>',
        '        <categoryId>1</categoryId>',
        ...carPictures(car.images).map(picture => `        <picture>${esc(picture)}</picture>`),
        `        <name>${esc(`${car.brand} ${car.model}, ${car.year}`)}</name>`,
        `        <vendor>${esc(car.brand)}</vendor>`,
        `        <model>${esc(car.model)}</model>`,
        `        <description>${esc(carDescription(car))}</description>`,
        `        <sales_notes>${esc(SALES_NOTES)}</sales_notes>`,
        ...carParams(car),
        '      </offer>',
    ].join('\n')
}

// в фид попадают только позиции с фото: без картинки Яндекс отклонит оффер
export function pickFeedCars(cars) {
    return cars.filter(car => carPictures(car.images).length)
}

export function buildYml(cars, date = new Date()) {
    const offers = pickFeedCars(cars).map(offerXml)

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE yml_catalog SYSTEM "shops.dtd">',
        `<yml_catalog date="${feedDate(date)}">`,
        '  <shop>',
        `    <name>${esc(SHOP_NAME)}</name>`,
        `    <company>${esc(SHOP_NAME)}</company>`,
        `    <url>${SITE_ORIGIN}/</url>`,
        '    <currencies>',
        '      <currency id="RUR" rate="1"/>',
        '    </currencies>',
        '    <categories>',
        '      <category id="1">Автомобили</category>',
        '    </categories>',
        '    <offers>',
        ...offers,
        '    </offers>',
        '  </shop>',
        '</yml_catalog>',
        '',
    ].join('\n')

    return {xml, offers: offers.length}
}
