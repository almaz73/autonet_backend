import React, {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import {formatFileSize} from '../shared/fileSize.js'

const MAX_FILE_SIZE_MB = 25
const ACCEPT = '.pdf,.doc,.docx,.rtf,.xls,.xlsx,.odt,.ods,.txt,.csv,.zip'

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

const Card = ({children}) => (
    <Box bg="white" p="xl" mb="lg" style={{borderRadius: 8, boxShadow: '0 1px 6px 0 rgba(137,138,154,0.4)'}}>
        {children}
    </Box>
)

const UploadField = ({record, resourceId, onUploaded}) => {
    const inputRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const sendNotice = useNotice()

    const upload = async (file) => {
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('document', file)

            const {data} = await new ApiClient().resourceAction({
                resourceId,
                actionName: 'uploadFile',
                data: formData,
                method: 'POST',
            })
            onUploaded(data)
            sendNotice({type: 'success', message: 'Файл загружен'})
        } catch (error) {
            sendNotice({type: 'error', message: error.response?.data?.error ?? 'Не удалось загрузить файл'})
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

    const link = record?.params?.link
    const format = record?.params?.format
    const size = formatFileSize(record?.params?.size)

    return (
        <Box>
            {link ? (
                <Box mb="default">
                    <a href={link} target="_blank" rel="noopener noreferrer">
                        {record?.params?.file || link}
                    </a>
                    <Text color="grey60" mt="sm">
                        {[format, size].filter((value) => value && value !== '—').join(' · ')}
                    </Text>
                </Box>
            ) : (
                <Text color="grey60" mb="default">Файл ещё не загружен.</Text>
            )}

            <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onFilesSelected}/>
            <Button
                type="button"
                variant={link ? 'light' : 'contained'}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? <Icon icon="Loader" spin/> : <Icon icon="Upload"/>}
                {link ? 'Заменить файл' : 'Загрузить файл'}
            </Button>
            <Text color="grey60" mt="default">
                PDF, DOC, DOCX, RTF, XLS, XLSX, ODT, TXT или ZIP до {MAX_FILE_SIZE_MB} МБ.
                Файл сохранится в st/upload, ссылка и размер заполнятся автоматически.
            </Text>
        </Box>
    )
}

const DocumentEdit = ({record: initialRecord, resource}) => {
    const navigate = useNavigate()
    const {translateButton} = useTranslation()
    const {record, handleChange, submit, loading, setRecord} = useRecord(initialRecord, resource.id)

    useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    // значения модели для новой записи: второстепенный, без публикации
    useEffect(() => {
        if (initialRecord?.id) return
        if (record.params?.kind === undefined) handleChange('kind', 'secondary')
        if (record.params?.priority === undefined) handleChange('priority', 0)
        if (record.params?.published === undefined) handleChange('published', false)
    }, [initialRecord?.id])

    const fields = {resource, record, onChange: handleChange}

    const onUploaded = (data) => {
        handleChange('file', data.file)
        handleChange('link', data.link)
        handleChange('format', data.format)
        handleChange('size', data.size)
        // название из имени файла — только если его ещё нет
        if (!record.params?.name) handleChange('name', data.name)
    }

    const onSubmit = (event) => {
        event.preventDefault()
        submit().then((response) => {
            const {redirectUrl} = response.data
            if (redirectUrl) navigate(redirectUrl)
        })
    }

    const onCancel = () => navigate(resource.href || `/administrator/resources/${resource.id}`)

    return (
        <Box as="form" onSubmit={onSubmit} flex flexDirection="column">
            <Card>
                <H3 mb="default">Файл документа</H3>
                <UploadField record={record} resourceId={resource.id} onUploaded={onUploaded}/>
            </Card>

            <Card>
                <H3 mb="default">Описание</H3>
                <Field propertyPath="name" {...fields}/>
                <Box flex flexWrap="wrap">
                    <Box flex="1" mr="default" style={{minWidth: 220}}>
                        <Field propertyPath="kind" {...fields}/>
                    </Box>
                    <Box flex="1" ml="default" style={{minWidth: 220}}>
                        <Field propertyPath="priority" {...fields}/>
                    </Box>
                </Box>
                <Field propertyPath="published" {...fields}/>
            </Card>

            <Box flex justifyContent="flex-end" alignItems="center">
                <Button type="button" variant="light" mr="default" onClick={onCancel}>
                    Отмена
                </Button>
                <Button type="submit" variant="contained" disabled={loading || !record.params?.link}>
                    {loading ? <Icon icon="Loader" spin/> : null}
                    {translateButton('save', resource.id)}
                </Button>
            </Box>
        </Box>
    )
}

export default DocumentEdit
