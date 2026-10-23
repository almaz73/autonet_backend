import React, {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import PhotoTextEditor from './promo-photo-text.jsx'

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

const PromoEdit = ({record: initialRecord, resource}) => {
    const navigate = useNavigate()
    const {translateButton} = useTranslation()
    const {record, handleChange, submit, loading, setRecord} = useRecord(initialRecord, resource.id)
    // имена файлов не меняются при замене, поэтому превью сбрасываем версией в query
    const [previewVersion, setPreviewVersion] = useState(0)
    // propertyPath фото, на котором открыт редактор текста
    const [textEditing, setTextEditing] = useState(null)

    useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    const fields = {resource, record, onChange: handleChange}

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
                        <Field propertyPath="active" {...fields}/>
                    </Box>
                    <Box flex="1" ml="default">
                        <Field propertyPath="onMain" {...fields}/>
                    </Box>
                </Box>
            </Card>

            <Card>
                <H3 mb="default">Фотографии</H3>
                <PhotosUploader
                    resourceId={resource.id}
                    recordId={record.id}
                    onUploaded={onPhotosUploaded}
                />
                <Box flex flexWrap="wrap">
                    <PhotoField propertyPath="photo278" previewVersion={previewVersion} {...fields}/>
                    <PhotoField propertyPath="photo585" previewVersion={previewVersion} {...fields}/>
                    <PhotoField propertyPath="photo1200" previewVersion={previewVersion} {...fields}/>
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

            {/*<Card>*/}
            {/*    <H3 mb="default">Описание</H3>*/}
            {/*    <Field propertyPath="description" {...fields}/>*/}
            {/*    <H3 mt="lg" mb="default">Стили</H3>*/}
            {/*    <Field propertyPath="styles" {...fields}/>*/}
            {/*</Card>*/}

            <Card>
                <H3 mb="default">Содержимое страницы</H3>
                <Field propertyPath="content" {...fields}/>
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
