import React from 'react'

// ячейки списка истории: раздел записи и её название (для контакта — город)
const ChangeHistoryCell = ({record, property}) => {
    const params = record?.params ?? {}
    const isPromo = params.promo_id != null

    if (property.path === 'promo_id') {
        return <span>{isPromo ? 'Акция' : 'Контакт'}</span>
    }

    return <span>{isPromo ? params.promo_name : params.dealer_city}</span>
}

export default ChangeHistoryCell
