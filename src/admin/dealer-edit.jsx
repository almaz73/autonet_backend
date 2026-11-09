import React from 'react'
import {createPortal} from 'react-dom'
import {useNavigate} from 'react-router'
import {ApiClient, BasePropertyComponent, useNotice, useRecord, useTranslation} from 'adminjs'
import {Box, Button, CheckBox, FormGroup, H3, Icon, Label, Text} from '@adminjs/design-system'
import {buildDealerLink} from '../clientBaza/dealers/dealerLink.js'
import {writeLastEditedId} from './promo-list-table.jsx'

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

const PROFILE_OPTIONS = ['Новые авто', 'Авто с пробегом', 'Сервис']

const splitProfiles = (value) => String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

const sameProfile = (a, b) => a.toLowerCase() === b.toLowerCase()

// профиль хранится строкой через запятую; менять можно только тремя значениями,
// а старые значения сохраняются, пока оператор не снимет их сам
const ProfileField = ({record, onChange}) => {
    const values = splitProfiles(record.params?.profile)
    const selected = PROFILE_OPTIONS.filter((option) => values.some((value) => sameProfile(value, option)))
    const legacy = values.filter((value) => !PROFILE_OPTIONS.some((option) => sameProfile(value, option)))

    const toggle = (option) => {
        const next = selected.includes(option)
            ? selected.filter((value) => value !== option)
            : [...selected, option]
        const ordered = PROFILE_OPTIONS.filter((value) => next.includes(value))
        onChange('profile', [...ordered, ...legacy].join(', '))
    }

    const removeLegacy = (value) => {
        onChange('profile', [...selected, ...legacy.filter((item) => item !== value)].join(', '))
    }

    return (
        <FormGroup>
            <Label>Профиль</Label>
            <Box>
                {PROFILE_OPTIONS.map((option) => (
                    <React.Fragment key={option}>
                        <CheckBox
                            id={`profile-${option}`}
                            checked={selected.includes(option)}
                            onChange={() => toggle(option)}
                        />
                        <Label inline htmlFor={`profile-${option}`} mr="xl">{option}</Label>
                    </React.Fragment>
                ))}
            </Box>
            {legacy.length > 0 && (
                <Box mt="default">
                    <Text color="grey60">
                        Старые значения профиля сохранятся, пока вы их не снимете:
                    </Text>
                    <Box mt="sm">
                        {legacy.map((value) => (
                            <React.Fragment key={value}>
                                <CheckBox
                                    id={`profile-legacy-${value}`}
                                    checked
                                    onChange={() => removeLegacy(value)}
                                />
                                <Label inline htmlFor={`profile-legacy-${value}`} mr="xl">{value}</Label>
                            </React.Fragment>
                        ))}
                    </Box>
                </Box>
            )}
        </FormGroup>
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

    // список при возврате подсветит и прокрутит к этому контакту
    React.useEffect(() => {
        if (initialRecord?.id) writeLastEditedId(resource.id, initialRecord.id)
    }, [resource.id, initialRecord?.id])

    // слот в штатной шапке AdminJS рядом с «Удалить» для верхних кнопок
    const [headerSlot, setHeaderSlot] = React.useState(null)
    const formRef = React.useRef(null)

    // шапку рисует AdminJS, поэтому свою группу кнопок вставляем в неё отдельным слотом
    React.useEffect(() => {
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
                <H3 mb="default">Контакт</H3>
                <Field propertyPath="city" {...fields}/>
                <Field propertyPath="address" {...fields}/>
                <Box flex>
                    <Box flex="1" mr="default">
                        <ProfileField record={record} onChange={handleChange}/>
                    </Box>
                </Box>

                <Field propertyPath="tel" {...fields}/>
                <Field propertyPath="email" {...fields}/>

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
