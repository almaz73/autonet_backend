import React from 'react'

const PromoPhoto = ({ record, property }) => {
    const value = record?.params?.[property.path]

    if (!value) return null

    let src = value.startsWith('/') || /^https?:\/\//.test(value)
        ? value
        : `/pub_promo/${value}`

    src = src + '?v=' + Date.now()
    return (
        <img
            src={src}
            alt=""
            style={{width: 120, height: 'auto', display: 'block', borderRadius: 4}}
        />
    )
}

export default PromoPhoto
