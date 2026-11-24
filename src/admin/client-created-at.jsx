import React from 'react'

// created_at хранится строкой вида "2026-10-30 12:56:59";
// в списке соглашений показываем только дату, без часов и минут
const ClientCreatedAt = ({ record }) => {
    const value = record?.params?.created_at

    if (!value) return null

    const [year, month, day, hours, minutes] = String(value).split(/[- :]/);

    if (!year) return <>{value}</>

    return <>{`${day}.${month}.${year}  ${hours}:${minutes}`}</>
}

export default ClientCreatedAt
