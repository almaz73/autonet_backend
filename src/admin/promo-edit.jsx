import React, {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import PhotoTextEditor from './promo-photo-text.jsx'

// в тулбаре richtext скрываем последние кнопки: очистку форматирования и вставку картинки
const HIDE_RICH_TEXT_BUTTONS = `
    .adminjs_MenuBarWrapper > span:nth-last-of-type(2),
    .adminjs_MenuBarWrapper > span:last-of-type {
        display: none !important;
    }
`

// имя исходного файла должно содержать размер: 278х402, 585х200 или 1200х501
const PHOTO_SLOTS = [
    {field: 'file278', property: 'photo278', size: '278х402', digits: '278402'},
    {field: 'file585', property: 'photo585', size: '585х200', digits: '585200'},
    {field: 'file1200', property: 'photo1200', size: '1200х501', digits: '1200501'},
]

// «278x402», «278 х 402» и «278х402» приводим к «278402»
const sizeDigits = (fileName) => fileName.replace(/\.[^.]+$/, '').replace(/[\s*xх×]/gi, '')

const slotByFileName = (fileName) => {
    const digits = sizeDigits(fileName)
    return PHOTO_SLOTS.find((slot) => digits.includes(slot.digits)) ?? null
}

const photoSrc = (value, version) => {
    if (!value) return null
    if (/^https?:\/\//.test(value)) return value
    const url = value.startsWith('/') ? value : `/pub_promo/${value}`
    return version ? `${url}?v=${version}` : url
}

const appendRefresh = (url) => {
    const [path, search = ''] = url.split('?')
    const params = new URLSearchParams(search)
    params.set('refresh', 'true')
    return `${path}?${params.toString()}`
}

const Field = ({propertyPath, resource, record, onChange, disabled}) => {
    const property = resource.editProperties.find((p) => p.propertyPath === propertyPath)
    if (!property) return null

    return (
        <BasePropertyComponent
            where="edit"
            property={disabled ? {...property, isDisabled: true} : property}
            resource={resource}
            record={record}
            onChange={onChange}
        />
    )
}

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

const CodeLinkField = ({resource, record, isNew}) => {
    const property = resource.editProperties.find((p) => p.propertyPath === 'code')
    const code = record.params?.code

    return (
        <FormGroup>
            <Label htmlFor="code">Ссылка</Label>
            {code
                ? <a
                    id="code"
                    href={`/promo/${code}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{display: 'inline-block', paddingTop: 8}}
                >
                    {code}
                </a>
                : <Box color="grey40" style={{paddingTop: 8}}>
                    {isNew ? 'Код будет присвоен при сохранении' : '—'}
                </Box>}
        </FormGroup>
    )
}

const PhotoField = ({propertyPath, resource, record, onChange, previewVersion, onAddText}) => {
    const src = photoSrc(record.params?.[propertyPath], previewVersion)

    return (
        <Box flex="1" mr="default" mb="default">
            <Box
                bg="grey20"
                height={250}
                mb="default"
                display="flex"
                alignItems="center"
                justifyContent="center"
                style={{overflow: 'hidden', borderRadius: 8}}
            >
                {src
                    ? <img src={src} alt="" style={{maxWidth: '100%', maxHeight: '100%', display: 'block'}}/>
                    : <span style={{color: '#898A9A'}}>Нет фото</span>}
            </Box>
            <Field propertyPath={propertyPath} resource={resource} record={record} onChange={onChange}/>
            <Button
                style={{ width: '100%' }}
                type="button"
                variant="light"
                mt="default"
                disabled={!src}
                onClick={() => onAddText(propertyPath)}
            >
                <Icon icon="Edit"/>
                Добавить текст
            </Button>
        </Box>
    )
}

const PhotosUploader = ({resourceId, recordId, onUploaded}) => {
    const inputRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const sendNotice = useNotice()

    const upload = async (files) => {
        const matched = new Map()
        const rejected = []

        files.forEach((file) => {
            const slot = slotByFileName(file.name)
            if (!slot || matched.has(slot.field)) rejected.push(file.name)
            else matched.set(slot.field, {slot, file})
        })

        if (rejected.length) {
            sendNotice({
                type: 'error',
                message: `Файл должен называться ${PHOTO_SLOTS.map((s) => s.size).join(', ')}: ${rejected.join(', ')}`,
            })
            return
        }

        const formData = new FormData()
        formData.append('recordId', recordId)
        matched.forEach(({slot, file}) => formData.append(slot.field, file))

        setUploading(true)
        try {
            const {data} = await new ApiClient().resourceAction({
                resourceId,
                actionName: 'uploadPhotos',
                data: formData,
                method: 'POST',
            })
            onUploaded(data.photos)
            sendNotice({type: 'success', message: 'Фото загружены'})
        } catch (error) {
            sendNotice({type: 'error', message: error.response?.data?.error ?? 'Не удалось загрузить фото'})
        } finally {
            setUploading(false)
        }
    }

    const onFilesSelected = (event) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = '' // повторный выбор того же файла должен снова срабатывать
        if (files.length) upload(files)
    }

    if (!recordId) {
        return (
            <Box mb="lg" color="grey60">
                <Text>Сохраните запись, чтобы загрузить фото: имя файла строится из её номера.</Text>
            </Box>
        )
    }

    return (
        <Box mb="lg" alignItems="center">
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFilesSelected}/>
            <Button
                type="button"
                variant="contained"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? <Icon icon="Loader" spin/> : <Icon icon="Upload"/>}
                Загрузить фото
            </Button>
            <Text ml="default" color="grey60">
                Файлы с именами {PHOTO_SLOTS.map((slot) => slot.size).join(', ')}
            </Text>
        </Box>
    )
}

const Card = ({children}) => (
    <Box bg="white" p="xl" mb="lg" style={{borderRadius: 8, boxShadow: '0 1px 6px 0 rgba(137,138,154,0.4)'}}>
        {children}
    </Box>
)

const isFilled = (value) => typeof value === 'string' ? value.trim() !== '' : Boolean(value)
const isChecked = (value) => value === true || value === 'true'

const PromoEdit = ({record: initialRecord, resource}) => {
    console.log('22222 = ',22222)
    
    const navigate = useNavigate()
    const {translateButton} = useTranslation()
    const {record, handleChange, submit, loading, setRecord} = useRecord(initialRecord, resource.id)
    // имена файлов не меняются при замене, поэтому превью сбрасываем версией в query
    const [previewVersion, setPreviewVersion] = useState(() => Date.now())
    // propertyPath фото, на котором открыт редактор текста
    const [textEditing, setTextEditing] = useState(null)

    useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    const fields = {resource, record, onChange: handleChange}
    // акция публикуется только с полным набором: три фото, заголовок и описание
    const params = record.params ?? {}

    const canPublish = PHOTO_SLOTS.every((slot) => isFilled(params[slot.property]))
        && isFilled(params.title)
        && isFilled(params.description)
        && isFilled(params.content.replace(/(<([^>]+)>)/gi, ''))

    const onPhotosUploaded = (photos) => {
        Object.entries(photos ?? {}).forEach(([propertyPath, name]) => handleChange(propertyPath, name))
        setPreviewVersion(Date.now())
    }

    const onSubmit = (event) => {
        event.preventDefault()
        submit().then((response) => {
            const {record: savedRecord, redirectUrl} = response.data
            // после создания остаёмся в редактировании записи: там уже доступна загрузка фото
            if (!initialRecord?.id && savedRecord?.id) {
                navigate(`/administrator/resources/${resource.id}/records/${savedRecord.id}/edit`)
                return
            }
            if (redirectUrl) {
                navigate(appendRefresh(redirectUrl))
            }
        })
    }

    return (
        <Box as="form" onSubmit={onSubmit} flex flexDirection="column">
            <style>{HIDE_RICH_TEXT_BUTTONS}</style>
            <Card>
                <H3 mb="default">Основное</H3>
                <Field propertyPath="name" {...fields}/>
                <Box flex>
                    <Box flex="1" mr="default">
                        <CodeLinkField resource={resource} record={record} isNew={!initialRecord?.id}/>
                    </Box>
                    <Box flex="1" ml="default">
                        <Field propertyPath="priority" {...fields}/>
                    </Box>
                </Box>
                <Box flex>
                    <Box flex="1" mr="default">
                        {/* снять уже включённый флаг можно всегда, включить — только при заполненных полях.
                            key пересоздаёт чекбокс: его memo не замечает смену isDisabled */}
                        <Field
                            key={`active-${canPublish}`}
                            propertyPath="active"
                            {...fields}
                            disabled={!canPublish && !isChecked(params.active)}
                        />
                    </Box>
                    <Box flex="1" ml="default">
                        <Field
                            key={`onMain-${canPublish}`}
                            propertyPath="onMain"
                            {...fields}
                            disabled={!canPublish && !isChecked(params.onMain)}
                        />
                    </Box>
                </Box>
                {!canPublish ? (
                    <Text color="grey60">
                        Включить «Активный» и «На главной» можно после загрузки всех трёх фото и заполнения полей
                        «SEO Title» и «Meta Description» и «Содержимое страницы».
                    </Text>
                ) : null}
            </Card>

            <Card>
                <H3 mb="default">Фотографии</H3>
                <PhotosUploader
                    resourceId={resource.id}
                    recordId={record.id}
                    onUploaded={onPhotosUploaded}
                />
                <Box flex flexWrap="wrap">
                    <PhotoField
                        propertyPath="photo278"
                        previewVersion={previewVersion}
                        onAddText={setTextEditing}
                        {...fields}
                    />
                    <PhotoField
                        propertyPath="photo585"
                        previewVersion={previewVersion}
                        onAddText={setTextEditing}
                        {...fields}
                    />
                    <PhotoField
                        propertyPath="photo1200"
                        previewVersion={previewVersion}
                        onAddText={setTextEditing}
                        {...fields}
                    />
                </Box>
                {textEditing && record.id ? (
                    <PhotoTextEditor
                        resourceId={resource.id}
                        recordId={record.id}
                        photoProperty={textEditing}
                        photoName={record.params?.[textEditing]}
                        previewVersion={previewVersion}
                        onClose={() => setTextEditing(null)}
                        onSaved={() => {
                            setTextEditing(null)
                            setPreviewVersion(Date.now())
                        }}
                    />
                ) : null}
            </Card>

            <Card>
                <H3 mb="default">SEO подготовка</H3>
                <Field propertyPath="title" {...fields}/>
                <Field propertyPath="description" {...fields}/>
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
                    onClick={() => navigate(resource.href || `/administrator/resources/${resource.id}`)}
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

export default PromoEdit
