import React, {useEffect} from 'react'

// id открытой на редактирование акции: его пишет PromoEdit, список подсвечивает строку
export const LAST_EDITED_KEY = 'promoLastEditedId'

const readLastEdited = () => {
    try {
        const value = Number(window.sessionStorage.getItem(LAST_EDITED_KEY))
        return Number.isInteger(value) && value > 0 ? value : null
    } catch {
        return null
    }
}

const highlightCss = (resourceId, id) => `
    tr[data-css="${resourceId}-table-row"][data-id="${id}"] > td {
        background: #fee !important;
       
    }
    tr[data-css="${resourceId}-table-row"][data-id="${id}"] > td:first-child {
        box-shadow: inset 4px 0 0 pink;
    }
`

// обёртка над таблицей списка: подсвечиваем последнюю открытую акцию
const PromoListTable = ({OriginalComponent, resource, records, ...props}) => {
    const editedId = resource?.id === 'promo' ? readLastEdited() : null

    useEffect(() => {
        if (!editedId) return
        const selector = `tr[data-css="${resource.id}-table-row"][data-id="${editedId}"]`
        if (!document.querySelector(selector)) return // акции нет на текущей странице

        const scrollToRow = () => {
            const row = document.querySelector(selector)
            if (row) row.scrollIntoView({block: 'start'})
        }

        // строки растут по мере загрузки фото и сдвигают выделенную акцию — прокручиваем ещё раз,
        // когда таблица меняет высоту, плюс перекрываем восстановление позиции браузером при «назад»
        let debounce
        const scheduleScroll = () => {
            clearTimeout(debounce)
            debounce = setTimeout(scrollToRow, 120)
        }

        scrollToRow()
        scheduleScroll()

        const table = document.querySelector(selector)?.closest('table')
        const observer = table ? new ResizeObserver(scheduleScroll) : null
        observer?.observe(table)
        const stop = setTimeout(() => observer?.disconnect(), 3000)

        return () => {
            clearTimeout(debounce)
            clearTimeout(stop)
            observer?.disconnect()
        }
    }, [editedId, records])

    return (
        <>
            {editedId ? <style>{highlightCss(resource.id, editedId)}</style> : null}
            <OriginalComponent resource={resource} records={records} {...props}/>
        </>
    )
}

export default PromoListTable
