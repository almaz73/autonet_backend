import React, {useEffect} from 'react'
import {useNavigate} from 'react-router'
import {BasePropertyComponent, useRecord, useTranslation} from 'adminjs'
import {Box, Button, H3, Icon} from '@adminjs/design-system'

const photoSrc = (value) => {
    if (!value) return null
    return value.startsWith('/') || /^https?:\/\//.test(value) ? value : `/pub_promo/${value}`
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

const PhotoField = ({propertyPath, resource, record, onChange}) => {
    const src = photoSrc(record.params?.[propertyPath])

    return (
        <Box flex="1" mr="default" mb="default">
            <Box
                bg="grey20"
                height={160}
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

    useEffect(() => {
        if (initialRecord) setRecord(initialRecord)
    }, [initialRecord])

    const fields = {resource, record, onChange: handleChange}

    const onSubmit = (event) => {
        event.preventDefault()
        submit().then((response) => {
            if (response.data.redirectUrl) {
                navigate(appendRefresh(response.data.redirectUrl))
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
                        <Field propertyPath="code" {...fields} disabled/>
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
                <Box flex flexWrap="wrap">
                    <PhotoField propertyPath="photo278" {...fields}/>
                    <PhotoField propertyPath="photo585" {...fields}/>
                    <PhotoField propertyPath="photo1200" {...fields}/>
                </Box>
            </Card>

            <Card>
                <H3 mb="default">Описание</H3>
                <Field propertyPath="description" {...fields}/>
                <H3 mt="lg" mb="default">Стили</H3>
                <Field propertyPath="styles" {...fields}/>
            </Card>

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
