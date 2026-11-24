import React from 'react'
import { ValueGroup } from '@adminjs/design-system'

// created_at хранится строкой вида "2026-10-30 12:56:59";
// и в списке, и при просмотре показываем одно и то же: 30.10.2026 12:56
const formatCreatedAt = (value) => {
    if (!value) return null

    const [year, month, day, hours, minutes] = String(value).split(/[- :]/)

    if (!year) return String(value)

    return `${day}.${month}.${year}  ${hours}:${minutes}`
}

const ClientCreatedAt = ({ record, where }) => {
    const text = formatCreatedAt(record?.params?.created_at)

    // на странице просмотра AdminJS не рисует подпись для кастомных компонентов
    if (where === 'show') return <ValueGroup label="Создано">{text}</ValueGroup>

    return <>{text}</>
}

export default ClientCreatedAt
