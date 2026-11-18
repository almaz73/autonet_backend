// канонические адреса каталога: бренд → модель → город.
// модуль общий для SSR-роутера и генератора sitemap, чтобы адреса совпадали
import {transliterate} from './transliterate.js'

// ниже этих порогов посадочная не индексируется: тонкие страницы только размывают индекс
export const MODEL_MIN_CARS = 3
export const CITY_MODEL_MIN_CARS = 5

export function catalogSlug(value) {
    return transliterate(String(value ?? ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

// «дружелюбная» часть адреса карточки: год-город-цена-пробег
export function carFriendly(year, city, price, mileage) {
    return transliterate(`${year}-${city}-${price}-${mileage}km`.replaceAll(' ', ''))
}

// канонический адрес карточки: бренд и модель — те же слаги, что у посадочных,
// поэтому /cars/VAZ(LADA)/Granta/... и /cars/Hyundai/i30/... уходят в один регистр
export function carPath(brand, model, friendly) {
    return `/cars/${catalogSlug(brand)}/${catalogSlug(model)}/${friendly}`
}

// «RIO» → «Rio», «X-LINE» → «X-Line», «RioX-Line» не трогаем
export function displayModel(name) {
    const raw = String(name ?? '').trim()
    if (!raw) return ''
    return raw.split(/\s+/).map(word => word.split('-').map(part =>
        part.length > 1 && part === part.toUpperCase()
            ? part.charAt(0) + part.slice(1).toLowerCase()
            : part
    ).join('-')).join(' ')
}

// вариант модели — только слитное написание: «riox» к «rio», но не «rio-x-line»,
// «granta-cross» и «rio-x-line» — самостоятельные модели со своими посадочными.
// «320» к модели «3» тоже не вариант: цифра после цифры это другая модель
function isModelVariant(slug, base) {
    if (slug === base) return true
    if (!slug.startsWith(base)) return false
    const next = slug.charAt(base.length)
    return /[a-z]/.test(next) && base.length >= 3
}

function addStats(cluster, row) {
    cluster.count += Number(row.count) || 0
    const priceFrom = Number(row.priceFrom)
    const priceTo = Number(row.priceTo)
    const yearFrom = Number(row.yearFrom)
    const yearTo = Number(row.yearTo)
    if (Number.isFinite(priceFrom) && priceFrom > 0 && (!cluster.priceFrom || priceFrom < cluster.priceFrom)) cluster.priceFrom = priceFrom
    if (Number.isFinite(priceTo) && priceTo > 0 && (!cluster.priceTo || priceTo > cluster.priceTo)) cluster.priceTo = priceTo
    if (Number.isFinite(yearFrom) && yearFrom > 0 && (!cluster.yearFrom || yearFrom < cluster.yearFrom)) cluster.yearFrom = yearFrom
    if (Number.isFinite(yearTo) && yearTo > 0 && (!cluster.yearTo || yearTo > cluster.yearTo)) cluster.yearTo = yearTo
}

// строки getModelCounts → кластеры моделей одного бренда.
// варианты одной модели («RIO», «RIO X-LINE», «RioX») сводим в одну посадочную
export function buildModelClusters(rows) {
    const models = []
    for (const row of rows) {
        const slug = catalogSlug(row.model)
        if (!slug) continue
        models.push({...row, slug})
    }
    // базовые модели короче вариантов, поэтому обрабатываем их первыми
    models.sort((a, b) => a.slug.length - b.slug.length || a.slug.localeCompare(b.slug))

    const clusters = new Map()
    const members = new Map()

    for (const row of models) {
        let cluster = null
        for (const candidate of clusters.values()) {
            if (isModelVariant(row.slug, candidate.slug)) {
                if (!cluster || candidate.slug.length > cluster.slug.length) cluster = candidate
            }
        }

        if (!cluster) {
            cluster = {
                slug: row.slug,
                name: row.model,
                display: displayModel(row.model),
                models: [],
                count: 0,
                priceFrom: null,
                priceTo: null,
                yearFrom: null,
                yearTo: null,
            }
            clusters.set(cluster.slug, cluster)
        } else {
            addStats(cluster, row)
            cluster.models.push(row.model)
            members.set(row.slug, cluster.slug)
            continue
        }

        addStats(cluster, row)
        cluster.models.push(row.model)
    }

    return {clusters, members}
}

// строки getCityCounts → slug → {slug, name, count}
export function buildCityMap(rows) {
    const cities = new Map()
    for (const row of rows) {
        const slug = catalogSlug(row.city)
        if (!slug) continue
        const city = cities.get(slug) || {slug, name: row.city, count: 0}
        city.count += Number(row.count) || 0
        cities.set(slug, city)
    }
    return cities
}

// строки getModelCityCounts (по бренду) → для кластера: slug города → {slug, name, count}
export function clusterCityCounts(rows, cluster) {
    const names = new Set(cluster.models.map(model => String(model).toUpperCase()))
    const cities = new Map()
    for (const row of rows) {
        if (!names.has(String(row.model || '').toUpperCase())) continue
        const slug = catalogSlug(row.city)
        if (!slug) continue
        const city = cities.get(slug) || {slug, name: row.city, count: 0}
        city.count += Number(row.count) || 0
        cities.set(slug, city)
    }
    return cities
}
