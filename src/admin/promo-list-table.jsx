import React, {useEffect} from 'react'

// id последней открытой записи: его пишет edit-компонент (или клик по строке там, где редактирования нет),
// список подсвечивает строку
const storageKey = (resourceId) => `${resourceId}LastEditedId`

export const writeLastEditedId = (resourceId, id) => {
    try {
        window.sessionStorage.setItem(storageKey(resourceId), String(id))
    } catch {
        // sessionStorage недоступен — просто не подсветим
    }
}

const readLastEditedId = (resourceId) => {
    try {
        const value = Number(window.sessionStorage.getItem(storageKey(resourceId)))
        return Number.isInteger(value) && value > 0 ? value : null
    } catch {
        return null
    }
}

// разделы, в которых запоминаем последнюю открытую запись
const TRACKED_RESOURCES = ['promo', 'dealers', 'news', 'clientEmails']

// у соглашений нет редактирования: запоминаем запись по клику в списке,
// остальные разделы пишут id из своих edit-компонентов
const CLICK_TRACKED_RESOURCES = ['clientEmails']

const highlightCss = (resourceId, id) => `
    tr[data-css="${resourceId}-table-row"][data-id="${id}"] > td {
        background: #fee !important;
       
    }
    tr[data-css="${resourceId}-table-row"][data-id="${id}"] > td:first-child {
        box-shadow: inset 4px 0 0 pink;
    }
`

// обёртка над таблицей списка: подсвечиваем последнюю открытую запись
const PromoListTable = ({OriginalComponent, resource, records, ...props}) => {
    const editedId = resource && TRACKED_RESOURCES.includes(resource.id)
        ? readLastEditedId(resource.id)
        : null

    useEffect(() => {
        if (!resource || !CLICK_TRACKED_RESOURCES.includes(resource.id)) return

        const rememberClick = (event) => {
            const row = event.target?.closest?.(`tr[data-css="${resource.id}-table-row"]`)
            const id = row?.getAttribute('data-id')
            if (id) writeLastEditedId(resource.id, id)
        }

        document.addEventListener('click', rememberClick, true)
        return () => document.removeEventListener('click', rememberClick, true)
    }, [resource?.id])

    useEffect(() => {
        if (!editedId) return
        const selector = `tr[data-css="${resource.id}-table-row"][data-id="${editedId}"]`
        if (!document.querySelector(selector)) return // записи нет на текущей странице

        const scrollToRow = () => {
            const row = document.querySelector(selector)
            if (row) row.scrollIntoView({block: 'start'})
        }

        // строки растут по мере загрузки фото и сдвигают выделенную запись — прокручиваем ещё раз,
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
            {resource?.id === 'promo' ? (
                <div style={{marginTop: 12, fontSize: 14, color: '#898A9A'}}>
                    Не забывайте удалять старые акции.
                </div>
            ) : null}
        </>
    )
}

export default PromoListTable
