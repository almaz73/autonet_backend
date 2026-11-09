import React from 'react'

// created_at хранится строкой вида "2026-10-30 12:56:59";
// в списке соглашений показываем только дату, без часов и минут
const ClientCreatedAt = ({ record }) => {
    const value = record?.params?.created_at

    if (!value) return null

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))

    if (!match) return <>{value}</>

    return <>{`${match[3]}.${match[2]}.${match[1]}`}</>
}

export default ClientCreatedAt
