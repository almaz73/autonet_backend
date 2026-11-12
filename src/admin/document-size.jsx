import React from 'react'
import {formatFileSize} from '../shared/fileSize.js'

const DocumentSize = ({record}) => (
    <span>{formatFileSize(record?.params?.size)}</span>
)

export default DocumentSize
