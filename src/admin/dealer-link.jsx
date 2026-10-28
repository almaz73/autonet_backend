import React from 'react'

const DealerLink = ({ record }) => {
    const link = record?.params?.link

    if (!link) return null

    return (
        <a href={link} target="_blank" rel="noopener noreferrer">
            link
        </a>
    )
}

export default DealerLink
