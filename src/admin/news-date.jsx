import React from 'react'

// date хранится как "2025-05-22"; в списке показываем привычное ДД.ММ.ГГГГ
const NewsDate = ({record}) => {
    const value = record?.params?.date

    if (!value) return null

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))

    if (!match) return <>{value}</>

    return <>{`${match[3]}.${match[2]}.${match[1]}`}</>
}

export default NewsDate
