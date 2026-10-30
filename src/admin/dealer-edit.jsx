import React from 'react'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import {buildDealerLink} from '../clientBaza/dealers/dealerLink.js'

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

const LinkField = ({params}) => {
    const city = String(params?.city ?? '').trim()
    const address = String(params?.address ?? '').trim()
    const link = city && address ? buildDealerLink(city, address) : ''

    return (
        <FormGroup>
            <Label htmlFor="dealer-link">Ссылка на страницу дилерского центра</Label>
            {link
                ? <a
                    id="dealer-link"
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{display: 'inline-block', paddingTop: 8}}
                >
                    {link}
                </a>
                : <Box color="grey40" style={{paddingTop: 8}}>Заполните город и адрес</Box>}
            <Text color="grey60" mt="default">
                Ссылка формируется из города и адреса и сохранится автоматически.
            </Text>
        </FormGroup>
    )
}

const appendRefresh = (url) => {
    const [path, search = ''] = url.split('?')
    const params = new URLSearchParams(search)
    params.set('refresh', 'true')
    return `${path}?${params.toString()}`
}

const PhotoField = ({record, resourceId, previewVersion, onUploaded}) => {
    const inputRef = React.useRef(null)
    const [uploading, setUploading] = React.useState(false)
    const sendNotice = useNotice()
    const url = record.params?.url
    const src = url ? `${url}?v=${previewVersion}` : ''

    const upload = async (file) => {
        const formData = new FormData()
        formData.append('recordId', record.id)
        formData.append('photo', file)

        setUploading(true)
        try {
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
        if (file) upload(file)
    }

    return (
        <Box>
            <Box
                bg="grey20"
                mb="default"
                style={{
                    width: 220,
                    aspectRatio: '1 / 1.618',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderRadius: 8,
                }}
            >
                {src
                    ? <img
                        src={src}
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
            <Text color="grey60" mt="default">
                JPG, PNG или WebP — сохраним в WebP и сразу обновим фото на сайте.
            </Text>
        </Box>
    )
}

const Card = ({children}) => (
    <Box bg="white" p="xl" mb="lg" style={{borderRadius: 8, boxShadow: '0 1px 6px 0 rgba(137,138,154,0.4)'}}>
        {children}
    </Box>
)

const DealerEdit = ({record: initialRecord, resource}) => {
    const navigate = useNavigate()
    const {translateButton} = useTranslation()
    const {record, handleChange, submit, loading, setRecord} = useRecord(initialRecord, resource.id)

    React.useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    const fields = {resource, record, onChange: handleChange}
    const params = record.params ?? {}
    const [previewVersion, setPreviewVersion] = React.useState(() => Date.now())

    const onPhotoUploaded = (url) => {
        handleChange('url', url)
        setPreviewVersion(Date.now())
    }

    const onSubmit = (event) => {
        event.preventDefault()
        submit().then((response) => {
            const {redirectUrl} = response.data
            if (redirectUrl) navigate(appendRefresh(redirectUrl))
        })
    }

    return (
        <Box as="form" onSubmit={onSubmit} flex flexDirection="column">
            <Card>
                <H3 mb="default">Дилерский центр</H3>
                <Field propertyPath="city" {...fields}/>
                <Field propertyPath="address" {...fields}/>
                <Box flex>
                    <Box flex="1" mr="default">
                        <Field propertyPath="profile" {...fields}/>
                    </Box>
                </Box>
                <Box flex>
                    <Box flex="1" ml="default">
                        <Field propertyPath="tel" {...fields}/>
                    </Box>
                </Box>
                <Box flex>
                    <Box flex="1" mr="default">
                        <Field propertyPath="days" {...fields}/>
                    </Box>
                    <Box flex="1" ml="default">
                        <Field propertyPath="brands" {...fields}/>
                    </Box>
                </Box>
                <Field propertyPath="coords" {...fields}/>
            </Card>

            <Card>
                <H3 mb="default">Ссылка</H3>
                <LinkField params={params}/>
            </Card>

            <Card>
                <H3 mb="default">Фото</H3>
                <PhotoField
                    record={record}
                    resourceId={resource.id}
                    previewVersion={previewVersion}
                    onUploaded={onPhotoUploaded}
                />
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

export default DealerEdit
