import React from 'react'

const newsImageSrc = (value) => {
    if (!value) return null
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value
    return `/st/photo/news/${value}`
}

const NewsPhoto = ({record}) => {
    const src = newsImageSrc(record?.params?.image)

    if (!src) return <span style={{color: '#898A9A'}}>—</span>

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            style={{
                width: 96,
                height: 54,
                objectFit: 'cover',
                borderRadius: 4,
                display: 'block',
            }}
        />
    )
}

export default NewsPhoto
