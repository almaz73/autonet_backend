import React from 'react'

const ClientLink = ({ record }) => {
    const link = record?.params?.link

    if (!link) return null

    const isAbsolute = /^https?:\/\//i.test(link)
    const isRelative = link.startsWith('/')

    if (!isAbsolute && !isRelative) return link

    let text = 'автосеть.рф'

    try {
        const url = new URL(link, 'https://xn--80aej9aped4f.xn--p1ai')
        const match = url.pathname.match(/\/cars\/(.+?)\/?$/i)
        const slug = match?.[1]

        if (slug && slug.toLowerCase() !== 'car.html') {
            try {
                text = decodeURI(slug)
            } catch {
                text = slug
            }
        }
    } catch {
        // некорректный URL — показываем «сайт»
    }

    return (
        <a href={link} target="_blank" rel="noopener noreferrer">
            {text}
        </a>
    )
}

export default ClientLink
