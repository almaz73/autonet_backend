import React from 'react'

const PromoLink = ({ record }) => {
    const code = record?.params?.code

    if (!code) return null

    const href = `/promo/${code}/`

    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {code}
        </a>
    )
}

export default PromoLink
