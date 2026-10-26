import React, {useEffect, useRef, useState} from 'react'
import {ApiClient, useNotice} from 'adminjs'
import {Box, Button, H3, Icon, Label, Text} from '@adminjs/design-system'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const SLOT_LABELS = {
    photo278: '278х402',
    photo585: '585х200',
    photo1200: '1200х501',
}

// как в promoDAO: текст центрируется в точке (xPct, yPct), размер — % от высоты фото
const textOverlayStyle = ({pos, color, fontSizePx, dragging, ghost}) => ({
    position: 'absolute',
    left: `${pos.xPct}%`,
    top: `${pos.yPct}%`,
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
    onClose,
    onSaved,
}) => {
    const [text, setText] = useState('')
    const [color, setColor] = useState('#007aff')
    const [fontSizePct, setFontSizePct] = useState(7)
    const [pos, setPos] = useState({xPct: 50, yPct: 85})
    const [dragging, setDragging] = useState(false)
    const [saving, setSaving] = useState(false)
    const [blankFailed, setBlankFailed] = useState(false)
    const [imgHeight, setImgHeight] = useState(0)
    const sendNotice = useNotice()
    const imgRef = useRef(null)
    const dragStart = useRef(null)

    const isAbsoluteUrl = (value) => /^https?:/.test(value) || value.startsWith('/')
    const mainSrc = photoName && !isAbsoluteUrl(photoName)
        ? `/pub_promo/${photoName}${previewVersion ? `?v=${previewVersion}` : ''}`
        : photoName
    const blankSrc = photoName
        ? `/pub_promo/${photoName.replace(/\.webp$/, '')}_blank.webp${previewVersion ? `?v=${previewVersion}` : ''}`
        : null
    const canvasSrc = !blankFailed && blankSrc ? blankSrc : mainSrc

    useEffect(() => {
        const syncHeight = () => {
            if (imgRef.current) setImgHeight(imgRef.current.getBoundingClientRect().height)
        }
        window.addEventListener('resize', syncHeight)
        return () => window.removeEventListener('resize', syncHeight)
    }, [])

    const onImgLoad = (event) => {
        setImgHeight(event.currentTarget.getBoundingClientRect().height)
    }

    const onTextPointerDown = (event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragStart.current = {px: event.clientX, py: event.clientY, xPct: pos.xPct, yPct: pos.yPct}
        setDragging(true)
    }

    const onTextPointerMove = (event) => {
        if (!dragStart.current || !imgRef.current) return
        const rect = imgRef.current.getBoundingClientRect()
        const start = dragStart.current
        setPos({
            xPct: clamp(start.xPct + (event.clientX - start.px) / rect.width * 100, 0, 100),
            yPct: clamp(start.yPct + (event.clientY - start.py) / rect.height * 100, 0, 100),
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
        formData.append('fontSizePct', String(fontSizePct))
        formData.append('xPct', String(pos.xPct))
        formData.append('yPct', String(pos.yPct))

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
            onSaved()
        } catch (error) {
            sendNotice({type: 'error', message: error.response?.data?.error ?? 'Не удалось сохранить текст'})
        } finally {
            setSaving(false)
        }
    }

    const fontSizePx = Math.round(imgHeight * fontSizePct / 100)
    const overlayStyle = textOverlayStyle({pos, color, fontSizePx, dragging, ghost: !text})

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
                            <Label>Размер текста: {fontSizePct}%</Label>
                            <input
                                type="range"
                                min="1"
                                max="25"
                                step="0.5"
                                value={fontSizePct}
                                onChange={(event) => setFontSizePct(parseFloat(event.target.value))}
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
