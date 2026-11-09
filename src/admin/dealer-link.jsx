import React from 'react'

const DealerLink = ({ record }) => {
    const link = record?.params?.link

    if (!link) return null

    // в списке показываем ЧПУ-адрес без префикса /contacts/
    const slug = String(link).split('/').filter(Boolean).pop() ?? link

    return (
        <a href={link} target="_blank" rel="noopener noreferrer" title={link}>
            {slug}
        </a>
    )
}

export default DealerLink
