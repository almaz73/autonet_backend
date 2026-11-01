import React, {useEffect, useRef, useState} from 'react'
import {ApiClient, useNotice} from 'adminjs'
import {Box, Button, H3, Icon, Label, Text} from '@adminjs/design-system'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const SLOT_LABELS = {
    photo278: '278х402',
    photo585: '585х200',
    photo1200: '1200х501',
}

// как в promoDAO: текст центрируется в точке (x, y), размер — в пикселях базового фото
const textOverlayStyle = ({leftPct, topPct, color, fontSizePx, dragging, ghost}) => ({
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: 'translate(-50%, -50%)',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    fontSize: fontSizePx,
    lineHeight: 1.2,
    whiteSpace: 'pre',
    textAlign: 'center',
    color,
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    opacity: ghost ? 0.4 : 1,
    pointerEvents: 'auto',
})

// редактор текста поверх фото акции:
// холстом всегда служит исходник _blank (если он уже есть), поэтому повторная
// лепка идёт по чистому фото, а не поверх старой надписи
const PhotoTextEditor = ({
    resourceId,
    recordId,
    photoProperty,
    photoName,
    previewVersion,
    initialText = '',
    initialStyle = null,
    onClose,
    onSaved,
}) => {
    // размер и положение храним в пикселях базового файла фото
    const [text, setText] = useState(initialText)
    const [color, setColor] = useState(initialStyle?.color ?? '#ffffff')
    const [fontSize, setFontSize] = useState(initialStyle?.fontSize ?? 0)
    const [pos, setPos] = useState({x: initialStyle?.x ?? 0, y: initialStyle?.y ?? 0})
    const [natural, setNatural] = useState({width: 0, height: 0})
    const [box, setBox] = useState({width: 0, height: 0})
    const [dragging, setDragging] = useState(false)
    const [saving, setSaving] = useState(false)
    const [blankFailed, setBlankFailed] = useState(false)
    const sendNotice = useNotice()
    const imgRef = useRef(null)
    const dragStart = useRef(null)
    const hasInitialStyle = useRef(Number(initialStyle?.fontSize) > 0)

    const isAbsoluteUrl = (value) => /^https?:/.test(value) || value.startsWith('/')
    const mainSrc = photoName && !isAbsoluteUrl(photoName)
        ? `/pub_promo/${photoName}${previewVersion ? `?v=${previewVersion}` : ''}`
        : photoName
    const blankSrc = photoName
        ? `/pub_promo/${photoName.replace(/\.webp$/, '')}_blank.webp${previewVersion ? `?v=${previewVersion}` : ''}`
        : null
    const canvasSrc = !blankFailed && blankSrc ? blankSrc : mainSrc

    useEffect(() => {
        setText(initialText)
    }, [initialText])

    useEffect(() => {
        const syncBox = () => {
            if (!imgRef.current) return
            const rect = imgRef.current.getBoundingClientRect()
            setBox({width: rect.width, height: rect.height})
        }
        window.addEventListener('resize', syncBox)
        return () => window.removeEventListener('resize', syncBox)
    }, [])

    // предел ползунка — четверть высоты фото, как и прежние 25%
    const maxFontSize = Math.max(8, Math.round((natural.height || 400) * 0.25))
    // панель показывает фото уменьшенным, поэтому размер текста пересчитываем в экранный
    const scale = natural.width && box.width ? box.width / natural.width : 1

    const onImgLoad = (event) => {
        const img = event.currentTarget
        const width = img.naturalWidth
        const height = img.naturalHeight
        const rect = img.getBoundingClientRect()
        setNatural({width, height})
        setBox({width: rect.width, height: rect.height})

        if (hasInitialStyle.current) {
            // фото могли заменить на другого размера — держим надпись в границах
            setFontSize((size) => clamp(size, 4, Math.max(8, Math.round(height * 0.25))))
            setPos((point) => ({x: clamp(point.x, 0, width), y: clamp(point.y, 0, height)}))
            return
        }
        hasInitialStyle.current = true
        setFontSize(Math.max(4, Math.round(height * 0.03)))
        setPos({x: Math.round(width / 2), y: Math.round(height * 0.95)})
    }

    const onTextPointerDown = (event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragStart.current = {px: event.clientX, py: event.clientY, x: pos.x, y: pos.y}
        setDragging(true)
    }

    const onTextPointerMove = (event) => {
        if (!dragStart.current || !imgRef.current || !natural.width) return
        const rect = imgRef.current.getBoundingClientRect()
        const start = dragStart.current
        setPos({
            x: clamp(start.x + (event.clientX - start.px) / rect.width * natural.width, 0, natural.width),
            y: clamp(start.y + (event.clientY - start.py) / rect.height * natural.height, 0, natural.height),
        })
    }

    const onTextPointerUp = () => {
        dragStart.current = null
        setDragging(false)
    }

    const save = async () => {
        const formData = new FormData()
        formData.append('recordId', String(recordId))
        formData.append('photoSlot', photoProperty)
        formData.append('text', text)
        formData.append('color', color)
        formData.append('fontSize', String(Math.round(fontSize)))
        formData.append('x', String(Math.round(pos.x)))
        formData.append('y', String(Math.round(pos.y)))

        setSaving(true)
        try {
            const {data} = await new ApiClient().resourceAction({
                resourceId,
                actionName: 'applyPhotoText',
                data: formData,
                method: 'POST',
            })
            if (data?.error) {
                sendNotice({type: 'error', message: data.error})
                return
            }
            sendNotice({type: 'success', message: text ? 'Текст сохранён на фото' : 'Фото восстановлено без текста'})
            // сохраняем всю запись целиком, поэтому ждём окончания записи
            await onSaved({inscriptions: data?.inscriptions ?? null, styles: data?.styles ?? null})
        } catch (error) {
            sendNotice({type: 'error', message: error.response?.data?.error ?? 'Не удалось сохранить текст'})
        } finally {
            setSaving(false)
        }
    }

    const fontSizePx = Math.max(6, Math.round(fontSize * scale))
    const overlayStyle = textOverlayStyle({
        leftPct: natural.width ? pos.x / natural.width * 100 : 50,
        topPct: natural.height ? pos.y / natural.height * 100 : 95,
        color,
        fontSizePx,
        dragging,
        ghost: !text,
    })

    return (
        <Box
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                overflow: 'auto',
                padding: 24,
            }}
        >
            <Box
                style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: 24,
                    maxWidth: 940,
                    width: '100%',
                    margin: 'auto',
                }}
            >
                <H3 mb="xl">
                    Надпись на фото {SLOT_LABELS[photoProperty] ?? ''}
                </H3>
                <Box flex flexWrap="wrap">
                    <Box flex="1" mr="xl" mb="default" style={{minWidth: 280}}>
                        <Box
                            style={{
                                position: 'relative',
                                display: 'inline-block',
                                lineHeight: 0,
                            }}
                        >
                            <img
                                ref={imgRef}
                                src={canvasSrc}
                                alt=""
                                onLoad={onImgLoad}
                                onError={() => {
                                    if (!blankFailed && blankSrc) setBlankFailed(true)
                                }}
                                style={{maxWidth: '100%', display: 'block'}}
                            />
                            <div
                                style={overlayStyle}
                                onPointerDown={onTextPointerDown}
                                onPointerMove={onTextPointerMove}
                                onPointerUp={onTextPointerUp}
                            >
                                {text || 'Текст'}
                            </div>
                        </Box>
                        <Text mt="default" color="grey60">
                            Перетащите надпись мышью, чтобы выбрать место на фото
                        </Text>
                    </Box>

                    <Box style={{width: 280, flexShrink: 0}}>
                        <Label>Текст надписи</Label>
                        <textarea
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            rows={4}
                            placeholder="Например: Скидка 10%"
                            style={{
                                width: '100%',
                                padding: 8,
                                border: '1px solid #B9BBC6',
                                borderRadius: 4,
                                fontFamily: 'inherit',
                                fontSize: 14,
                                boxSizing: 'border-box',
                            }}
                        />

                        <Box mt="lg">
                            <Label>Цвет</Label>
                            <input
                                type="color"
                                value={color}
                                onChange={(event) => setColor(event.target.value)}
                                style={{width: 48, height: 32, padding: 0, border: '1px solid #B9BBC6', borderRadius: 4}}
                            />
                        </Box>

                        <Box mt="lg">
                            <Label>Размер текста: {Math.round(fontSize)} px</Label>
                            <input
                                type="range"
                                min="4"
                                max={maxFontSize}
                                step="1"
                                value={clamp(Math.round(fontSize) || 4, 4, maxFontSize)}
                                onChange={(event) => setFontSize(parseInt(event.target.value, 10))}
                                style={{width: '100%'}}
                            />
                        </Box>

                        <Box mt="xl" flex alignItems="center">
                            <Button type="button" variant="contained" disabled={saving} onClick={save}>
                                {saving ? <Icon icon="Loader" spin/> : null}
                                Сохранить
                            </Button>
                            <Button type="button" variant="light" ml="default" onClick={onClose}>
                                Отмена
                            </Button>
                        </Box>
                        <Text mt="default" color="grey60">
                            Пустой текст вернёт фото без надписи. Исходное фото хранится отдельно
                            и не затирается надписью.
                        </Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default PhotoTextEditor
