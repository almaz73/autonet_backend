import Router from 'express'
import zlib from 'node:zlib'
import {Op} from 'sequelize'
import A_car from "../API/A_car.js";
import {dealers, news} from '../clientBaza/db.js'
import {manifest_links, transliterate, RussianBrandsRus, RussianBrandsLat} from '../constants.js';
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

function contactAssets() {
    const style = findChunk('_style-', '.js')
    const main = findChunk('_main-', '.js')
    const contacts = findChunk('_contacts-', '.js')
    return {
        styleJs: style.file || '',
        styleCss: (style.css && style.css[0]) || '',
        mainJs: main.file || '',
        contactsCss: (contacts.css && contacts.css[0]) || '',
    }
}

/** КОНЕЦ подготовка к работе с отдельными контактами **/

/** Динамические страницы статей из таблицы news **/

const NEWS_LIST_DESCRIPTION = 'Статьи Автосеть.РФ о покупке подержанных автомобилей: проверка истории, кредит, трейд-ин, обслуживание и выбор авто с пробегом.'

// общие стили и скрипты для серверных страниц статей
function newsAssets() {
    const style = findChunk('_style-', '.js')
    const main = findChunk('_main-', '.js')
    const pagination = findChunk('_pagination-', '.js')
    // до пересборки Vite стили статей могут лежать отдельным чанком,
    // после неё news.css включён в общий style.css
    const newsCss = findChunk('_news-', '.css')
    return {
        jsFiles: [style.file, main.file, pagination.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
        cssFiles: [style.css?.[0], newsCss.file]
            .filter(Boolean)
            .map((file) => file.replace(/^assets\//, '')),
    }
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
        // канонический адрес списка — со слешем на конце
        if (!req.path.endsWith('/')) {
            const query = req.originalUrl.split('?')[1]
            return res.redirect(301, query ? `/news/?${query}` : '/news/')
        }

        const requestedPage = Math.max(1, parseInt(req.query.PAGEN_2, 10) || 1)
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

        const pageHref = (page) => page === 1 ? '/news/' : `/news/?PAGEN_2=${page}`

        res.render('news-list', {
            ...newsAssets(),
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

        // канонический адрес статьи — из базы, со слешем на конце
        if (req.path !== row.url) return res.redirect(301, row.url)

        // в части старых страниц заголовок h1 не входит в content — добавляем его из name
        const hasH1 = /^\s*<h1[\s>]/i.test(String(row.content || ''))
        const content = hasH1
            ? row.content
            : `<h1>${escapeHtml(row.name)}</h1>\n${row.content || ''}`

        res.render('news', {
            ...newsAssets(),
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

// router.use(seoRedirects)

router.get('/', indexPage);                                 // Главная страница

router.get('/cars', carsList);                              // Страница витрины /cars
router.get('/cars/:number(\\d+)', carsList);                // Страница витрины /cars
router.get('/cars/:number(\\d+)/:brand(\\D+)', carsList);   // Страница витрины /cars

router.get('/cars/:brand(\\D+)/:model/:linkId', carAlone);  // Страница автомобиля
//http://localhost:3000/cars/Chevrolet/Camaro/2021-Tver-3250000-66525km

router.get('/buyout', buyoutPage);

router.get('/contacts/:slug', dealerPage);                  // Страница дилерского центра (контакты)

router.get('/news', newsList);                              // Список статей из базы
router.get('/news/:id(\\d+)', newsPage);                    // Статья из базы


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
        if (RussianBrandsRus.includes(el.name)) el.latBrand = transliterate(el.name).replaceAll(" ", "");
        else el.latBrand = el.name
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
            if (RussianBrandsRus.includes(el.brand)) el.latBrand = transliterate(el.brand).replaceAll(" ", "");
            else el.latBrand = el.brand
        })
    }

    res.render('index', {
        js1, js2, js3, js4, js5, js6, js7, js8, js9,
        cssFiles,
        carCount,
        carList,
        page
    })
    return res
}

async function carsList(req, res) {
    let {brand, number: ssr_page} = req.params
    ssr_page = ssr_page || 0

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

    let ssr_brandSearch = brand
    let placeRusBrand = RussianBrandsLat.findIndex(el => el === brand)
    if (placeRusBrand !== -1) ssr_brandSearch = RussianBrandsRus[placeRusBrand]

    // те же параметры, что клиент отправляет в /api/getList
    const filters = {}
    for (const key of CARS_FILTER_KEYS) {
        if (req.query[key] !== undefined && req.query[key] !== '') filters[key] = req.query[key]
    }
    const brandFilter = filters.brand || ssr_brandSearch

    const carList = await GetListService.getList({
        ...filters,
        brand: brandFilter,
        offset: ssr_page * 20,
        limit: 20
    })
    carCount.forEach(el => {
        if (RussianBrandsRus.includes(el.name)) el.latBrand = transliterate(el.name).replaceAll(" ", "");
        else el.latBrand = el.name
    })

    const carsView = buildCarsView(carList.items)
    const filterActive = Boolean(brandFilter)

    let vitrinaName = 'Автомобили'
    if (filterActive) {
        vitrinaName = 'Автомобили ' + (brandFilter || '') + ' ' + (filters.model || '')
            + (filters.city ? `(город ${filters.city})` : '')
    }

    let page = ''
    let ssr_page_total = Math.ceil(carList.totalCount / 20)
    if (carList.items.length) {
        for (let i = 1; i <= ssr_page_total; i++) {
            page += `<a href="/cars/${i - 1}${brand ? '/' + brand : ''}">${i}</a><span> | </span>`;
        }
    }

    let title = 'Авто с пробегом (БУ). Купить авто в автосалонах Казани и всей России - Автосеть.РФ'
    if (brand) title = `Автомобили ${ssr_brandSearch} с пробегом.`

    const carsSSRJson = JSON.stringify({
        items: carList.items,
        totalCount: carList.totalCount
    }).replaceAll('<', '\\u003c')

    const carsSchemaJson = buildCarsSchema(carList.items, {brand, page: ssr_page, brandName: ssr_brandSearch})

    // сохранённый пользователем вид витрины, чтобы SSR сразу рисовал нужную сетку
    const viewMatch = /(?:^|;\s*)TYPE_VIEW=(dot8|dot4|dot1)/.exec(req.headers.cookie || '')
    const viewClass = viewMatch ? viewMatch[1] : 'dot8'

    res.render('cars', {
        js1, js2, js3, js4, js5, js6, js7,
        carsjs,
        css1, css2, css3,
        carCount,
        carList,
        carsView,
        carsSSRJson,
        carsSchemaJson,
        vitrinaName,
        filterActive,
        viewClass,
        page,
        brand,
        ssr_page, ssr_page_total, ssr_brandSearch,
        title
    })
    return res
}

const CARS_FILTER_KEYS = [
    'brand', 'modelId', 'city', 'color', 'gearboxType', 'engineType', 'bodyType', 'wheelType',
    'driveType', 'engineCapacity', 'yearReleasedFrom', 'yearReleasedTo',
    'priceFrom', 'priceTo', 'milleageFrom', 'milleageTo', 'priceOrder'
]

const formatPrice = (val) => parseInt(val).toLocaleString('ru-RU')

const getBrandLat = (brandName) => {
    const place = RussianBrandsRus.indexOf(brandName)
    return place !== -1 ? RussianBrandsLat[place] : brandName
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

        const frendly = transliterate(`${el.yearReleased}-${el.city}-${el.price}-${el.milleage}km`.replaceAll(' ', ''))

        return {
            id: el.id,
            href: `/cars/${getBrandLat(el.brand)}/${transliterate(el.model).replaceAll(' ', '')}/${frendly}`,
            name: `${el.brand} ${el.model}`,
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
// поэтому разметка обновляется вместе с базой. Для подборки берём легковые автомобили
// разных марок в диапазоне 400 000–800 000 ₽; если таких на странице нет — весь список.
const SCHEMA_SITE = SITE_ORIGIN
const SCHEMA_PRICE_FROM = 400000
const SCHEMA_PRICE_TO = 800000
const SCHEMA_MAX_ITEMS = 10
const NON_PASSENGER_BODY_TYPES = new Set(['Автобус', 'Фургон', 'Грузовой'])

function absoluteCarUrl(car) {
    const friendly = transliterate(`${car.yearReleased}-${car.city}-${car.price}-${car.milleage}km`.replaceAll(' ', ''))
    return `${SCHEMA_SITE}/cars/${getBrandLat(car.brand)}/${transliterate(car.model).replaceAll(' ', '')}/${friendly}`
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

function buildCarsSchema(items, {brand, page, brandName}) {
    const cars = pickSchemaCars(items)
    const pageNumber = Number(page) || 0
    const url = `${SCHEMA_SITE}/cars`
        + (pageNumber > 0 ? `/${pageNumber}` : '')
        + (brand ? `/${encodeURIComponent(brand)}` : '')

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: brand ? `Автомобили ${brandName || brand}` : 'Автомобили в наличии',
        description: cars.some((car) => Number(car.price) >= SCHEMA_PRICE_FROM && Number(car.price) <= SCHEMA_PRICE_TO)
            ? 'Легковые автомобили разных марок в наличии по цене от 400 000 до 800 000 рублей'
            : 'Список автомобилей в наличии с ценами и характеристиками',
        url,
        numberOfItems: cars.length,
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

        let css1
        let css2 = manifest.css && manifest.css[0]
        let css3 = manifest.css && manifest.css[1]
        for (let manifestKey in manifest_links) {
            if (manifestKey.includes('_style-') && manifestKey.includes('.css')) css1 = manifestKey.slice(1)
        }

        let carData = await A_car.getAutoByParams(brand, model, linkId)

        // авто удалено из системы: 410 Gone + noindex, чтобы поисковики убрали страницу из индекса
        const gone = !carData

        // Generate title and description based on car data
        const title = gone
            ? `Автомобиль ${brand} ${model} снят с продажи - Автосеть.РФ`
            : `${carData.brand} ${carData.model} ${carData.yearReleased}  ${carData.prop_address ? ' - ' + carData.prop_address : ''}`;
        const description = gone
            ? 'Автомобиль снят с продажи и больше недоступен.'
            : `Купить ${carData.brand} ${carData.model} ${carData.yearReleased} года выпуска с пробегом в ${carData.city} за ${carData.price} рублей. Характеристики: ${carData.engineType} двигатель, ${carData.enginePower} л.с., ${carData.gearboxType} коробка передач, ${carData.driveType} привод.`;
        const keywords = gone ? '' : carData.configuration;

        if (gone) res.status(410)

        res.render('car', {
            gone,
            title,
            description,
            keywords,
            js1, js2, js3, js4, js5,
            carjs,
            css1, css2, css3,
            carData,
            brand, model, linkId
        });
    } catch (error) {
        console.error('Error rendering car page:', error);
        res.status(500).send('Internal Server Error');
    }
    return res

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

        const addressText = stripTags(dealer.address)
        const splitList = (value) => String(value || '').split(',').map((part) => part.trim()).filter(Boolean)
        const tels = splitList(dealer.tel).map((value) => ({value, href: telHref(value)}))
        const profiles = splitList(dealer.profile)
        const email = String(dealer.email || '').trim()
        const title = `${dealer.city}, ${addressText} — дилерский центр Автосеть.РФ`
        const description = `Дилерский центр Автосеть.РФ: ${dealer.city}, ${addressText}.`
            + (dealer.tel ? ` Телефон: ${dealer.tel}.` : '')
            + (dealer.days ? ` Режим работы: ${dealer.days}.` : '')

        res.render('dealer', {
            ...contactAssets(),
            dealer,
            addressHtml: formatMultiline(dealer.address),
            addressText,
            brands: String(dealer.brands || '').split(',').map((brand) => brand.trim()).filter(Boolean),
            profiles,
            tels,
            email,
            photoUrl: dealer.url ? encodeURI(dealer.url) : '',
            mapSrc: buildDealerMapSrc(dealer),
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