import React from 'react'

// длины названия в списке: 50 знаков, остальное скрываем под троеточием
const NAME_LIMIT = 50

const truncate = (value) => {
    const text = String(value ?? '')
    return text.length > NAME_LIMIT ? `${text.slice(0, NAME_LIMIT - 3)}...` : text
}

const sectionOf = (params) => {
    if (params.news_id != null) return 'Статья'
    if (params.promo_id != null) return 'Акция'
    return 'Контакт'
}

// ячейки списка истории: раздел записи и её название (для контакта — город)
const ChangeHistoryCell = ({record, property}) => {
    const params = record?.params ?? {}

    if (property.path === 'promo_id') {
        return <span>{sectionOf(params)}</span>
    }

    // полное название остаётся в title: его видно при наведении мыши
    const name = params.news_id != null
        ? params.news_name
        : params.promo_id != null
            ? params.promo_name
            : params.dealer_city

    return <span title={name ?? ''}>{truncate(name)}</span>
}

export default ChangeHistoryCell
