import React from 'react'

const isFilled = (value) => {
    const text = (value || '').trim()
    return text !== '' && text !== '-'
}

const CHROME_JUNK = /chrome_annotation/i

const ClientAddress = ({ record }) => {
    const city = (record?.params?.city || '').trim()
    const address = (record?.params?.address || '').trim()

    const hasCity = isFilled(city)
    const hasAddress = isFilled(address) && !CHROME_JUNK.test(address)

    let text = '-'

    if (hasCity && hasAddress) {
        text = address.toLowerCase().startsWith(city.toLowerCase())
            ? address
            : `${city}, ${address}`
    } else if (hasCity) {
        text = city
    } else if (hasAddress) {
        text = address
    }

    return (
        <span
            style={{
                display: 'inline-block',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
            }}
            title={text}
        >
            {text}
        </span>
    )
}

export default ClientAddress
