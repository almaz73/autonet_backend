import React from 'react'

const NewsLink = ({record}) => {
    const url = record?.params?.url

    if (!url) return null

    return (
        <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
        </a>
    )
}

export default NewsLink
