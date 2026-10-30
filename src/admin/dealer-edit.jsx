import React from 'react'
import {useNavigate} from 'react-router'
import {BasePropertyComponent, useRecord, useTranslation} from 'adminjs'
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
                <Field propertyPath="url" {...fields}/>
            </Card>

            <Card>
                <H3 mb="default">Ссылка</H3>
                <LinkField params={params}/>
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
