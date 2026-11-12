import React from 'react'

const DocumentLink = ({record}) => {
    const link = record?.params?.link
    if (!link) return <span style={{color: '#898A9A'}}>—</span>

    const label = record?.params?.file || String(link).split('/').pop()

    return (
        <a href={link} target="_blank" rel="noopener noreferrer" title={link}>
            {label}
        </a>
    )
}

export default DocumentLink
