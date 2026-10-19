import React from 'react'

const PromoPhoto = ({ record, property }) => {
    const value = record?.params?.[property.path]

    if (!value) return null

    const src = value.startsWith('/') || /^https?:\/\//.test(value)
        ? value
        : `/pub_promo/${value}`

    return (
        <img
            src={src}
            alt=""
            style={{width: 50, height: 'auto', display: 'block', borderRadius: 4}}
        />
    )
}

export default PromoPhoto
