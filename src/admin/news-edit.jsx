import React, {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import {writeLastEditedId} from './promo-list-table.jsx'

const MAX_FILE_SIZE_MB = 10

const Field = ({propertyPath, resource, record, onChange}) => {
    const property = resource.editProperties.find((p) => p.propertyPath === propertyPath)
    if (!property) return null

    return (
        <BasePropertyComponent
            where="edit"
            property={property}
            resource={resource}
            record={record}
            onChange={onChange}
        />
    )
}

// дата статьи — только день без времени
const DateField = ({record, onChange}) => (
    <FormGroup>
        <Label htmlFor="news-date">Дата</Label>
        <input
            id="news-date"
            type="date"
            value={record?.params?.date ?? ''}
            onChange={(event) => onChange('date', event.target.value)}
            style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #B9BBC6',
                borderRadius: 4,
                font: 'inherit',
                boxSizing: 'border-box',
                background: '#fff',
            }}
        />
    </FormGroup>
)

// html статьи: richtext-редактор + кнопка HTML для просмотра и правки исходного кода
const HtmlContentField = ({propertyPath, resource, record, onChange}) => {
    const property = resource.editProperties.find((p) => p.propertyPath === propertyPath)
    const [showHtml, setShowHtml] = useState(false)
    // richtext не подхватывает внешние изменения, поэтому после правки HTML пересоздаём его
    const [editorVersion, setEditorVersion] = useState(0)

    if (!property) return null

    const html = record.params?.[propertyPath] ?? ''

    return (
        <>
            <BasePropertyComponent
                key={editorVersion}
                where="edit"
                property={property}
                resource={resource}
                record={record}
                onChange={onChange}
            />
            <Button
                type="button"
                variant="light"
                mt="default"
                onClick={() => setShowHtml((visible) => !visible)}
            >
                HTML
            </Button>
            {showHtml ? (
                <Box mt="default">
                    <Label htmlFor={`${propertyPath}-html`}>HTML</Label>
                    <textarea
                        id={`${propertyPath}-html`}
                        value={html}
                        rows={14}
                        spellCheck={false}
                        onChange={(event) => onChange(propertyPath, event.target.value)}
                        onBlur={() => setEditorVersion((version) => version + 1)}
                        style={{
                            width: '100%',
                            padding: 8,
                            border: '1px solid #B9BBC6',
                            borderRadius: 4,
                            fontFamily: 'monospace',
                            fontSize: 13,
                            lineHeight: 1.5,
                            boxSizing: 'border-box',
                            resize: 'vertical',
                        }}
                    />
                </Box>
            ) : null}
        </>
    )
}

const imageSrc = (value) => {
    if (!value) return null
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value
    return `/st/photo/news/${value}`
}

const appendRefresh = (url) => {
    const [path, search = ''] = url.split('?')
    const params = new URLSearchParams(search)
    params.set('refresh', 'true')
    return `${path}?${params.toString()}`
}

const Card = ({children}) => (
    <Box bg="white" p="xl" mb="lg" style={{borderRadius: 8, boxShadow: '0 1px 6px 0 rgba(137,138,154,0.4)'}}>
        {children}
    </Box>
)

const PhotoField = ({record, resourceId, previewVersion, onUploaded}) => {
    const inputRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const sendNotice = useNotice()
    const src = imageSrc(record?.params?.image)
    const versionedSrc = src ? `${src}${src.includes('?') ? '&' : '?'}v=${previewVersion}` : ''

    const upload = async (file) => {
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('recordId', record.id)
            formData.append('photo', file)

            const {data} = await new ApiClient().resourceAction({
                resourceId,
                actionName: 'uploadPhoto',
                data: formData,
                method: 'POST',
            })
            onUploaded(data.url)
            sendNotice({type: 'success', message: 'Фото загружено'})
        } catch (error) {
            sendNotice({type: 'error', message: error.response?.data?.error ?? 'Не удалось загрузить фото'})
        } finally {
            setUploading(false)
        }
    }

    const onFilesSelected = (event) => {
        const file = event.target.files?.[0]
        event.target.value = '' // повторный выбор того же файла должен снова срабатывать
        if (!file) return
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            sendNotice({type: 'error', message: `Файл больше ${MAX_FILE_SIZE_MB} МБ`})
            return
        }
        upload(file)
    }

    return (
        <Box>
            <Box
                bg="grey20"
                mb="default"
                style={{
                    width: 320,
                    maxWidth: '100%',
                    aspectRatio: '16 / 9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderRadius: 8,
                }}
            >
                {versionedSrc
                    ? <img
                        src={versionedSrc}
                        alt=""
                        style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                    />
                    : <Text color="grey40">Нет фото</Text>}
            </Box>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFilesSelected}/>
            <Button
                type="button"
                variant="contained"
                disabled={uploading || !record.id}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? <Icon icon="Loader" spin/> : <Icon icon="Upload"/>}
                Загрузить фото
            </Button>
            {!record.id ? (
                <Text color="grey60" mt="default">
                    Сначала сохраните статью, затем загрузите фото.
                </Text>
            ) : (
                <Text color="grey60" mt="default">
                    JPG, PNG или WebP до {MAX_FILE_SIZE_MB} МБ — сохраним в WebP и обновим на сайте.
                </Text>
            )}
        </Box>
    )
}

const NewsEdit = ({record: initialRecord, resource}) => {
    const navigate = useNavigate()
    const {translateButton} = useTranslation()
    const {record, handleChange, submit, loading, setRecord} = useRecord(initialRecord, resource.id)

    // имя файла меняется при загрузке, но превью обновляем версией на случай замены
    const [previewVersion, setPreviewVersion] = useState(() => Date.now())
    // слот в штатной шапке AdminJS рядом с «Удалить» для верхних кнопок
    const [headerSlot, setHeaderSlot] = useState(null)
    const formRef = useRef(null)

    useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    // новая статья по умолчанию активна — как defaultValue модели;
    // без этого чекбокс выглядел снятым, а запись сохранялась активной
    useEffect(() => {
        if (!initialRecord?.id && record.params?.active === undefined) {
            handleChange('active', true)
        }
    }, [initialRecord?.id])

    // список при возврате подсветит именно эту статью
    useEffect(() => {
        if (initialRecord?.id) writeLastEditedId(resource.id, initialRecord.id)
    }, [resource.id, initialRecord?.id])

    // шапку рисует AdminJS, поэтому свою группу кнопок вставляем в неё отдельным слотом
    useEffect(() => {
        if (!initialRecord?.id) return
        const deleteButton = document.querySelector(`[data-css="${resource.id}-delete-button"]`)
        const group = deleteButton?.parentElement
        if (!group) return
        const slot = document.createElement('span')
        slot.style.display = 'contents'
        group.appendChild(slot)
        setHeaderSlot(slot)
        return () => {
            setHeaderSlot(null)
            slot.remove()
        }
    }, [resource.id, initialRecord?.id])

    const fields = {resource, record, onChange: handleChange}
    const articleUrl = record.params?.url

    const onPhotoUploaded = (url) => {
        handleChange('image', url)
        setPreviewVersion(Date.now())
    }

    const onSubmit = (event) => {
        event.preventDefault()
        submit().then((response) => {
            const {record: savedRecord, redirectUrl} = response.data
            // после создания остаёмся в редактировании: там уже доступна загрузка фото
            if (!initialRecord?.id && savedRecord?.id) {
                navigate(`/administrator/resources/${resource.id}/records/${savedRecord.id}/edit`)
                return
            }
            if (redirectUrl) navigate(appendRefresh(redirectUrl))
        })
    }

    const onCancel = () => navigate(resource.href || `/administrator/resources/${resource.id}`)

    return (
        <Box as="form" ref={formRef} onSubmit={onSubmit} flex flexDirection="column">
            {headerSlot ? createPortal(
                <>
                    <Button
                        type="button"
                        variant="light"
                        ml="md"
                        mr="md"
                        onClick={onCancel}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        variant="contained"
                        disabled={loading}
                        onClick={() => formRef.current?.requestSubmit()}
                    >
                        {loading ? <Icon icon="Loader" spin/> : null}
                        {translateButton('save', resource.id)}
                    </Button>
                </>,
                headerSlot,
            ) : null}


            <Card>
                <H3 mb="default">Фото</H3>
                <PhotoField
                    record={record}
                    resourceId={resource.id}
                    previewVersion={previewVersion}
                    onUploaded={onPhotoUploaded}
                />
            </Card>

            <Card>
                <H3 mb="default">Основное</H3>
                <Field propertyPath="name" {...fields}/>
                <Box flex flexWrap="wrap">
                    <Box flex="1" mr="default" style={{minWidth: 220}}>
                        <DateField record={record} onChange={handleChange}/>
                    </Box>
                    <Box flex="2" ml="default" style={{minWidth: 260}}>
                        <Field propertyPath="url" {...fields}/>
                        {articleUrl ? (
                            <a href={articleUrl} target="_blank" rel="noopener noreferrer">
                                Открыть статью
                            </a>
                        ) : (
                            <Text color="grey60">Например: /news/657193/</Text>
                        )}
                    </Box>
                </Box>
                <Field propertyPath="active" {...fields}/>
            </Card>

            <Card>
                <H3 mb="default">SEO подготовка</H3>
                <Field propertyPath="title" {...fields}/>
                <Field propertyPath="description" {...fields}/>
            </Card>

            <Card>
                <H3 mb="default">Краткое описание</H3>
                <Field propertyPath="announce" {...fields}/>
            </Card>


            <Card>
                <H3 mb="default">Содержимое страницы</H3>
                <HtmlContentField propertyPath="content" {...fields}/>
            </Card>


            <Box flex justifyContent="flex-end" alignItems="center">
                <Button
                    type="button"
                    variant="light"
                    mr="default"
                    onClick={onCancel}
                >
                    Отмена
                </Button>
                <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? <Icon icon="Loader" spin/> : null}
                    {translateButton('save', resource.id)}
                </Button>
            </Box>
        </Box>
    )
}

export default NewsEdit
