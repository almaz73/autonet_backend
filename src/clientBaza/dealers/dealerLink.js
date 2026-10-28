import {transliterate} from '../../constants.js'

// /contacts/kazan-prPobedy212k2 — город латиницей + адрес в camelCase
export function buildDealerLink(city, address) {
    const citySlug = transliterate(String(city || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')

    const addressSlug = String(address || '')
        .replace(/<[^>]*>/g, ' ')
        .split(/[^0-9a-zA-Zа-яА-ЯёЁ]+/)
        .filter(Boolean)
        .map(transliterate)
        .map((word, index) => index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')

    return `/contacts/${citySlug}-${addressSlug}`
}
