import React from 'react'

const PromoBool = ({record, property}) => {
    const value = record?.params?.[property.path]
    const yes = value === true || value === 'true' || value === 1

    return <span title={yes ? 'да' : 'нет'}>{yes ? '✅' : '❗'}</span>
}

export default PromoBool
