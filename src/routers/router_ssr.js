import Router from 'express'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import {Op} from 'sequelize'
import A_car from "../API/A_car.js";
import {dealers, news, documents, review, sequelize} from '../clientBaza/db.js'
import * as promoDAO from '../clientBaza/promo/promoDAO.js'
import {FRONT_UPLOAD_DIR, DOCUMENT_LINK_PREFIX, formatFromName} from '../clientBaza/documents/documentFiles.js'
import {formatFileSize} from '../shared/fileSize.js'
import {manifest_links} from '../constants.js';
import {
    MODEL_MIN_CARS,
    CITY_MODEL_MIN_CARS,
    catalogSlug,
    carFriendly,
    carPath,
    buildModelClusters,
    buildCityMap,
    clusterCityCounts
} from '../shared/catalogUrls.js';
import {
    LANDING_MIN_CARS,
    bodyInfo,
    cityInfo,
    landingPath,
    priceBucketByFilter,
    GEARBOXES,
    GEARBOX_BY_SLUG,
    PRICE_BUCKETS,
    PRICE_BY_SLUG
} from '../shared/filterLandings.js';
import GetListService from "../API/GetListService.js";
// import {seoRedirects} from "./htaccess_middleware.js"

const router = new Router()

const MAP_WIDGET_URL = 'https://makemap.2gis.ru/widget'
const DEALER_ZOOM = 16
const DEALER_MARKER_COLOR = '#E22427'

const SITE_ORIGIN = 'https://xn--80aej9aped4f.xn--p1ai'
const NEWS_PAGE_SIZE = 15

// Собираем CSS из самого entry и всех чанков, которые он импортирует:
// часть стилей Vite кладёт в чанки (например contacts), и в manifest.css entry их нет
function collectCss(manifest, entryKey) {
    const css = []
    const seen = new Set()
    const walk = (key) => {
        if (!key || seen.has(key)) return
        seen.add(key)
        const entry = manifest[key]
        if (!entry) return
        if (entry.imports) entry.imports.forEach(walk)
        if (entry.css) entry.css.forEach(file => {
            if (!css.includes(file)) css.push(file)
        })
    }
    walk(entryKey)
    return css
}

// канонический slug для адреса каталога: «ВАЗ (LADA)» → vaz-lada, «Mercedes-Benz» → mercedes-benz
function brandSlug(name) {
    return catalogSlug(name)
}

// slug модели может указывать на вариант кластера: «rio-x-line» → кластер «rio»
function findCluster(index, value) {
    if (!index) return null
    const slug = catalogSlug(value)
    if (!slug) return null
    return index.clusters.get(slug) || index.clusters.get(index.members.get(slug)) || null
}

// куда вести удалённую карточку: посадочная модели — ближайшая живая страница
// с такими же авто. Модели нет или она тонкая — страница бренда, бренда нет — каталог.
// 301 на релевантную страницу сохраняет ссылочный вес и не выглядит как 404 для роботов
async function deletedCarTarget(rawBrand, rawModel) {
    const brandCanonical = brandSlug(rawBrand)
    if (!brandCanonical) return '/cars'

    try {
        const brands = await A_car.getCarCount()
        const brand = brands.find(item => item.name && brandSlug(item.name) === brandCanonical && Number(item.count) > 0)
        if (!brand) return '/cars'

        const modelIndex = buildModelClusters(await A_car.getModelCounts(brand.name))
        const cluster = findCluster(modelIndex, rawModel)
        if (cluster && cluster.count >= MODEL_MIN_CARS) return `/cars/${brandCanonical}/${cluster.slug}`
        return `/cars/${brandCanonical}`
    } catch (error) {
        console.error('Error resolving deleted car target:', error)
        return '/cars'
    }
}

// «в Казани», а не «в Казань»: города в базе стоят в именительном падеже
const CITY_PREPOSITIONAL = {
    'Казань': 'Казани',
    'Уфа': 'Уфе',
    'Набережные Челны': 'Набережных Челнах',
    'Нижнекамск': 'Нижнекамске',
    'Альметьевск': 'Альметьевске',
    'Самара': 'Самаре',
    'Екатеринбург': 'Екатеринбурге',
    'Тула': 'Туле',
    'Ижевск': 'Ижевске',
    'Пермь': 'Перми',
    'Челябинск': 'Челябинске',
    'Ульяновск': 'Ульяновске',
    'Стерлитамак': 'Стерлитамаке',
    'Оренбург': 'Оренбурге',
    'Киров': 'Кирове',
    'Москва': 'Москве',
    'Санкт-Петербург': 'Санкт-Петербурге',
    'Тверь': 'Твери',
}

function cityIn(name) {
    const city = String(name || '').trim()
    if (!city) return ''
    return 'в ' + (CITY_PREPOSITIONAL[city] || 'городе ' + city)
}

// 301 на канонический адрес каталога; brand уходит из query в путь.
// dropKeys — параметры, которые уже выражены самим путём (модель, город)
function redirectCars(res, req, path, dropKeys = ['brand']) {
    const drop = new Set(dropKeys)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
        if (drop.has(key) || value === undefined || value === '') continue
        params.set(key, Array.isArray(value) ? value.join(',') : value)
    }
    const query = params.toString()
    return res.redirect(301, path + (query ? `?${query}` : ''))
}

function decodePath(path) {
    try {
        return decodeURIComponent(path)
    } catch {
        return path
    }
}

/* ---------------- фильтровые посадочные: город × кузов × цена, город × КПП ---------------- */

let landingContext = null
let landingContextAt = 0
const LANDING_CACHE_TTL = 5 * 60 * 1000

// словарь известных городов, кузовов и брендов: по нему разбираем ЧПУ и строим ссылки
async function getLandingContext() {
    if (landingContext && Date.now() - landingContextAt < LANDING_CACHE_TTL) return landingContext
    const [cityRows, bodyRows, brandRows] = await Promise.all([
        A_car.getCityCounts(),
        A_car.getBodyTypes(),
        A_car.getCarCount()
    ])
    const cities = new Map()
    for (const row of cityRows) {
        const name = String(row.city || '').trim()
        if (!name || name === 'Россия' || name === 'Все') continue
        const slug = catalogSlug(name)
        if (slug) cities.set(slug, {slug, name, count: Number(row.count) || 0})
    }
    const bodies = new Map()
    for (const row of bodyRows) {
        const info = bodyInfo(row.title)
        if (info.slug && info.title) bodies.set(info.slug, info)
    }
    const brandSlugs = new Set()
    for (const row of brandRows) {
        const slug = brandSlug(row.name)
        if (slug) brandSlugs.add(slug)
    }
    landingContext = {cities, bodies, brandSlugs}
    landingContextAt = Date.now()
    return landingContext
}

const PRICE_COUNTERS = {'do-1-mln': 'do1', 'do-2-mln': 'do2', 'do-3-mln': 'do3', 'ot-3-mln': 'ot3'}
const emptyPriceCounts = () => ({do1: 0, do2: 0, do3: 0, ot3: 0})

let landingLinkData = null
let landingLinkDataAt = 0

// агрегаты для перелинковки: город × кузов × цена и город × КПП
async function getLandingLinkData() {
    if (landingLinkData && Date.now() - landingLinkDataAt < LANDING_CACHE_TTL) return landingLinkData
    const [rows, gearRows] = await Promise.all([
        A_car.getLandingCounts(),
        A_car.getLandingGearboxCounts()
    ])
    const byCity = new Map()
    const byBody = new Map()
    const cityGear = new Map()

    for (const row of rows) {
        const cityName = String(row.city || '').trim()
        const bodyRaw = String(row.body || '').trim()
        if (!cityName || !bodyRaw) continue
        const body = bodyInfo(bodyRaw)
        const count = Number(row.count) || 0
        const prices = {
            do1: Number(row.do1) || 0,
            do2: Number(row.do2) || 0,
            do3: Number(row.do3) || 0,
            ot3: Number(row.ot3) || 0
        }

        let cityData = byCity.get(cityName)
        if (!cityData) {
            cityData = {name: cityName, bodies: new Map(), prices: emptyPriceCounts()}
            byCity.set(cityName, cityData)
        }
        cityData.bodies.set(bodyRaw, {body, count, prices})
        for (const key of Object.keys(cityData.prices)) cityData.prices[key] += prices[key]

        let bodyData = byBody.get(bodyRaw)
        if (!bodyData) {
            bodyData = {body, count: 0, cities: new Map(), prices: emptyPriceCounts()}
            byBody.set(bodyRaw, bodyData)
        }
        bodyData.count += count
        bodyData.cities.set(cityName, (bodyData.cities.get(cityName) || 0) + count)
        for (const key of Object.keys(bodyData.prices)) bodyData.prices[key] += prices[key]
    }

    for (const row of gearRows) {
        const cityName = String(row.city || '').trim()
        const gear = GEARBOXES.find(item => item.title === String(row.gearbox || '').trim())
        if (!cityName || !gear) continue
        let counts = cityGear.get(cityName)
        if (!counts) {
            counts = new Map()
            cityGear.set(cityName, counts)
        }
        counts.set(gear.slug, (counts.get(gear.slug) || 0) + (Number(row.count) || 0))
    }

    landingLinkData = {byCity, byBody, cityGear}
    landingLinkDataAt = Date.now()
    return landingLinkData
}

// блоки перелинковки посадочной: только комбинации, прошедшие порог
function buildLandingLinkBlocks(landing, data) {
    const blocks = []
    const push = (title, links) => {
        const filtered = links.filter(link => link.count >= LANDING_MIN_CARS)
        if (!filtered.length) return
        blocks.push({title, links: filtered.sort((a, b) => b.count - a.count).slice(0, 16)})
    }
    // база без ценовой корзины: ссылки на цены получаются добавлением slug
    const priceLinks = (counts, base, excludeSlug) => PRICE_BUCKETS
        .filter(bucket => bucket.slug !== excludeSlug)
        .map(bucket => ({
            href: base + '/' + bucket.slug,
            label: bucket.short.charAt(0).toUpperCase() + bucket.short.slice(1),
            count: counts[PRICE_COUNTERS[bucket.slug]] || 0
        }))
    const cityTotal = (city) => [...city.bodies.values()].reduce((sum, item) => sum + item.count, 0)

    const cityName = landing.city ? landing.city.name : ''
    const citySlug = landing.city ? landing.city.slug : ''
    const cityBase = citySlug ? '/cars/' + citySlug : ''
    const bodyRaw = landing.body ? landing.body.title : ''
    const bodySlug = landing.body ? landing.body.slug : ''
    const bodyBase = bodySlug ? (cityBase || '/cars') + '/' + bodySlug : ''
    const priceSlug = landing.price ? landing.price.slug : ''
    const priceCounter = landing.price ? PRICE_COUNTERS[landing.price.slug] : ''
    const cityData = cityName ? data.byCity.get(cityName) : null
    const bodyData = bodyRaw ? data.byBody.get(bodyRaw) : null

    if (cityData) {
        const scopedBody = landing.body ? cityData.bodies.get(bodyRaw) : null

        if (landing.gearbox) {
            const gearCounts = data.cityGear.get(cityName) || new Map()
            push('Другая коробка передач', GEARBOXES
                .filter(gear => gear.slug !== landing.gearbox.slug)
                .map(gear => ({
                    href: cityBase + '/' + gear.slug,
                    label: gear.crumb,
                    count: gearCounts.get(gear.slug) || 0
                })))
            push(`Кузова ${cityIn(cityName)}`, [...cityData.bodies.values()]
                .map(item => ({
                    href: cityBase + '/' + item.body.slug,
                    label: item.body.plural,
                    count: item.count
                })))
            return blocks
        }

        if (landing.body && landing.price) {
            push('Другие цены', priceLinks(scopedBody.prices, bodyBase, priceSlug))
            push('Другие кузова по этой цене', [...cityData.bodies.values()]
                .filter(item => item.body.slug !== bodySlug)
                .map(item => ({
                    href: cityBase + '/' + item.body.slug + '/' + priceSlug,
                    label: item.body.plural,
                    count: item.prices[priceCounter] || 0
                })))
            push('Этот кузов в других городах', [...data.byCity.entries()]
                .filter(([name]) => name !== cityName)
                .map(([name, city]) => {
                    const scoped = city.bodies.get(bodyRaw)
                    return {
                        href: '/cars/' + catalogSlug(name) + '/' + bodySlug + '/' + priceSlug,
                        label: name,
                        count: (scoped && scoped.prices[priceCounter]) || 0
                    }
                }))
            return blocks
        }

        if (landing.body) {
            push('Выбрать цену', priceLinks(scopedBody.prices, bodyBase))
            push(`${landing.body.plural} в других городах`, [...bodyData.cities.entries()]
                .filter(([name]) => name !== cityName)
                .map(([name, count]) => ({
                    href: '/cars/' + catalogSlug(name) + '/' + bodySlug,
                    label: name,
                    count
                })))
            return blocks
        }

        // город без кузова: возможен как /cars/<city>, так и /cars/<city>/<price>
        const gearCounts = data.cityGear.get(cityName) || new Map()
        push(`Кузова ${cityIn(cityName)}`, [...cityData.bodies.values()]
            .map(item => ({
                href: cityBase + '/' + item.body.slug + (priceSlug ? '/' + priceSlug : ''),
                label: item.body.plural,
                count: priceSlug ? item.prices[priceCounter] || 0 : item.count
            })))
        push('Коробка передач', GEARBOXES
            .map(gear => ({
                href: cityBase + '/' + gear.slug,
                label: gear.crumb,
                count: gearCounts.get(gear.slug) || 0
            })))
        push('Выбрать цену', priceLinks(cityData.prices, cityBase, priceSlug))
        if (!priceSlug) {
            push('Другие города', [...data.byCity.entries()]
                .filter(([name]) => name !== cityName)
                .map(([name, city]) => ({href: '/cars/' + catalogSlug(name), label: name, count: cityTotal(city)})))
        }
        return blocks
    }

    if (bodyData) {
        const priceSuffix = priceSlug ? '/' + priceSlug : ''
        push(landing.price ? 'Другие цены' : 'Выбрать цену',
            priceLinks(bodyData.prices, bodyBase, landing.price ? priceSlug : ''))
        push(`${bodyData.body.plural} в городах${landing.price ? ' по этой цене' : ''}`,
            [...data.byCity.entries()]
                .map(([name, city]) => {
                    const scoped = city.bodies.get(bodyRaw)
                    return {
                        href: '/cars/' + catalogSlug(name) + '/' + bodySlug + priceSuffix,
                        label: name,
                        count: landing.price ? (scoped && scoped.prices[priceCounter]) || 0 : (scoped && scoped.count) || 0
                    }
                }))
    }

    return blocks
}

// страница посадочной, которой не хватило порога, отдаёт вес родителю
function landingParentPath(landing) {
    const cityBase = landing.city ? '/cars/' + landing.city.slug : ''
    if (landing.gearbox) return cityBase
    if (landing.body) {
        const bodyBase = (cityBase || '/cars') + '/' + landing.body.slug
        if (landing.price) return bodyBase
        return cityBase || '/cars'
    }
    if (landing.price) return cityBase || '/cars'
    return cityBase || '/cars'
}

// разбор ЧПУ: /cars/<city>[/<body>][/<price>], /cars/<city>/<gearbox>, /cars/<body>[/<price>], страница — последним сегментом
async function parseLanding(req) {
    const ctx = await getLandingContext()
    const tokens = ['a', 'b', 'c', 'd']
        .map(key => req.params[key])
        .filter(value => typeof value === 'string' && value)
    if (!tokens.length) return null
    if (/^\d+$/.test(tokens[0])) return null

    let page = 0
    let hadPage = false
    if (/^\d+$/.test(tokens[tokens.length - 1])) {
        page = Number(tokens.pop())
        hadPage = true
        if (!tokens.length) return null
    }
    // /0 — это первая страница: склеиваем её с чистым адресом самой посадочной, а не с её родителем
    const finish = (result) => hadPage && page === 0 ? {redirect: landingPath(result)} : result

    const [first, ...tail] = tokens
    if (ctx.brandSlugs.has(first)) return null

    const city = ctx.cities.get(first)
    if (city) {
        const parent = '/cars/' + city.slug
        if (!tail.length) return finish({city, page}, parent)
        if (tail.length === 1) {
            const body = ctx.bodies.get(tail[0])
            if (body) return finish({city, body, page}, parent)
            const gearbox = GEARBOX_BY_SLUG.get(tail[0])
            if (gearbox) return finish({city, gearbox, page}, parent)
            const price = PRICE_BY_SLUG.get(tail[0])
            if (price) return finish({city, price, page}, parent)
            return {redirect: parent}
        }
        if (tail.length === 2) {
            const body = ctx.bodies.get(tail[0])
            const price = PRICE_BY_SLUG.get(tail[1])
            if (body && price) return finish({city, body, price, page}, parent)
            if (body) return {redirect: parent + '/' + body.slug}
            return {redirect: parent}
        }
        return {redirect: parent}
    }

    const body = ctx.bodies.get(first)
    if (body) {
        const parent = '/cars/' + body.slug
        if (!tail.length) return finish({body, page}, parent)
        if (tail.length === 1) {
            const price = PRICE_BY_SLUG.get(tail[0])
            if (price) return finish({body, price, page}, parent)
            return {redirect: parent}
        }
        return {redirect: parent}
    }

    return null
}

// обратный 301: фильтровый набор в query, совпавший с матрицей, уходит на чистый адрес
async function matchLandingQuery(query) {
    const allowed = new Set(['city', 'bodyType', 'gearboxType', 'priceFrom', 'priceTo'])
    const keys = Object.keys(query).filter(key => typeof query[key] === 'string' && query[key].trim())
    if (!keys.length || keys.some(key => !allowed.has(key))) return null
    const ctx = await getLandingContext()

    const cityName = String(query.city || '').trim()
    const city = cityName ? ctx.cities.get(catalogSlug(cityName)) : null
    if (cityName && (!city || city.name !== cityName)) return null

    const bodyTitle = String(query.bodyType || '').trim()
    const body = bodyTitle ? [...ctx.bodies.values()].find(item => item.title === bodyTitle) : null
    if (bodyTitle && !body) return null

    const gearTitle = String(query.gearboxType || '').trim()
    const gearbox = gearTitle ? GEARBOXES.find(item => item.title === gearTitle) : null
    if (gearTitle && !gearbox) return null

    const price = query.priceFrom || query.priceTo
        ? priceBucketByFilter(query.priceFrom, query.priceTo)
        : null
    if ((query.priceFrom || query.priceTo) && !price) return null

    // в матрице нет посадочных без города и кузова, а КПП живёт только в паре с городом
    if (!city && !body) return null
    if (gearbox && (body || price)) return null

    const filters = {}
    if (city) filters.city = city.name
    if (body) filters.bodyType = body.title
    if (gearbox) filters.gearboxType = gearbox.title
    if (price && price.from) filters.priceFrom = price.from
    if (price && price.to) filters.priceTo = price.to

    const probe = await GetListService.getList({...filters, limit: 1, offset: 0})
    if ((probe.totalCount || 0) < LANDING_MIN_CARS) return null
    return landingPath({city, body, gearbox, price})
}

// слеш на конце витрин и карточек убирают их обработчики: там известен канон,
// поэтому получается один 301 сразу на канонический адрес
function stripCarsTrailingSlash(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.path.startsWith('/cars/') || !req.path.endsWith('/')) return next()

    const rest = req.path.replace(/\/+$/, '').split('/').slice(2)
    const isListing = rest.length <= 2
        || (rest.length === 3 && (/^\d+$/.test(rest[0]) || /^[a-z][a-z0-9-]*$/.test(rest[2])))
        || rest.length === 4
    const isCard = rest.length === 3 && !/^\d+$/.test(rest[0]) && !/^[a-z][a-z0-9-]*$/.test(rest[2])
    if (isListing || isCard) return next()

    const query = req.originalUrl.slice(req.path.length)
    return res.redirect(301, req.path.replace(/\/+$/, '') + query)
}

router.use(stripCarsTrailingSlash)

/** подготовка к работе с отдельными контактами **/
const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const stripTags = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// в адресах из CMS встречается <br> — разрешаем только его, остальное экранируем
const formatMultiline = (value) => escapeHtml(value).replace(/&lt;br\s*\/?&gt;/gi, '<br>')

const telHref = (tel) => `tel:${String(tel ?? '').replace(/[^\d+]/g, '')}`

function parseCoords(value) {
    if (!value) return null
    const [lat, lon] = String(value).split(',').map((part) => parseFloat(part.trim()))
    return Number.isFinite(lat) && Number.isFinite(lon) ? {lat, lon} : null
}

// виджет 2ГИС принимает data = base64url(zlib(JSON))
function buildDealerMapSrc(dealer) {
    const point = parseCoords(dealer.coords)
    if (!point) return ''

    const popup = `
        <div style="font:14px/1.45 Gilroy,Arial,sans-serif;min-width:180px;background:white">
            <div style="font-weight:700;color:#111;margin-bottom:2px">${escapeHtml(dealer.city)}</div>
            <div style="color:#333">${formatMultiline(dealer.address)}</div>
            <div style="margin-top:4px"><a style="color:#E22427;text-decoration:none" href="${escapeHtml(telHref(dealer.tel))}">${escapeHtml(dealer.tel)}</a></div>
            <div style="color:#8a8a95;font-size:12px;margin-top:2px">${escapeHtml(dealer.days)}</div>
        </div>`

    const data = {
        orderedGeometries: [{
            type: 'Feature',
            properties: {
                description: Buffer.from(popup, 'utf8').toString('base64'),
                color: DEALER_MARKER_COLOR,
                zIndex: 1000000000,
            },
            geometry: {
                type: 'Point',
                coordinates: [point.lon, point.lat],
            },
            id: dealer.id,
        }],
        mapPosition: {...point, zoom: DEALER_ZOOM},
        scrollWheelZoom: false,
    }

    const compressed = zlib.deflateSync(Buffer.from(JSON.stringify(data), 'utf8'))
    return `${MAP_WIDGET_URL}?data=${compressed.toString('base64url')}`
}

// чанки страницы контактов: в манифесте нет html-entry contacts, берём их по префиксу
function findChunk(prefix, ext) {
    for (const key of Object.keys(manifest_links)) {
        if (!key.startsWith(prefix)) continue
        const entry = manifest_links[key]
        if (entry && entry.file && entry.file.endsWith(ext)) return entry
    }
    return {}
}

// общий чанк стилей: новая сборка Vite отдаёт его отдельным CSS-энтри,
// старая — JS-чанком со списком подключённых css
function sharedStyle() {
    const js = findChunk('_style-', '.js')
    const css = findChunk('_style-', '.css')
    return {
        js: js.file || '',
        css: (js.css && js.css[0]) || css.file || '',
    }
}

function contactAssets() {
    const style = sharedStyle()
    const main = findChunk('_main-', '.js')
    const contacts = findChunk('_contacts-', '.js')
    return {
        styleJs: style.js,
        styleCss: style.css,
        mainJs: main.file || '',
        contactsCss: (contacts.css && contacts.css[0]) || '',
    }
}

// общий вид карточки дилера: страница контакта и городская главная показывают одно и то же
function buildDealerView(dealer) {
    if (!dealer) return null
    const splitList = (value) => String(value || '').split(',').map((part) => part.trim()).filter(Boolean)
    return {
        dealer,
        addressText: stripTags(dealer.address),
        addressHtml: formatMultiline(dealer.address),
        tels: splitList(dealer.tel).map((value) => ({value, href: telHref(value)})),
        profiles: splitList(dealer.profile),
        brands: splitList(dealer.brands),
        email: String(dealer.email || '').trim(),
        photoUrl: dealer.url ? encodeURI(dealer.url) : '',
        mapSrc: buildDealerMapSrc(dealer),
    }
}

// schema.org AutoDealer для карточки на городской странице
function buildDealerSchema(view) {
    const dealer = view.dealer
    const point = parseCoords(dealer.coords)
    const phone = view.tels.length ? view.tels[0].href.replace(/^tel:/, '') : ''
    const photo = view.photoUrl
        ? (/^https?:\/\//.test(view.photoUrl) ? view.photoUrl : `${SITE_ORIGIN}${view.photoUrl}`)
        : `${SITE_ORIGIN}/st/auto.webp`

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'AutoDealer',
        name: `Автосеть.РФ — ${dealer.city}, ${view.addressText}`,
        url: `${SITE_ORIGIN}${dealer.link}`,
        image: photo,
        ...(phone ? {telephone: phone} : {}),
        ...(view.email ? {email: view.email} : {}),
        address: {
            '@type': 'PostalAddress',
            streetAddress: view.addressText,
            addressLocality: dealer.city,
            addressCountry: 'RU',
        },
        ...(point ? {geo: {'@type': 'GeoCoordinates', latitude: point.lat, longitude: point.lon}} : {}),
    }

    return JSON.stringify(schema).replaceAll('<', '\\u003c')
}

/** КОНЕЦ подготовка к работе с отдельными контактами **/

/** Динамические страницы статей из таблицы news **/

const NEWS_LIST_DESCRIPTION = 'Статьи Автосеть.РФ о покупке подержанных автомобилей: проверка истории, кредит, трейд-ин, обслуживание и выбор авто с пробегом.'

// общие стили и скрипты для серверных страниц (статьи, отзывы)
function pageAssets() {
    const style = sharedStyle()
    const main = findChunk('_main-', '.js')
    const pagination = findChunk('_pagination-', '.js')
    // до пересборки Vite стили статей могут лежать отдельным чанком,
    // после неё news.css включён в общий style.css
    const newsCss = findChunk('_news-', '.css')
    return {
        jsFiles: [style.js, main.file, pagination.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
        cssFiles: [style.css, newsCss.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
    }
}

// стили и скрипты листинга акций: promo.css собирается отдельным entry
function promoAssets() {
    const style = sharedStyle()
    const main = findChunk('_main-', '.js')
    const promo = findChunk('promo/', '.css')
    return {
        jsFiles: [style.js, main.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
        cssFiles: [style.css, promo.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
    }
}

/** Листинг акций: ссылки на все активные акции, чтобы они не были сиротами **/

const PROMO_LIST_TITLE = 'Акции и спецпредложения - Автосеть.РФ'
const PROMO_LIST_DESCRIPTION = 'Специальные предложения и акции в автосалонах Автосеть.РФ: скидки на обслуживание, кредит, трейд-ин и автомобили с пробегом.'

const promoDescriptionLines = (promo) => String(promo.description ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

async function promoList(req, res) {
    try {
        // канонический адрес — со слешем на конце
        if (!req.path.endsWith('/')) return res.redirect(301, '/promo/')

        // без кода акция не имеет канонического адреса — такую в sitemap тоже не берут
        const promos = (await promoDAO.getActivePromoBanners(false)).filter((promo) => promo.code)
        const [bigPromo, ...galleryPromos] = promos

        res.render('promo-list', {
            ...promoAssets(),
            bigPromo: bigPromo || null,
            bigDescription: bigPromo ? promoDescriptionLines(bigPromo).join('\n') : '',
            items: galleryPromos.map((promo, index) => ({
                ...promo,
                // первый баннер уже стоит крупным, раскладка остальных как в promo.js:
                // 4 вертикальных подряд, затем 2 горизонтальных
                orientation: index % 6 < 4 ? 'ver' : 'hor',
                lines: promoDescriptionLines(promo),
            })),
            canonical: `${SITE_ORIGIN}/promo/`,
            title: PROMO_LIST_TITLE,
            description: PROMO_LIST_DESCRIPTION,
            ogImage: `${SITE_ORIGIN}/st/auto.webp`,
            breadcrumbSchemaJson: buildBreadcrumbSchema([
                {name: 'Главная', url: `${SITE_ORIGIN}/`},
                {name: 'Акции и спецпредложения', url: `${SITE_ORIGIN}/promo/`},
            ]),
        })
    } catch (error) {
        console.error('Error rendering promo list:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}

const formatNewsDate = (value) => {
    const [year, month, day] = String(value ?? '').split('-')
    return year && month && day ? `${day}.${month}.${year}` : String(value ?? '')
}

const newsImageSrc = (value) => {
    const src = String(value ?? '').trim()
    if (!src) return ''
    if (/^https?:\/\//i.test(src) || src.startsWith('/')) return src
    return `/st/photo/news/${src}`
}

const newsImageAbsolute = (value) => {
    const src = newsImageSrc(value)
    if (!src) return `${SITE_ORIGIN}/st/auto.webp`
    return /^https?:\/\//i.test(src) ? src : `${SITE_ORIGIN}${src}`
}

async function newsList(req, res) {
    try {
        const requestedPage = Math.max(1, parseInt(req.query.PAGEN_2, 10) || 1)
        const pageHref = (page) => page === 1 ? '/news/' : `/news/?PAGEN_2=${page}`
        // трекинг-параметры (?bxajaxid=...) плодят дубли, оставляем только номер страницы
        const hasTrackingParams = Object.keys(req.query).some((key) => key !== 'PAGEN_2')

        // канонический адрес списка — со слешем на конце, без трекинговых параметров
        if (!req.path.endsWith('/') || hasTrackingParams) {
            return res.redirect(301, pageHref(requestedPage))
        }

        const total = await news.count({where: {active: true}})
        const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE))

        // страницы за пределами выдачи уводим на последнюю, чтобы не плодить дубли
        if (requestedPage > totalPages) {
            return res.redirect(301, totalPages === 1 ? '/news/' : `/news/?PAGEN_2=${totalPages}`)
        }

        const rows = await news.findAll({
            where: {active: true},
            attributes: ['id', 'name', 'announce', 'url', 'image', 'date'],
            order: [['date', 'DESC'], ['id', 'DESC']],
            offset: (requestedPage - 1) * NEWS_PAGE_SIZE,
            limit: NEWS_PAGE_SIZE,
            raw: true,
        })

        res.render('news-list', {
            ...pageAssets(),
            items: rows.map((row) => ({
                ...row,
                image: newsImageSrc(row.image),
                dateText: formatNewsDate(row.date),
            })),
            currentPage: requestedPage,
            totalPages,
            pagerLinks: Array.from({length: totalPages}, (_, index) => ({
                page: index + 1,
                href: pageHref(index + 1),
                active: index + 1 === requestedPage,
            })),
            nextHref: requestedPage < totalPages ? pageHref(requestedPage + 1) : null,
            canonical: `${SITE_ORIGIN}${pageHref(requestedPage)}`,
            title: requestedPage === 1 ? 'Новости и статьи' : `Новости и статьи — страница ${requestedPage}`,
            description: NEWS_LIST_DESCRIPTION,
            ogImage: `${SITE_ORIGIN}/st/auto.webp`,
        })
    } catch (error) {
        console.error('Error rendering news list:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}

async function newsPage(req, res) {
    try {
        // в адресе статьи число — это её внешний id из url, а не первичный ключ таблицы
        const articleId = `/news/${req.params.id}`
        const row = await news.findOne({
            where: {
                active: true,
                url: {[Op.in]: [articleId, `${articleId}/`]},
            },
            raw: true,
        })

        if (!row) return res.status(404).render('404', {confirm: ''})

        // канонический адрес статьи — из базы, со слешем на конце;
        // трекинг-параметры (?bxajaxid=...) отбрасываем, чтобы вес шёл на канонический адрес
        if (req.path !== row.url || Object.keys(req.query).length) return res.redirect(301, row.url)

        // в части старых страниц заголовок h1 не входит в content — добавляем его из name
        const hasH1 = /^\s*<h1[\s>]/i.test(String(row.content || ''))
        const content = hasH1
            ? row.content
            : `<h1>${escapeHtml(row.name)}</h1>\n${row.content || ''}`

        res.render('news', {
            ...pageAssets(),
            name: row.name,
            title: row.title || row.name,
            description: row.description || row.announce || '',
            content,
            image: newsImageSrc(row.image),
            ogImage: newsImageAbsolute(row.image),
            canonical: `${SITE_ORIGIN}${row.url}`,
        })
    } catch (error) {
        console.error('Error rendering news page:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}

/** КОНЕЦ динамические страницы статей **/

/** Страница документов из таблицы documents **/

const DOCUMENTS_TITLE = 'Документы - Автосеть.РФ'
const DOCUMENTS_DESCRIPTION = 'Официальные документы автосалона Автосеть.РФ: правила выдачи сертификатов, договоры, политика обработки персональных данных.'
// форматы, которые браузер умеет показать сам
const PREVIEW_FORMATS = new Set(['PDF', 'TXT', 'JPG', 'JPEG', 'PNG'])

function documentsAssets() {
    const style = sharedStyle()
    const main = findChunk('_main-', '.js')
    return {
        styleJs: style.js,
        styleCss: style.css,
        mainJs: main.file || '',
    }
}

async function documentsPage(req, res) {
    try {
        // канонический адрес — со слешем на конце, как у остальных серверных страниц
        if (!req.path.endsWith('/')) return res.redirect(301, '/documents/')

        const rows = await documents.findAll({where: {published: true}, raw: true})

        const visible = rows
            .filter((row) => {
                const link = String(row.link ?? '')
                if (!link) return false
                // локальный файл мог быть удалён из папки — не показываем битую ссылку
                if (link.startsWith(`${DOCUMENT_LINK_PREFIX}/`) && row.file) {
                    return fs.existsSync(path.join(FRONT_UPLOAD_DIR, row.file))
                }
                return true
            })
            .sort((a, b) => {
                // основные документы всегда выше второстепенных
                const kindOrder = (row) => row.kind === 'main' ? 0 : 1
                return kindOrder(a) - kindOrder(b)
                    || (Number(a.priority) || 0) - (Number(b.priority) || 0)
                    || a.id - b.id
            })
            .map((row) => {
                const formatText = row.format || formatFromName(row.file) || ''
                return {
                    ...row,
                    formatText,
                    sizeText: formatFileSize(row.size),
                    // такие файлы браузер показывает сам — открываем во вкладке;
                    // остальные форматы отдаём на скачивание
                    previewable: PREVIEW_FORMATS.has(formatText),
                }
            })

        res.render('documents', {
            ...documentsAssets(),
            mainDocs: visible.filter((row) => row.kind === 'main'),
            secondaryDocs: visible.filter((row) => row.kind !== 'main'),
            title: DOCUMENTS_TITLE,
            description: DOCUMENTS_DESCRIPTION,
            canonical: `${SITE_ORIGIN}/documents/`,
            ogImage: `${SITE_ORIGIN}/st/auto.webp`,
        })
    } catch (error) {
        console.error('Error rendering documents page:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}

/** КОНЕЦ страница документов **/

/** Отзывы с внешних площадок **/

const REVIEWS_PAGE_SIZE = 15
const REVIEWS_TITLE = 'Отзывы об Автосеть.РФ'
const REVIEWS_DESCRIPTION = 'Отзывы клиентов об автосалоне Автосеть.РФ: покупка автомобилей с пробегом, продажа, сервис и обслуживание. Реальные отзывы с Яндекс Карт, Google Карт, Авито и 2ГИС.'

// площадки, где клиенты могут оставить отзыв об автосеть.рф
const REVIEW_SOURCES = [
    {
        platform: 'yandex',
        name: 'Яндекс Карты',
        href: 'https://yandex.ru/maps/org/avtoset_rf/219171359802/reviews/',
        reviewsHref: 'https://yandex.ru/maps/org/avtoset_rf/219171359802/reviews/',
    },
    {
        platform: 'google',
        name: 'Google Карты',
        href: 'https://search.google.com/local/writereview?placeid=ChIJ82z9OV9NWUEQZkR5miIHENU',
        reviewsHref: 'https://www.google.com/maps/place/%D0%90%D0%92%D0%A2%D0%9E%D0%A1%D0%95%D0%A2%D0%AC.%D0%A0%D0%A4/@55.8235315,49.1570086,17z/data=!4m8!3m7!1s0x41594d5f397d6cf3:0xd51047229a794466!8m2!3d55.8235315!4d49.1595889!9m1!1b1!16s%2Fg%2F1q629527h',
    },
    {
        platform: 'avito',
        name: 'Авито',
        href: 'https://www.avito.ru/brands/yamasheva',
        reviewsHref: 'https://www.avito.ru/brands/yamasheva',
    },
    {
        platform: '2gis',
        name: '2ГИС',
        href: 'https://2gis.ru/kazan/firm/70000001037442537/tab/reviews',
        reviewsHref: 'https://2gis.ru/kazan/firm/70000001037442537/tab/reviews',
    },
]

const REVIEW_SOURCE_BY_PLATFORM = new Map(REVIEW_SOURCES.map((source) => [source.platform, source]))

function toReviewView(row) {
    const source = REVIEW_SOURCE_BY_PLATFORM.get(row.platform)
    return {
        id: row.id,
        author: String(row.fio ?? '').trim() || 'Клиент Автосеть.РФ',
        dateText: formatNewsDate(row.date),
        // переносы строк в отзывах сохраняет CSS (white-space: pre-line)
        text: String(row.review ?? '').trim(),
        rating: Math.max(0, Math.min(5, Number(row.rating) || 0)),
        // отзыв, оставленный на сайте, показываем без ссылки на площадку
        platformLabel: row.platform === 'site' ? 'Отзыв с сайта' : (source?.name || 'Отзыв'),
        platformHref: row.platform === 'site' ? '' : (source?.reviewsHref || ''),
        respondent: String(row.respondent ?? '').trim(),
        answer: String(row.answer ?? '').trim(),
        answerDateText: formatNewsDate(row.dateAnswer),
    }
}

// на главной показываем только отзывы с максимальной оценкой
async function getRandomFiveStarReviews(limit) {
    const rows = await review.findAll({
        where: {
            [Op.and]: [
                {rating: 5},
                {published: true},
                {review: {[Op.ne]: null}},
                {review: {[Op.ne]: ''}},
            ],
        },
        order: sequelize.random(),
        limit,
        raw: true,
    })
    return rows.map(toReviewView)
}

// отзывы города: связываем их со страницами отзывов дилерских центров этого города
async function getCityReviews(reviewLinks, limit) {
    if (!reviewLinks.length) return []
    const rows = await review.findAll({
        where: {
            [Op.and]: [
                {published: true},
                {review: {[Op.ne]: null}},
                {review: {[Op.ne]: ''}},
                {link: {[Op.in]: reviewLinks}},
            ],
        },
        order: [['date', 'DESC'], ['id', 'DESC']],
        limit,
        raw: true,
    })
    return rows.map(toReviewView)
}

async function reviewsPage(req, res) {
    try {
        const requestedPage = Math.max(1, parseInt(req.query.PAGEN_2, 10) || 1)
        const pageHref = (page) => page === 1 ? '/reviews/' : `/reviews/?PAGEN_2=${page}`
        // трекинг-параметры (?bxajaxid=...) плодят дубли, оставляем только номер страницы
        const hasTrackingParams = Object.keys(req.query).some((key) => key !== 'PAGEN_2')

        // канонический адрес списка — со слешем на конце, без трекинговых параметров
        if (!req.path.endsWith('/') || hasTrackingParams) {
            return res.redirect(301, pageHref(requestedPage))
        }

        const {count: total, rows} = await review.findAndCountAll({
            where: {
                [Op.and]: [
                    {published: true},
                    {review: {[Op.ne]: null}},
                    {review: {[Op.ne]: ''}},
                ],
            },
            order: [['date', 'DESC'], ['id', 'DESC']],
            offset: (requestedPage - 1) * REVIEWS_PAGE_SIZE,
            limit: REVIEWS_PAGE_SIZE,
            raw: true,
        })

        const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE))

        // страницы за пределами выдачи уводим на последнюю, чтобы не плодить дубли
        if (requestedPage > totalPages) {
            return res.redirect(301, totalPages === 1 ? '/reviews/' : `/reviews/?PAGEN_2=${totalPages}`)
        }

        res.render('reviews', {
            ...pageAssets(),
            items: rows.map(toReviewView),
            sources: REVIEW_SOURCES,
            currentPage: requestedPage,
            totalPages,
            pagerLinks: Array.from({length: totalPages}, (_, index) => ({
                page: index + 1,
                href: pageHref(index + 1),
                active: index + 1 === requestedPage,
            })),
            nextHref: requestedPage < totalPages ? pageHref(requestedPage + 1) : null,
            // канонической считаем только первую страницу
            canonical: `${SITE_ORIGIN}/reviews/`,
            title: requestedPage === 1 ? REVIEWS_TITLE : `${REVIEWS_TITLE} — страница ${requestedPage}`,
            description: REVIEWS_DESCRIPTION,
            ogImage: `${SITE_ORIGIN}/st/auto.webp`,
        })
    } catch (error) {
        console.error('Error rendering reviews page:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}

/** КОНЕЦ отзывы с внешних площадок **/

// router.use(seoRedirects)

// старые адреса страницы отзывов (кириллицей и транслитом) → 301 на /reviews/
const REVIEWS_ALIASES = new Set(['отзыв', 'отзывы', 'otzyv', 'otzyvy'])
router.use((req, res, next) => {
    let pathname
    try {
        pathname = decodeURIComponent(req.path)
    } catch {
        return next()
    }
    const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
    if (REVIEWS_ALIASES.has(slug)) return res.redirect(301, '/reviews/')
    return next()
})

router.get('/', indexPage);                                 // Главная страница

router.get('/cars', carsList);                              // Страница витрины /cars
router.get('/cars/:number(\\d+)', carsList);                // Страница витрины /cars
router.get('/cars/:number(\\d+)/:brand([^/]+)', carsList);  // /cars/<N>/<brand>
router.get('/cars/:number(\\d+)/:brand([^/]+)/:model([^/]+)', carsList);  // /cars/<N>/<brand>/<model>
router.get('/cars/:number(\\d+)/:brand([^/]+)/:model([^/]+)/:city([a-z][a-z0-9-]*)', carsList); // /cars/<N>/<brand>/<model>/<city>

router.get('/reserve', legacyReserve);                      // Старое бронирование /reserve?vin=... → карточка или каталог
router.get('/cars/car.html', legacyCarPage);                // Старые ссылки /cars/car.html?id=... → 301 в каталог

// фильтровые посадочные матрицы: /cars/kazan, /cars/kazan/crossover/do-2-mln, /cars/kazan/avtomat.
// бренд важнее совпадения slug'ов: неподходящий путь carsLanding отдаёт следующему маршруту
router.get('/cars/:a([^/]+)', carsLanding);
router.get('/cars/:a([^/]+)/:b([^/]+)', carsLanding);
router.get('/cars/:a([^/]+)/:b([^/]+)/:c([^/]+)', carsLanding);
router.get('/cars/:a([^/]+)/:b([^/]+)/:c([^/]+)/:d([^/]+)', carsLanding);

router.get('/cars/:brand([^/]+)', carsList);                // /cars/kia

// городская посадочная модели: /cars/kia/rio/kazan
router.get('/cars/:brand([^/]+)/:model([^/]+)/:city([a-z][a-z0-9-]*)', carsList);
router.get('/cars/:brand([^/]+)/:model/:linkId', carAlone); // Страница автомобиля
router.get('/cars/:brand([^/]+)/:model([^/]+)', carsList);  // /cars/kia/rio
//http://localhost:3000/cars/Chevrolet/Camaro/2021-Tver-3250000-66525km

router.get('/buyout', buyoutPage);

router.get('/contacts/:slug', dealerPage);                  // Страница дилерского центра (контакты)

router.get('/news', newsList);                              // Список статей из базы
router.get('/news/:id(\\d+)', newsPage);                    // Статья из базы

router.get('/documents', documentsPage);                    // Документы из базы (и /documents/ тоже)

router.get('/reviews', reviewsPage);                        // Отзывы с внешних площадок (и /reviews/ тоже)

router.get('/promo', promoList);                            // Список активных акций из базы (и /promo/ тоже)

// личные страницы городов: /kazan, /tver. Всё остальное (статика, админка) отдаём дальше.
// в path-to-regexp 0.1.13 звёздочка внутри инлайн-группы ломает захват, поэтому {0,63} вместо *
router.get('/:city([A-Za-z][-A-Za-z0-9]{0,63})', cityPage);

// города с авто: для блока ссылок на главной и «другие города» на городских страницах
async function getCityLinks(excludeSlug = '') {
    const context = await getLandingContext()
    return [...context.cities.values()]
        .filter((city) => city.slug !== excludeSlug && city.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
        .map((city) => ({slug: city.slug, name: city.name, count: city.count}))
}

async function indexPage(req, res) {
    const manifest = manifest_links['index.html']

    if (!manifest) return res.status(404).send('Vite manifest not found');

    const js1 = manifest.imports && manifest.imports[0].slice(1)
    const js2 = manifest.imports && manifest.imports[1].slice(1)
    const js3 = manifest.imports && manifest.imports[2].slice(1)
    const js4 = manifest.imports && manifest.imports[3].slice(1)
    const js5 = manifest.imports && manifest.imports[4].slice(1)
    const js6 = manifest.imports && manifest.imports[5].slice(1)
    const js7 = manifest.imports && manifest.imports[6].slice(1)
    const js8 = manifest.imports && manifest.imports[7].slice(1)
    const js9 = manifest.file

    const cssFiles = collectCss(manifest_links, 'index.html')

    const carCount = await A_car.getCarCount()
    carCount.length = 20
    carCount.forEach(el => {
        el.latBrand = brandSlug(el.name)
    })

    let page = ''
    const fullUrl = new URL(req.url, `http://${req.headers.host}`);
    let numberPage = parseInt(fullUrl.search.split('=')[1])
    let startPage = null

    if (!isNaN(numberPage) && numberPage > 0) startPage = numberPage

    let {items: carList, totalPages} = await A_car.getLatestCarArrivials(startPage) || [] // на главной список новых авто для краулеров
    // let carList = await GetListService.getSpecials() || []
    if (!carList) carList = []


    if (totalPages) {
        for (let i = 1; i <= totalPages; i++) {
            if(i===1) page += `<a href="/">${i}</a><span> | </span>`;
            else page += `<a href="/?new=${i}">${i}</a><span> | </span>`;
        }
    }

    if (carList) {
        carList.forEach(el => {
            el.latBrand = brandSlug(el.brand)
            el.modelSlug = catalogSlug(el.model)
        })
    }

    // три случайных отзыва с пятью звёздами для блока внизу главной
    const mainReviews = await getRandomFiveStarReviews(3)

    // ссылки на городские страницы: без них новые разделы долго не попадают в индекс
    const cityLinks = await getCityLinks().catch(() => [])

    // сниппет главной: поисковики показывают цифры вместо «звоните по телефону»
    const stats = await A_car.getCatalogStats().catch(() => null)
    const priceRange = stats && Number(stats.priceFrom) > 0 && Number(stats.priceTo) > 0
        ? `, цены от ${formatPrice(stats.priceFrom)} до ${formatPrice(stats.priceTo)} ₽`
        : ''
    // города в описании — только те, для которых знаем предложный падеж,
    // иначе получится «в городе Казань»
    const citiesIn = cityLinks
        .map(link => CITY_PREPOSITIONAL[link.name])
        .filter(Boolean)
        .slice(0, 3)
    const citiesPhrase = citiesIn.length > 1
        ? `${citiesIn.slice(0, -1).join(', ')} и ${citiesIn[citiesIn.length - 1]}`
        : citiesIn[0] || ''
    const homeH1 = 'Автомобили с пробегом в автосалонах Автосеть.РФ'
    const homeCount = stats && Number(stats.count) > 0
        ? `${formatPrice(stats.count)} авто в наличии` : ''
    const title = homeCount ? `${homeH1}: ${homeCount}` : `${homeH1} — купить б/у авто`
    const description = homeCount
        ? `${homeH1}: ${homeCount}${priceRange}.`
            + (citiesPhrase
                ? ` Автосалоны в ${citiesPhrase}${citiesIn.length > 1 ? ', а также в других городах России.' : ' и других городах России.'}`
                : ' Автосалоны в разных городах России.')
            + ' Проверка юридической чистоты, кредит и трейд-ин. ☎ 8-800-500-11-56.'
        : `${homeH1}: проверенные автомобили с пробегом, кредит и трейд-ин. ☎ 8-800-500-11-56.`
    const keywords = 'купить авто с пробегом, б/у автомобили в автосалонах Автосеть.РФ'
        + (citiesIn.length ? `, авто с пробегом в ${citiesIn[0]}` : '')

    res.render('index', {
        js1, js2, js3, js4, js5, js6, js7, js8, js9,
        cssFiles,
        carCount,
        carList,
        mainReviews,
        cityLinks,
        page,
        title,
        description,
        keywords
    })
    return res
}

/* ---------------- личные страницы городов: /kazan, /tver ---------------- */

const CITY_PAGE_CARS = 12
const CITY_PAGE_REVIEWS = 6
const DEALER_REVIEW_FIELDS = ['reviews_yandex', 'reviews_google', 'reviews_2gis', 'reviews_avito']

// Каждый город получает свою главную: локальный ассортимент, витрину города,
// дилерский центр с картой и отзывы. Полный каталог города живёт отдельно —
// /cars/<city>, поэтому здесь только первые CITY_PAGE_CARS машин.
async function cityPage(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    let city
    try {
        const context = await getLandingContext()
        city = context.cities.get(decodePath(req.params.city || '').toLowerCase())
    } catch (error) {
        console.error('Error resolving city page:', error)
        return next()
    }
    // это не город — отдаём путь статике и обработчику 404
    if (!city || city.count <= 0) return next()

    const canonicalPath = '/' + city.slug
    // /Tver, /tver/ и кириллические варианты — дубли адреса, канон один
    if (decodePath(req.path) !== canonicalPath) {
        const queryIndex = req.originalUrl.indexOf('?')
        const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex)
        return res.redirect(301, canonicalPath + query)
    }

    const manifest = manifest_links['cars/index.html']
    if (!manifest) return res.status(404).send('Vite manifest not found')

    const js1 = manifest.imports && manifest.imports[0].slice(1)
    const js2 = manifest.imports && manifest.imports[1].slice(1)
    const js3 = manifest.imports && manifest.imports[2].slice(1)
    const js4 = manifest.imports && manifest.imports[3].slice(1)
    const js5 = manifest.imports && manifest.imports[4].slice(1)
    const js6 = manifest.imports && manifest.imports[5].slice(1)
    const js7 = manifest.imports && manifest.imports[6].slice(1)
    const carsjs = manifest.file

    const cssFiles = collectCss(manifest_links, 'cars/index.html')
    const contacts = findChunk('_contacts-', '.js')
    const contactsCss = (contacts.css && contacts.css[0]) || ''

    try {
        const [stats, brandRows, cars, dealerRows] = await Promise.all([
            A_car.getCityCatalogStats(city.name).catch(() => null),
            A_car.getCityBrandCounts(city.name, 20).catch(() => []),
            A_car.getCityCars(city.name, CITY_PAGE_CARS).catch(() => ({items: [], totalCount: 0})),
            dealers.findAll({where: {city: city.name}, order: [['id', 'ASC']], raw: true}).catch(() => []),
        ])

        const dealerViews = dealerRows.map(buildDealerView).filter(Boolean)
        const reviewLinks = []
        for (const row of dealerRows) {
            for (const field of DEALER_REVIEW_FIELDS) {
                const href = String(row[field] || '').trim()
                if (href) reviewLinks.push(href)
            }
        }
        const cityReviews = await getCityReviews(reviewLinks, CITY_PAGE_REVIEWS).catch(() => [])

        const total = Number(cars.totalCount) || 0
        const priceFrom = Number(stats && stats.priceFrom) || 0
        const priceTo = Number(stats && stats.priceTo) || 0
        const yearFrom = Number(stats && stats.yearFrom) || 0
        const yearTo = Number(stats && stats.yearTo) || 0

        const prepositional = cityIn(city.name)
        const countText = `${formatPrice(total)} ${pluralCars(total)}`
        const priceRange = priceFrom && priceTo
            ? `, цены от ${formatPrice(priceFrom)} до ${formatPrice(priceTo)} ₽`
            : priceFrom ? `, цены от ${formatPrice(priceFrom)} ₽` : ''
        const yearRange = yearFrom && yearTo ? `, ${yearFrom}–${yearTo} г.в` : ''

        const h1 = `Автомобили с пробегом ${prepositional}`
        const firstDealer = dealerViews[0] || null
        // заголовок и описание повторяют H1 и ведут к тем же фактам, что на странице:
        // город, количество, цены, годы и адрес дилерского центра
        const title = total
            ? `${h1}: ${countText} в наличии${priceFrom ? ', цены от ' + formatPrice(priceFrom) + ' ₽' : ''} — автосалон Автосеть.РФ`
            : `${h1} — автосалон Автосеть.РФ`
        const description = total
            ? `Автосалон Автосеть.РФ ${prepositional}: ${countText} с пробегом в наличии${priceRange}${yearRange}.`
                + (firstDealer && firstDealer.addressText ? ` Адрес: ${firstDealer.addressText}.` : '')
                + ' Проверка юридической чистоты, кредит и трейд-ин. ☎ 8-800-500-11-56.'
            : `Автосалон Автосеть.РФ ${prepositional}: проверенные автомобили с пробегом, кредит и трейд-ин. ☎ 8-800-500-11-56.`

        const keywords = `купить авто с пробегом ${prepositional}, автосалон ${city.name}, `
            + `автомобили с пробегом ${city.name}, авто в наличии ${city.name}`

        const carsView = buildCarsView(cars.items)
        const brandLinks = brandRows.map(row => ({
            name: row.name,
            href: '/cars/' + brandSlug(row.name),
            count: Number(row.count) || 0,
        }))

        const vitrinaName = `Автомобили ${prepositional} в наличии`
        const introText = `В автосалоне Автосеть.РФ ${prepositional} ${countText} с пробегом`
            + `${priceRange}${yearRange}. Все автомобили проходят проверку и предпродажную подготовку.`

        const brandNames = brandLinks.slice(0, 8).map(brand => brand.name).join(', ')
        const seoText1 = `Автосалон Автосеть.РФ ${prepositional} предлагает ${countText} с пробегом`
            + `${priceRange}${yearRange}. В наличии `
            + (brandNames ? `такие марки, как ${brandNames}` : 'популярные марки и модели')
            + '. Купить автомобиль можно за наличные, в кредит или по программе трейд-ин: '
            + 'старый автомобиль примем в зачёт стоимости нового.'
        const seoText2 = 'Каждый автомобиль в каталоге проходит юридическую проверку и комплексную диагностику. '
            + `Приезжайте в дилерский центр ${prepositional}, чтобы осмотреть автомобиль и оформить сделку`
            + (firstDealer && firstDealer.tels.length ? `, или позвоните по телефону ${firstDealer.tels[0].value}` : '')
            + '. Полный каталог с фильтрами по марке, кузову и цене доступен на отдельной странице.'

        const otherCities = await getCityLinks(city.slug).catch(() => [])

        const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`
        // query-параметры не меняют выборку города: такие адреса не индексируем
        const robots = Object.keys(req.query).length ? 'noindex, follow' : 'index, follow'

        const breadcrumbSchemaJson = buildBreadcrumbSchema([
            {name: 'Главная', url: `${SCHEMA_SITE}/`},
            {name: city.name, url: canonicalUrl},
        ])
        const carsSchemaJson = carsView.length
            ? buildCarsSchema(cars.items, {
                totalCount: total,
                name: h1,
                path: canonicalPath,
            })
            : ''
        const dealerSchemas = dealerViews.slice(0, 3).map(buildDealerSchema)

        res.render('city', {
            js1, js2, js3, js4, js5, js6, js7,
            carsjs,
            cssFiles,
            contactsCss,
            city,
            citySlug: city.slug,
            cityName: city.name,
            prepositional,
            h1,
            introText,
            title,
            description,
            keywords,
            canonicalUrl,
            robots,
            carsView,
            total,
            countText,
            vitrinaName,
            brandLinks,
            dealerViews,
            cityReviews,
            otherCities,
            seoText1,
            seoText2,
            breadcrumbSchemaJson,
            carsSchemaJson,
            dealerSchemas,
        })
    } catch (error) {
        console.error('Error rendering city page:', error)
        res.status(500).send('Internal Server Error')
    }

    return res
}

async function carsList(req, res, next) {
    const pageNumber = Number(req.params.number) || 0

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

    const cssFiles = collectCss(manifest_links, 'cars/index.html')

    const allBrands = await A_car.getCarCount()
    const brandBySlug = new Map()
    allBrands.forEach(el => {
        if (el.name) brandBySlug.set(brandSlug(el.name), el.name)
    })

    const q = (key) => typeof req.query[key] === 'string' ? req.query[key].trim() : ''
    const rawBrand = typeof req.params.brand === 'string' ? req.params.brand : ''
    const rawModel = typeof req.params.model === 'string' ? req.params.model : ''
    const rawCity = typeof req.params.city === 'string' ? req.params.city : ''
    const pagePrefix = `/cars${pageNumber > 0 ? '/' + pageNumber : ''}`

    // обратная канонизация матрицы: набор фильтров, совпавший с посадочной, живёт в ЧПУ
    if (pageNumber === 0 && !rawBrand && !rawModel && !rawCity) {
        const landingUrl = await matchLandingQuery(req.query).catch(() => null)
        if (landingUrl) return redirectCars(res, req, landingUrl, LANDING_FILTER_KEYS)
    }

    // бренд канонически живёт в пути: /cars?brand=kia → /cars/kia
    let brandCanonical = ''
    let brandDbName = ''
    const sourceBrand = rawBrand || q('brand')
    if (sourceBrand) {
        brandCanonical = brandSlug(sourceBrand)
        brandDbName = brandBySlug.get(brandCanonical) || ''
        // бренда нет в каталоге — не плодим пустую страницу
        if (!brandDbName) return redirectCars(res, req, '/cars', ['brand', 'modelId', 'model'])
    }

    // модели бренда: кластеры нужны и для адресов, и для перелинковки
    let modelIndex = null
    const getModelIndex = async () => {
        if (!modelIndex && brandDbName) modelIndex = buildModelClusters(await A_car.getModelCounts(brandDbName))
        return modelIndex
    }

    // модель канонически живёт в пути: /cars/kia?modelId=... → /cars/kia/rio
    let cluster = null
    if (rawModel) {
        cluster = findCluster(await getModelIndex(), rawModel)
        // такой модели у бренда нет — это не посадочная, возвращаем на бренд
        if (!cluster) return redirectCars(res, req, `${pagePrefix}/${brandCanonical}`, ['brand', 'modelId', 'model'])
        // тонкая модель: отдельная посадочная только размывала бы индекс
        if (cluster.count < MODEL_MIN_CARS) return redirectCars(res, req, `${pagePrefix}/${brandCanonical}`, ['brand', 'modelId', 'model'])
    } else if (brandDbName) {
        const queryModelId = q('modelId')
        let modelName = q('model')
        if (queryModelId) {
            const section = await A_car.getSectionInfo(queryModelId).catch(() => null)
            if (section && section.model) modelName = section.model
        }
        if (modelName) {
            const target = findCluster(await getModelIndex(), modelName)
            if (target && target.count >= MODEL_MIN_CARS) {
                return redirectCars(res, req, `${pagePrefix}/${brandCanonical}/${target.slug}`, ['brand', 'modelId', 'model'])
            }
        }
    }

    // город канонически живёт в пути: /cars/kia/rio?city=Казань → /cars/kia/rio/kazan
    let cityIndex = null
    const getCityIndex = async () => {
        if (!cityIndex && cluster) cityIndex = clusterCityCounts(await A_car.getModelCityCounts(brandDbName), cluster)
        return cityIndex
    }

    let citySlug = ''
    let cityName = ''
    const queryCityRaw = q('city')
    // «Все» — это отсутствие фильтра по городу, а не город: такой адрес не канон
    const queryCity = queryCityRaw === 'Все' ? '' : queryCityRaw
    if (rawCity) {
        const city = cluster ? (await getCityIndex()).get(catalogSlug(rawCity)) : null
        // город неизвестен — возможно, это карточка авто со старым linkId
        if (!city) {
            if (pageNumber > 0) return redirectCars(res, req, `${pagePrefix}/${brandCanonical}/${cluster.slug}`, ['brand', 'modelId', 'model', 'city'])
            return next()
        }
        // в городе мало машин на отдельную посадочную — ведём на страницу модели
        if (city.count < CITY_MODEL_MIN_CARS) {
            return redirectCars(res, req, `${pagePrefix}/${brandCanonical}/${cluster.slug}`, ['brand', 'modelId', 'model', 'city'])
        }
        citySlug = city.slug
        cityName = city.name
    } else if (queryCity && cluster) {
        const city = (await getCityIndex()).get(catalogSlug(queryCity))
        if (city && city.count >= CITY_MODEL_MIN_CARS) {
            return redirectCars(res, req, `${pagePrefix}/${brandCanonical}/${cluster.slug}/${city.slug}`, ['brand', 'modelId', 'model', 'city'])
        }
    }

    // один 301 на канон: /cars/0 → /cars, /cars/Kia → /cars/kia, /cars/kia/ → /cars/kia
    const modelSlugValue = cluster ? cluster.slug : ''
    const firstPagePath = '/cars'
        + (brandCanonical ? '/' + brandCanonical : '')
        + (modelSlugValue ? '/' + modelSlugValue : '')
        + (citySlug ? '/' + citySlug : '')
    const canonicalPath = pagePrefix
        + (brandCanonical ? '/' + brandCanonical : '')
        + (modelSlugValue ? '/' + modelSlugValue : '')
        + (citySlug ? '/' + citySlug : '')
    const dropKeys = ['brand']
    if (cluster) dropKeys.push('modelId', 'model')
    if (citySlug || queryCityRaw === 'Все') dropKeys.push('city')
    const duplicatePathQuery = dropKeys.some(key => req.query[key] !== undefined)
    if (req.path !== canonicalPath || duplicatePathQuery) return redirectCars(res, req, canonicalPath, dropKeys)

    const carCount = allBrands.slice(0, 20)
    carCount.forEach(el => {
        el.latBrand = brandSlug(el.name)
    })

    // те же параметры, что клиент отправляет в /api/getList
    const filters = {}
    for (const key of CARS_FILTER_KEYS) {
        if (req.query[key] !== undefined && req.query[key] !== '') filters[key] = req.query[key]
    }
    delete filters.brand
    if (filters.city === 'Все') delete filters.city
    if (cluster) delete filters.modelId
    if (cityName) filters.city = cityName
    const brandFilter = brandDbName

    const carList = await GetListService.getList({
        ...filters,
        ...(cluster ? {models: cluster.models} : {}),
        brand: brandFilter,
        offset: pageNumber * 20,
        limit: 20
    })

    const carsView = buildCarsView(carList.items)
    const isModelPage = Boolean(cluster)
    const isCityPage = Boolean(citySlug)
    const filterActive = Boolean(brandFilter || isModelPage || Object.keys(filters).length)

    let vitrinaName = 'Автомобили'
    if (isModelPage) {
        vitrinaName = `${brandFilter} ${cluster.display} с пробегом${isCityPage ? ' ' + cityIn(cityName) : ''}`
    } else if (brandFilter) {
        vitrinaName = 'Автомобили ' + brandFilter
    }

    const pagerTail = (brandCanonical ? `/${brandCanonical}` : '')
        + (modelSlugValue ? `/${modelSlugValue}` : '')
        + (citySlug ? `/${citySlug}` : '')
    let page = ''
    const ssr_page_total = Math.ceil(carList.totalCount / 20)
    if (carList.items.length) {
        for (let i = 1; i <= ssr_page_total; i++) {
            const href = i === 1 ? `/cars${pagerTail}` : `/cars/${i - 1}${pagerTail}`
            page += `<a href="${href}">${i}</a><span> | </span>`;
        }
    }

    const pageSuffix = pageNumber > 0 ? ` — страница ${pageNumber + 1}` : ''
    const descriptionSuffix = pageNumber > 0 ? ` Страница ${pageNumber + 1}.` : ''
    // общий каталог: цифры в описании вместо «звоните по телефону»
    const catalogStats = !brandFilter ? await A_car.getCatalogStats().catch(() => null) : null
    let title
    let description
    if (isModelPage) {
        const where = isCityPage ? ' ' + cityIn(cityName) : ''
        const priceFrom = cluster.priceFrom ? `, цены от ${formatPrice(cluster.priceFrom)} ₽` : ''
        const priceTo = cluster.priceTo ? ` до ${formatPrice(cluster.priceTo)} ₽` : ''
        const years = cluster.yearFrom && cluster.yearTo ? `, ${cluster.yearFrom}–${cluster.yearTo} г` : ''
        title = `Купить ${brandFilter} ${cluster.display} с пробегом${where} — ${carList.totalCount} авто в наличии`
        description = `${brandFilter} ${cluster.display} с пробегом${where}: ${carList.totalCount} ${pluralCars(carList.totalCount)} в наличии${priceFrom}${priceTo}${years}. Проверенные авто в автосалонах Автосеть.РФ. ☎ 8-800-500-11-56.`
    } else if (brandFilter) {
        title = `Автомобили ${brandFilter} с пробегом.`
        description = `Купить ${brandFilter} с пробегом: ${formatPrice(carList.totalCount)} авто в наличии, цены, фото и характеристики. Проверенные автомобили в автосалонах Автосеть.РФ. ☎ 8-800-500-11-56.`
    } else {
        const priceRange = catalogStats && Number(catalogStats.priceFrom) > 0 && Number(catalogStats.priceTo) > 0
            ? `, цены от ${formatPrice(catalogStats.priceFrom)} до ${formatPrice(catalogStats.priceTo)} ₽`
            : ''
        title = 'Авто с пробегом (БУ). Купить авто в автосалонах Казани и всей России - Автосеть.РФ'
        description = `Автомобили с пробегом в Казани и других городах России: ${formatPrice(carList.totalCount)} авто в наличии${priceRange}. ✔ Иномарки и Lada, большой выбор марок и моделей б/у в автосалонах Автосеть.РФ — проверка, кредит, обмен. ☎ 8-800-500-11-56.`
    }
    title = title.replace(/\.$/, '') + pageSuffix
    description += descriptionSuffix

    // перелинковка: бренд → модели, модель → города и другие модели бренда
    const baseBrandUrl = brandCanonical ? `/cars/${brandCanonical}` : '/cars'
    let modelLinks = []
    let cityLinks = []
    if (brandCanonical && !isModelPage) {
        modelLinks = [...(await getModelIndex()).clusters.values()]
            .filter(item => item.count >= MODEL_MIN_CARS)
            .sort((a, b) => b.count - a.count)
            .slice(0, 30)
            .map(item => ({
                href: `${baseBrandUrl}/${item.slug}`,
                label: item.display,
                name: `${brandFilter} ${item.display}`,
                count: item.count
            }))
    } else if (isModelPage) {
        modelLinks = [...(await getModelIndex()).clusters.values()]
            .filter(item => item.count >= MODEL_MIN_CARS && item.slug !== cluster.slug)
            .sort((a, b) => b.count - a.count)
            .slice(0, 12)
            .map(item => ({
                href: `${baseBrandUrl}/${item.slug}`,
                label: item.display,
                name: `${brandFilter} ${item.display}`,
                count: item.count
            }))
        cityLinks = [...(await getCityIndex()).values()]
            .filter(item => item.count >= CITY_MODEL_MIN_CARS && item.slug !== citySlug)
            .sort((a, b) => b.count - a.count)
            .slice(0, 16)
            .map(item => ({
                href: `${baseBrandUrl}/${cluster.slug}/${item.slug}`,
                label: item.name,
                name: item.name,
                count: item.count
            }))
    }

    let vitrinaIntro = ''
    if (isModelPage) {
        const where = isCityPage ? ' ' + cityIn(cityName) : ''
        const price = cluster.priceFrom ? ` по цене от ${formatPrice(cluster.priceFrom)} ₽` : ''
        vitrinaIntro = `${brandFilter} ${cluster.display} с пробегом${where}: ${carList.totalCount} проверенных автомобилей${price}. Цены, фото и характеристики — в каталоге Автосеть.РФ.`
    }

    // страницы 2+ — продолжение серии: canonical ведём на первую страницу и не индексируем их сами,
    // но оставляем follow, чтобы краулер доходил до карточек
    const isPaged = pageNumber > 0
    const canonicalUrl = `${SITE_ORIGIN}${isPaged ? firstPagePath : canonicalPath}`
    // фильтровые адреса не индексируем, но ссылки внутри оставляем проходимыми
    const pathQueryKeys = new Set(['brand'])
    if (cluster) {
        pathQueryKeys.add('modelId')
        pathQueryKeys.add('model')
    }
    if (citySlug) pathQueryKeys.add('city')
    const filterQuery = CARS_FILTER_KEYS.some(key => !pathQueryKeys.has(key) && req.query[key] !== undefined && req.query[key] !== '')
    const robots = filterQuery || isPaged ? 'noindex, follow' : 'index, follow'

    const ssr_brandSearch = brandDbName
    const carsSSRJson = JSON.stringify({
        items: carList.items,
        totalCount: carList.totalCount
    }).replaceAll('<', '\\u003c')

    const carsSchemaJson = buildCarsSchema(carList.items, {
        totalCount: carList.totalCount,
        brand: brandCanonical,
        model: modelSlugValue,
        city: citySlug,
        page: pageNumber,
        brandName: brandFilter,
        modelName: cluster ? cluster.display : '',
        cityName
    })

    const breadcrumbItems = [
        {name: 'Главная', url: `${SCHEMA_SITE}/`},
        {name: 'Автомобили', url: `${SCHEMA_SITE}/cars`},
    ]
    if (brandCanonical) {
        breadcrumbItems.push({name: brandFilter || brandCanonical, url: `${SCHEMA_SITE}/cars/${brandCanonical}`})
    }
    if (isModelPage) {
        breadcrumbItems.push({
            name: `${cluster.display} с пробегом`,
            url: `${SCHEMA_SITE}/cars/${brandCanonical}/${modelSlugValue}`
        })
    }
    if (isCityPage) {
        breadcrumbItems.push({
            name: cityName,
            url: `${SCHEMA_SITE}/cars/${brandCanonical}/${modelSlugValue}/${citySlug}`
        })
    }
    const breadcrumbSchemaJson = buildBreadcrumbSchema(breadcrumbItems)

    // сохранённый пользователем вид витрины, чтобы SSR сразу рисовал нужную сетку
    const viewMatch = /(?:^|;\s*)TYPE_VIEW=(dot8|dot4|dot1)/.exec(req.headers.cookie || '')
    const viewClass = viewMatch ? viewMatch[1] : 'dot8'

    res.render('cars', {
        js1, js2, js3, js4, js5, js6, js7,
        carsjs,
        cssFiles,
        carCount,
        carList,
        carsView,
        carsSSRJson,
        carsSchemaJson,
        breadcrumbSchemaJson,
        vitrinaName,
        vitrinaIntro,
        filterActive,
        viewClass,
        page,
        brand: brandCanonical,
        brandName: brandFilter,
        modelSlug: modelSlugValue,
        modelName: cluster ? cluster.display : '',
        citySlug,
        cityName,
        modelLinks,
        cityLinks,
        landingCrumbs: [],
        landingLinkBlocks: [],
        landingJson: 'null',
        ssr_page: pageNumber, ssr_page_total, ssr_brandSearch, ssr_brandSlug: brandCanonical,
        ssr_modelSlug: modelSlugValue, ssr_modelName: cluster ? cluster.display : '',
        ssr_citySlug: citySlug, ssr_cityName: cityName,
        ssrModelsJson: JSON.stringify(cluster ? cluster.models : []).replaceAll('<', '\\u003c'),
        title, description, canonicalUrl, robots
    })
    return res
}

const CARS_FILTER_KEYS = [
    'brand', 'modelId', 'city', 'color', 'gearboxType', 'engineType', 'bodyType', 'wheelType',
    'driveType', 'engineCapacity', 'yearReleasedFrom', 'yearReleasedTo',
    'priceFrom', 'priceTo', 'milleageFrom', 'milleageTo', 'priceOrder'
]

// фильтры, которые в матрице выражены сегментами пути
const LANDING_FILTER_KEYS = ['city', 'bodyType', 'gearboxType', 'priceFrom', 'priceTo']
const LANDING_FILTER_SET = new Set(LANDING_FILTER_KEYS)

// разбор матричного ЧПУ и отдача страницы; если путь не наш — отдаём следующему обработчику
async function carsLanding(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    let landing
    try {
        landing = await parseLanding(req)
    } catch (error) {
        console.error('Error parsing landing:', error)
        return next()
    }
    if (!landing) return next()
    // слеш на конце матричных ЧПУ — дубль адреса, канон без него
    if (req.path.length > 1 && req.path.endsWith('/')) {
        return res.redirect(301, req.path.replace(/\/+$/, '') + req.originalUrl.slice(req.path.length))
    }
    if (landing.redirect) return res.redirect(301, landing.redirect + req.originalUrl.slice(req.path.length))
    try {
        return await renderCarsLanding(res, req, landing)
    } catch (error) {
        console.error('Error rendering cars landing:', error)
        return next()
    }
}

async function renderCarsLanding(res, req, landing) {
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

    const cssFiles = collectCss(manifest_links, 'cars/index.html')

    const pageNumber = Number(landing.page) || 0
    const path = landingPath(landing)

    const pathFilters = {}
    if (landing.city) pathFilters.city = landing.city.name
    if (landing.body) pathFilters.bodyType = landing.body.title
    if (landing.gearbox) pathFilters.gearboxType = landing.gearbox.title
    if (landing.price && landing.price.from) pathFilters.priceFrom = landing.price.from
    if (landing.price && landing.price.to) pathFilters.priceTo = landing.price.to

    // дополнительные фильтры из строки запроса в матрицу не входят: страница остаётся, но не индексируется
    const filters = {...pathFilters}
    for (const key of CARS_FILTER_KEYS) {
        if (LANDING_FILTER_SET.has(key)) continue
        if (req.query[key] !== undefined && req.query[key] !== '') filters[key] = req.query[key]
    }
    const hasExtraFilters = Object.keys(filters).length > Object.keys(pathFilters).length

    const carList = await GetListService.getList({
        ...filters,
        offset: pageNumber * 20,
        limit: 20
    })

    // порог — свойство самой посадочной, query-фильтры его не понижают
    const landingTotal = hasExtraFilters
        ? (await GetListService.getList({...pathFilters, limit: 1, offset: 0})).totalCount
        : carList.totalCount

    // ниже порога посадочная не нужна: отдаём вес родителю вместе с фильтрами из query
    if ((landingTotal || 0) < LANDING_MIN_CARS) {
        return redirectCars(res, req, landingParentPath(landing), LANDING_FILTER_KEYS)
    }
    if (pageNumber > 0 && !carList.items.length) {
        return redirectCars(res, req, path, LANDING_FILTER_KEYS)
    }

    const allBrands = await A_car.getCarCount()
    const carCount = allBrands.slice(0, 20)
    carCount.forEach(el => {
        el.latBrand = brandSlug(el.name)
    })

    const carView = buildCarsView(carList.items)
    const cityName = landing.city ? landing.city.name : ''
    const cityLabel = cityName ? ' ' + cityIn(cityName) : ''
    const priceLabel = landing.price ? ' ' + landing.price.label : ''
    const countText = `${formatPrice(carList.totalCount)} ${pluralCars(carList.totalCount)} в наличии`

    let vitrinaName
    if (landing.gearbox) {
        vitrinaName = `Автомобили ${landing.gearbox.phrase}${cityLabel}`
    } else if (landing.body) {
        vitrinaName = `${landing.body.plural} с пробегом${cityLabel}${priceLabel}`
    } else {
        vitrinaName = `Автомобили с пробегом${cityLabel}${priceLabel}`
    }

    const pageSuffix = pageNumber > 0 ? ` — страница ${pageNumber + 1}` : ''
    let title
    if (landing.gearbox) {
        title = `Автомобили ${landing.gearbox.phrase}${cityLabel} — ${countText}`
    } else if (landing.body) {
        title = `Купить ${landing.body.plural.toLowerCase()} с пробегом${cityLabel}${priceLabel} — ${countText}`
    } else {
        title = `Автомобили с пробегом${cityLabel}${priceLabel} — ${countText}`
    }
    title = title.replace(/\.$/, '') + pageSuffix
    const description = `${vitrinaName}: ${countText}. Цены, фото и характеристики, проверенные авто в автосалонах Автосеть.РФ. ☎ 8-800-500-11-56.`
        + (pageNumber > 0 ? ` Страница ${pageNumber + 1}.` : '')
    const vitrinaIntro = `${vitrinaName}: ${countText}. Цены, фото и характеристики — в каталоге Автосеть.РФ.`

    let page = ''
    const ssr_page_total = Math.ceil(carList.totalCount / 20)
    if (carList.items.length) {
        for (let i = 1; i <= ssr_page_total; i++) {
            const href = i === 1 ? path : `${path}/${i - 1}`
            page += `<a href="${href}">${i}</a><span> | </span>`;
        }
    }

    const landingCrumbs = []
    if (landing.city) {
        landingCrumbs.push({name: landing.city.name, href: '/cars/' + landing.city.slug})
    }
    if (landing.body) {
        const href = (landing.city ? '/cars/' + landing.city.slug : '/cars') + '/' + landing.body.slug
        landingCrumbs.push({name: landing.body.plural, href})
    }
    if (landing.price) landingCrumbs.push({name: landing.price.label, href: path})
    if (landing.gearbox) landingCrumbs.push({name: landing.gearbox.crumb, href: path})

    const breadcrumbItems = [
        {name: 'Главная', url: `${SCHEMA_SITE}/`},
        {name: 'Автомобили', url: `${SCHEMA_SITE}/cars`},
        ...landingCrumbs.map(item => ({name: item.name, url: SCHEMA_SITE + item.href}))
    ]
    const breadcrumbSchemaJson = buildBreadcrumbSchema(breadcrumbItems)

    const linkData = await getLandingLinkData().catch(() => null)
    const landingLinkBlocks = linkData ? buildLandingLinkBlocks(landing, linkData) : []

    const carsSchemaJson = buildCarsSchema(carList.items, {
        totalCount: carList.totalCount,
        page: pageNumber,
        cityName,
        path,
        name: vitrinaName
    })

    const carsSSRJson = JSON.stringify({
        items: carList.items,
        totalCount: carList.totalCount
    }).replaceAll('<', '\\u003c')

    const landingJson = JSON.stringify({
        path,
        page: pageNumber,
        city: cityName,
        bodyType: landing.body ? landing.body.title : '',
        gearboxType: landing.gearbox ? landing.gearbox.title : '',
        priceFrom: landing.price && landing.price.from ? String(landing.price.from) : '',
        priceTo: landing.price && landing.price.to ? String(landing.price.to) : ''
    }).replaceAll('<', '\\u003c')

    // страницы 2+ и доп. фильтры — продолжение выборки: canonical на первую страницу, noindex
    const canonicalUrl = `${SITE_ORIGIN}${path}`
    const robots = pageNumber > 0 || hasExtraFilters ? 'noindex, follow' : 'index, follow'

    const viewMatch = /(?:^|;\s*)TYPE_VIEW=(dot8|dot4|dot1)/.exec(req.headers.cookie || '')
    const viewClass = viewMatch ? viewMatch[1] : 'dot8'

    res.render('cars', {
        js1, js2, js3, js4, js5, js6, js7,
        carsjs,
        cssFiles,
        carCount,
        carList,
        carsView: carView,
        carsSSRJson,
        carsSchemaJson,
        breadcrumbSchemaJson,
        vitrinaName,
        vitrinaIntro,
        filterActive: true,
        viewClass,
        page,
        brand: '',
        brandName: '',
        modelSlug: '',
        modelName: '',
        citySlug: landing.city ? landing.city.slug : '',
        cityName,
        modelLinks: [],
        cityLinks: [],
        landingCrumbs,
        landingLinkBlocks,
        landingJson,
        ssr_page: pageNumber, ssr_page_total, ssr_brandSearch: '', ssr_brandSlug: '',
        ssr_modelSlug: '', ssr_modelName: '',
        ssr_citySlug: landing.city ? landing.city.slug : '', ssr_cityName: cityName,
        ssrModelsJson: '[]',
        title, description, canonicalUrl, robots
    })
    return res
}

const formatPrice = (val) => parseInt(val).toLocaleString('ru-RU')

// «1 автомобиль», «2 автомобиля», «5 автомобилей» — для описаний в сниппете
function pluralCars(count) {
    const n = Math.abs(Number(count) || 0)
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return 'автомобиль'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'автомобиля'
    return 'автомобилей'
}

// повторяет prepareCars + createNode из src/js/filter, чтобы SSR и клиент давали одинаковую вёрстку
function buildCarsView(items) {
    return items.map(el => {
        let images = (el.images || []).map(src => src || '/st/photo/nophoto.webp')
        if (!images.length) images = ['/st/photo/nophoto.webp']

        const info = formatPrice(el.milleage) + ' км, '
            + (el.engineCapacity ? escapeHtml(el.engineCapacity) : '')
            + (el.gearboxType ? ' ' + escapeHtml(el.gearboxType) : '')
            + (el.enginePower ? ' (' + escapeHtml(el.enginePower) + '&nbsp;л.с)' : '')
            + (el.bodyType ? ', ' + escapeHtml(el.bodyType) : '')
            + ', ' + escapeHtml(el.driveType || '')
            + (el.engineType ? ', ' + escapeHtml(el.engineType) : '')

        const frendly = carFriendly(el.yearReleased, el.city, el.price, el.milleage)

        return {
            id: el.id,
            href: carPath(el.brand || '', el.model || '', frendly),
            name: `${el.brand || ''} ${el.model || ''}`,
            yearReleased: el.yearReleased,
            price: formatPrice(el.price),
            fromPerMonth: formatPrice(parseInt(el.price / 90.12)),
            info,
            address: `${el.city || ''} ${el.fullAddress || ''}`,
            images
        }
    })
}

// schema.org для витрины: список собирается из тех же машин, что отрисованы на странице,
// поэтому разметка обновляется вместе с базой. Для подборки берём автомобили разных марок
// (без автобусов, фургонов и грузовых) в диапазоне 400 000–800 000 ₽; если таких нет — весь список.
const SCHEMA_SITE = SITE_ORIGIN
const SCHEMA_PRICE_FROM = 400000
const SCHEMA_PRICE_TO = 800000
const SCHEMA_MAX_ITEMS = 10
const NON_PASSENGER_BODY_TYPES = new Set(['Автобус', 'Фургон', 'Грузовой'])

function absoluteCarUrl(car) {
    const friendly = carFriendly(car.yearReleased, car.city, car.price, car.milleage)
    return SCHEMA_SITE + carPath(car.brand || '', car.model || '', friendly)
}

function absoluteCarImage(car) {
    const src = car.images?.[0]
    if (!src) return `${SCHEMA_SITE}/st/auto.webp`
    const big = src.replace('_small.webp', '_big.webp')
    return /^https?:\/\//.test(big) ? big : `${SCHEMA_SITE}${big.startsWith('/') ? '' : '/'}${big}`
}

function pickSchemaCars(items) {
    const picked = []
    const brands = new Set()

    for (const car of items) {
        const price = Number(car.price)
        if (!(price >= SCHEMA_PRICE_FROM && price <= SCHEMA_PRICE_TO)) continue
        if (NON_PASSENGER_BODY_TYPES.has(car.bodyType)) continue

        const brand = String(car.brand || '').toLowerCase()
        if (brands.has(brand)) continue
        brands.add(brand)
        picked.push(car)
        if (picked.length >= SCHEMA_MAX_ITEMS) break
    }

    return picked.length ? picked : items.slice(0, SCHEMA_MAX_ITEMS)
}

function buildCarsSchema(items, {totalCount, brand, model, city, page, brandName, modelName, cityName, path, name: nameOverride}) {
    const cars = pickSchemaCars(items)
    const pageNumber = Number(page) || 0
    // numberOfItems — сколько авто подходит под выборку целиком, а не только в разметке;
    // itemListElement ограничен SCHEMA_MAX_ITEMS, иначе страница вырастает в разы
    const itemsTotal = Number(totalCount)
    const numberOfItems = Number.isFinite(itemsTotal) && itemsTotal > 0 ? itemsTotal : cars.length
    const tail = [brand, model, city].filter(Boolean).map(part => '/' + encodeURIComponent(part)).join('')
    const url = path
        ? `${SCHEMA_SITE}${path}` + (pageNumber > 0 ? `/${pageNumber}` : '')
        : `${SCHEMA_SITE}/cars` + (pageNumber > 0 ? `/${pageNumber}` : '') + tail
    const where = city ? ' ' + cityIn(cityName || city) : ''
    const name = nameOverride || (model
        ? `Автомобили ${brandName || brand} ${modelName || model}${where}`
        : brand ? `Автомобили ${brandName || brand}` : 'Автомобили в наличии')

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        description: cars.some((car) => Number(car.price) >= SCHEMA_PRICE_FROM && Number(car.price) <= SCHEMA_PRICE_TO)
            ? 'Автомобили разных марок с пробегом в наличии по цене от 400 000 до 800 000 рублей'
            : 'Список автомобилей в наличии с ценами и характеристиками',
        url,
        numberOfItems,
        itemListElement: cars.map((car, index) => {
            const carUrl = absoluteCarUrl(car)
            const image = absoluteCarImage(car)
            const name = `${car.brand} ${car.model}`
            const mileage = Number(car.milleage)

            return {
                '@type': 'ListItem',
                position: index + 1,
                name: `${name} ${car.yearReleased}`,
                url: carUrl,
                image,
                item: {
                    '@type': 'Car',
                    name,
                    brand: {'@type': 'Brand', name: car.brand},
                    model: car.model,
                    vehicleModelDate: String(car.yearReleased),
                    modelDate: String(car.yearReleased),
                    ...(car.color ? {color: car.color} : {}),
                    ...(car.bodyType ? {bodyType: car.bodyType} : {}),
                    ...(Number.isFinite(mileage)
                        ? {mileageFromOdometer: {'@type': 'QuantitativeValue', value: mileage, unitCode: 'KMT'}}
                        : {}),
                    image,
                    url: carUrl,
                    offers: {
                        '@type': 'Offer',
                        url: carUrl,
                        price: String(car.price),
                        priceCurrency: 'RUB',
                        availability: 'https://schema.org/InStock',
                        itemCondition: mileage > 0
                            ? 'https://schema.org/UsedCondition'
                            : 'https://schema.org/NewCondition',
                        seller: {'@type': 'Organization', name: 'Автосеть.РФ'},
                    },
                },
            }
        }),
    }

    // '<' экранируем, чтобы данные не могли закрыть тег script
    return JSON.stringify(schema).replaceAll('<', '\\u003c')
}

// словари для schema.org: в базе значения на русском, разметка ждёт английские
const CAR_BODY_SCHEMA = {
    'Седан': 'Sedan',
    'Хетчбэк': 'Hatchback',
    'Универсал': 'Station Wagon',
    'Внедорожник': 'SUV',
    'Лифтбек': 'Liftback',
    'Пикап': 'Pickup',
    'Купе': 'Coupe',
    'Минивэн': 'Minivan',
    'Фургон': 'Van',
    'Автобус': 'Bus',
}
const CAR_GEARBOX_SCHEMA = {
    'Механическая': 'Manual',
    'Автоматическая': 'Automatic',
    'Робот': 'Automated manual',
    'Вариатор': 'CVT',
}
const CAR_FUEL_SCHEMA = {
    'Бензиновый': 'Petrol',
    'Дизельный': 'Diesel',
    'Гибридный': 'Hybrid',
    'Электро': 'Electric',
}
const CAR_DRIVE_SCHEMA = {
    'Передний': 'https://schema.org/FrontWheelDriveConfiguration',
    'Задний': 'https://schema.org/RearWheelDriveConfiguration',
    'Полный': 'https://schema.org/AllWheelDriveConfiguration',
}

// schema.org Car + Offer для карточки авто: разметка на тех же данных, что видны на странице
function buildCarSchema(car, url) {
    const mileage = Number(car.milleage)
    const capacity = Number(car.engineCapacity)
    const power = Number(car.enginePower)
    const hasMileage = Number.isFinite(mileage) && mileage > 0
    const hasDisplacement = Number.isFinite(capacity) && capacity > 0
    const hasPower = Number.isFinite(power) && power > 0
    const images = (Array.isArray(car.images) ? car.images : []).map(src => {
        const big = src.replace('_small.webp', '_big.webp')
        return /^https?:\/\//.test(big) ? big : `${SCHEMA_SITE}${big.startsWith('/') ? '' : '/'}${big}`
    })

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Car',
        name: `${car.brand} ${car.model} ${car.yearReleased}`,
        brand: {'@type': 'Brand', name: car.brand},
        model: car.model,
        vehicleModelDate: String(car.yearReleased),
        modelDate: String(car.yearReleased),
        url,
        image: images.length ? images : `${SCHEMA_SITE}/st/auto.webp`,
        ...(car.color ? {color: car.color} : {}),
        ...(car.bodyType ? {bodyType: CAR_BODY_SCHEMA[car.bodyType] || car.bodyType} : {}),
        ...(hasMileage ? {mileageFromOdometer: {'@type': 'QuantitativeValue', value: mileage, unitCode: 'KMT'}} : {}),
        ...(car.gearboxType ? {vehicleTransmission: CAR_GEARBOX_SCHEMA[car.gearboxType] || car.gearboxType} : {}),
        ...(car.engineType ? {fuelType: CAR_FUEL_SCHEMA[car.engineType] || car.engineType} : {}),
        ...(CAR_DRIVE_SCHEMA[car.driveType] ? {driveWheelConfiguration: CAR_DRIVE_SCHEMA[car.driveType]} : {}),
        ...(hasDisplacement || hasPower ? {
            vehicleEngine: {
                '@type': 'EngineSpecification',
                ...(hasDisplacement
                    ? {engineDisplacement: {'@type': 'QuantitativeValue', value: Number((capacity / 1000).toFixed(1)), unitCode: 'LTR'}}
                    : {}),
                ...(hasPower ? {enginePower: {'@type': 'QuantitativeValue', value: power, unitCode: 'BHP'}} : {}),
            },
        } : {}),
        offers: {
            '@type': 'Offer',
            url,
            price: Number(car.price),
            priceCurrency: 'RUB',
            availability: 'https://schema.org/InStock',
            itemCondition: hasMileage ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
            seller: {'@type': 'Organization', name: 'Автосеть.РФ', url: SCHEMA_SITE},
        },
    }

    // '<' экранируем, чтобы данные не могли закрыть тег script
    return JSON.stringify(schema).replaceAll('<', '\\u003c')
}

// хлебные крошки в разметке: уровни повторяют видимую строку под шапкой.
// Google требует item у каждого уровня (у последнего допустимо опустить), поэтому
// крошку без ссылки в середине — модель без посадочной — в разметку не берём:
// иначе Search Console ругается «Missing field "item" (in "itemListElement")»
function buildBreadcrumbSchema(items, pageUrl = '') {
    const levels = items
        .map((item, index) => index === items.length - 1 && !item.url && pageUrl
            ? {...item, url: pageUrl}
            : item)
        .filter(item => item.url)

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: levels.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    }

    return JSON.stringify(schema).replaceAll('<', '\\u003c')
}

// устаревшие адреса /cars/car.html?id=<uuid> остались в поисковой выдаче:
// 301 в каталог сохраняет вес ссылок, которые иначе терялись на 410 Gone
function legacyCarPage(req, res) {
    return res.redirect(301, '/cars')
}

async function carAlone(req, res) {

    if (req.params.brand.startsWith('src')) {
        return res.send(); // Пропускает этот маршрут и идет искать другие (или выдаст 404)
    }

    try {
        const {brand, model, linkId} = req.params;
        if (!linkId) return res.send()

        let manifest = manifest_links['cars/car.html']

        if (!manifest) return res.status(404).send('Vite manifest not found');


        let js1 = manifest.imports && manifest.imports[0].slice(1)
        let js2 = manifest.imports && manifest.imports[1].slice(1)
        let js3 = manifest.imports && manifest.imports[2].slice(1)
        let js4 = manifest.imports && manifest.imports[3].slice(1)
        let js5 = manifest.imports && manifest.imports[4].slice(1)
        let carjs = manifest.file

        const cssFiles = collectCss(manifest_links, 'cars/car.html')

        let carData = await A_car.getAutoByLinkId(linkId)

        // авто удалено из системы: 301 на живую посадочную модели или бренда вместо 410 —
        // редирект сохраняет поисковый трафик и передаёт вес релевантной странице
        if (!carData) return res.redirect(301, await deletedCarTarget(brand, model))

        // один канонический адрес карточки: бренд и модель в нижнем регистре, как у посадочных.
        // строчные варианты и старые адреса вида /cars/VAZ(LADA)/... уходят сюда одним 301
        const brandSlugValue = brandSlug(carData.brand || '')
        const modelSlugValue = catalogSlug(carData.model || '')
        const canonicalPath = carPath(carData.brand, carData.model, carData.linkId)
        if (decodePath(req.path) !== canonicalPath) {
            const queryIndex = req.originalUrl.indexOf('?')
            const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex)
            return res.redirect(301, canonicalPath + query)
        }

        // H1 карточки — короткое название, а title и description собираем под запросы
        // «бренд модель год купить с пробегом город»
        const displayBrand = carData.brand
        const displayModel = carData.model
        const carName = `${displayBrand} ${displayModel} ${carData.yearReleased}`
        const lowerFirst = (value) => value ? String(value).charAt(0).toLowerCase() + String(value).slice(1) : ''
        const carCity = carData.city ? ' ' + cityIn(carData.city) : ''
        const carPrice = carData.price ? `${formatPrice(carData.price)} ₽` : ''
        const carMileage = carData.milleage ? ` с пробегом ${formatPrice(carData.milleage)} км` : ''
        const carSpecs = []
        if (carData.engineType) carSpecs.push(`${lowerFirst(carData.engineType)} двигатель${carData.enginePower ? ' ' + carData.enginePower + ' л.с.' : ''}`)
        if (carData.gearboxType) carSpecs.push(`${lowerFirst(carData.gearboxType)} коробка передач`)
        if (carData.driveType) carSpecs.push(`${lowerFirst(carData.driveType)} привод`)

        const title = `Купить ${displayBrand} ${displayModel} ${carData.yearReleased} с пробегом${carCity}${carPrice ? ' — ' + carPrice : ''}`;
        const description = `${displayBrand} ${displayModel} ${carData.yearReleased} года${carMileage}${carCity}: цена ${carPrice}${carSpecs.length ? ', ' + carSpecs.join(', ') : ''}. Купить с пробегом в автосалоне Автосеть.РФ — проверка, кредит и обмен. ☎ 8-800-500-11-56.`;
        const keywords = carData.configuration;
        const carSchemaJson = buildCarSchema(carData, SCHEMA_SITE + canonicalPath)

        // модель в крошках ссылается на посадочную только если она существует, иначе остаётся названием
        let modelCrumbUrl = ''
        if (brandSlugValue && modelSlugValue) {
            const modelIndex = buildModelClusters(await A_car.getModelCounts(carData.brand))
            const cluster = findCluster(modelIndex, carData.model)
            if (cluster && cluster.count >= MODEL_MIN_CARS) {
                modelCrumbUrl = `${SCHEMA_SITE}/cars/${brandSlugValue}/${cluster.slug}`
            }
        }
        const breadcrumbSchemaJson = buildBreadcrumbSchema([
            {name: 'Главная', url: `${SCHEMA_SITE}/`},
            {name: 'Автомобили', url: `${SCHEMA_SITE}/cars`},
            ...(brandSlugValue
                ? [{name: carData.brand, url: `${SCHEMA_SITE}/cars/${brandSlugValue}`}]
                : []),
            ...(carData.model
                ? [{name: `${carData.brand} ${carData.model}`, ...(modelCrumbUrl ? {url: modelCrumbUrl} : {})}]
                : []),
            {name: carName},
        ], SCHEMA_SITE + canonicalPath)

        res.render('car', {
            carName,
            carSchemaJson,
            breadcrumbSchemaJson,
            title,
            description,
            keywords,
            js1, js2, js3, js4, js5,
            carjs,
            cssFiles,
            carData,
            brand, model, linkId,
            canonicalUrl: canonicalPath ? SCHEMA_SITE + canonicalPath : '',
            brandSlugValue,
            modelSlugValue
        });
    } catch (error) {
        console.error('Error rendering car page:', error);
        res.status(500).send('Internal Server Error');
    }
    return res

}

// старый сайт открывал бронирование по VIN: /reserve?vin=... — так индексировалась бОльшая часть сайта.
// авто ещё в продаже → 301 на карточку, удалено → 301 в каталог: редирект сохраняет поисковый трафик
async function legacyReserve(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    const vin = typeof req.query.vin === 'string' ? req.query.vin.trim() : ''
    const auto = typeof req.query.auto === 'string' ? req.query.auto.trim() : ''
    // действующее бронирование передаёт auto=brand/model/linkId — эту форму не трогаем
    if (!vin || auto) return next()

    let car = null
    try {
        car = await A_car.getAutoByVin(vin)
    } catch (error) {
        return next()
    }

    if (car && car.brand && car.linkId) {
        return res.redirect(301, carPath(car.brand, car.model, car.linkId))
    }

    return res.redirect(301, '/cars')
}

async function buyoutPage(req, res) {
    const manifest = manifest_links['index.html']

    if (!manifest) return res.status(404).send('Vite manifest not found');

    const js1 = manifest.imports && manifest.imports[0].slice(1)
    const js2 = manifest.imports && manifest.imports[1].slice(1)

    let css1
    for (const manifestKey in manifest_links) {
        if (manifestKey.includes('_style-') && manifestKey.includes('.css')) css1 = manifestKey.slice(1)
    }

    // Выполняем GET-запрос //  лучше полагаться к стороннему сервису
    // const targetUrl = 'https://live.autonet.pro/api/auto/getBrands'; // Адрес стороннего сервера
    // const response = await fetch(targetUrl);
    // if (!response.ok) throw new Error(`22===22 Ошибка сервера: ${response.status}`);
    // const data = await response.json(); // Парсим JSON из ответа
    // console.log('22==22 data = ', data)


    res.render('buyout', {
        js1, js2,
        css1,
    })
    return res
}

async function dealerPage(req, res) {
    try {
        const dealer = await dealers.findOne({
            where: {link: `/contacts/${req.params.slug}`},
            attributes: ['id', 'city', 'url', 'coords', 'address', 'tel', 'days', 'profile', 'brands', 'email', 'link'],
            raw: true,
        })

        if (!dealer) return res.status(404).render('404', {confirm: ''})

        const view = buildDealerView(dealer)
        const title = `${dealer.city}, ${view.addressText} — дилерский центр Автосеть.РФ`
        const description = `Дилерский центр Автосеть.РФ: ${dealer.city}, ${view.addressText}.`
            + (dealer.tel ? ` Телефон: ${dealer.tel}.` : '')
            + (dealer.days ? ` Режим работы: ${dealer.days}.` : '')

        res.render('dealer', {
            ...contactAssets(),
            ...view,
            title,
            description,
        })
    } catch (error) {
        console.error('Error rendering dealer page:', error)
        res.status(500).send('Internal Server Error')
    }
    return res
}


export default router;