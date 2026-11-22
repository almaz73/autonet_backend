// фильтровые посадочные каталога: /cars/<city>/<body>/<price>, /cars/<city>/<gearbox>, /cars/<body>/<price>
// словарь закрытый: произвольные комбинации фильтров в адреса не превращаются
import {catalogSlug} from './catalogUrls.js'

// ниже этого количества авто комбинация не индексируется и 301-ит на родителя
export const LANDING_MIN_CARS = 5

// кузова: ключ — значение prop_body_type в нижнем регистре
const BODY_WORDS = {
    'седан': {slug: 'sedan', singular: 'седан', plural: 'Седаны'},
    'кроссовер': {slug: 'crossover', singular: 'кроссовер', plural: 'Кроссоверы'},
    'внедорожник': {slug: 'suv', singular: 'внедорожник', plural: 'Внедорожники'},
    'хетчбэк': {slug: 'hatchback', singular: 'хетчбэк', plural: 'Хетчбэки'},
    'хэтчбек': {slug: 'hatchback', singular: 'хэтчбек', plural: 'Хэтчбеки'},
    'универсал': {slug: 'universal', singular: 'универсал', plural: 'Универсалы'},
    'лифтбек': {slug: 'liftback', singular: 'лифтбек', plural: 'Лифтбеки'},
    'лифтбэк': {slug: 'liftback', singular: 'лифтбэк', plural: 'Лифтбэки'},
    'пикап': {slug: 'pickup', singular: 'пикап', plural: 'Пикапы'},
    'купе': {slug: 'coupe', singular: 'купе', plural: 'Купе'},
    'минивэн': {slug: 'minivan', singular: 'минивэн', plural: 'Минивэны'},
    'минивен': {slug: 'minivan', singular: 'минивен', plural: 'Минивены'},
    'фургон': {slug: 'van', singular: 'фургон', plural: 'Фургоны'},
    'кабриолет': {slug: 'cabriolet', singular: 'кабриолет', plural: 'Кабриолеты'},
    'автобус': {slug: 'bus', singular: 'автобус', plural: 'Автобусы'},
}

// title — значение prop_body_type, по нему фильтруем GetList
export function bodyInfo(title) {
    const raw = String(title || '').trim()
    const preset = BODY_WORDS[raw.toLowerCase()]
    if (preset) return {...preset, title: raw}
    return {slug: catalogSlug(raw), singular: raw.toLowerCase(), plural: raw, title: raw}
}

// title — значение prop_transmission_type, по нему фильтруем GetList
export const GEARBOXES = [
    {slug: 'avtomat', title: 'Автоматическая', phrase: 'с АКПП', crumb: 'АКПП'},
    {slug: 'mekhanika', title: 'Механическая', phrase: 'на механике', crumb: 'Механика'},
    {slug: 'robot', title: 'Робот', phrase: 'с роботом', crumb: 'Робот'},
    {slug: 'variator', title: 'Вариатор', phrase: 'с вариатором', crumb: 'Вариатор'},
]

export const PRICE_BUCKETS = [
    {slug: 'do-1-mln', to: 1000000, short: 'до 1 млн', label: 'до 1 млн ₽'},
    {slug: 'do-2-mln', to: 2000000, short: 'до 2 млн', label: 'до 2 млн ₽'},
    {slug: 'do-3-mln', to: 3000000, short: 'до 3 млн', label: 'до 3 млн ₽'},
    {slug: 'ot-3-mln', from: 3000000, short: 'от 3 млн', label: 'от 3 млн ₽'},
]

export const GEARBOX_BY_SLUG = new Map(GEARBOXES.map(item => [item.slug, item]))
export const PRICE_BY_SLUG = new Map(PRICE_BUCKETS.map(item => [item.slug, item]))

// ценовая корзина по параметрам фильтра: только точное попадание в словарь
export function priceBucketByFilter(priceFrom, priceTo) {
    const from = priceFrom === undefined || priceFrom === '' ? '' : String(priceFrom).trim()
    const to = priceTo === undefined || priceTo === '' ? '' : String(priceTo).trim()
    return PRICE_BUCKETS.find(bucket => {
        if (bucket.from) return !to && from === String(bucket.from)
        return !from && to === String(bucket.to)
    }) || null
}

// канонический путь посадочной; порядок сегментов фиксирован: город → кузов → цена
export function landingPath({city, body, gearbox, price}) {
    const parts = []
    if (city) parts.push(city.slug)
    if (body) parts.push(body.slug)
    if (price) parts.push(price.slug)
    if (gearbox) parts.push(gearbox.slug)
    return '/cars' + parts.map(part => '/' + part).join('')
}

export function cityInfo(name) {
    const raw = String(name || '').trim()
    return raw ? {slug: catalogSlug(raw), name: raw} : null
}
