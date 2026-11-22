import fs from 'node:fs'
import crypto from 'node:crypto'

const file = new URL('../.env', import.meta.url)
let text = fs.readFileSync(file, 'utf-8')

if (/^SECRET_WORD_PARSING=/m.test(text)) {
    console.log('SECRET_WORD_PARSING already set')
} else {
    const value = crypto.randomBytes(24).toString('base64url')
    if (text.length && !text.endsWith('\n')) text += '\n'
    text += '# секрет для POST /api/addAvitoCars (расширение-парсер)\nSECRET_WORD_PARSING=' + value + '\n'
    fs.writeFileSync(file, text)
    console.log('SECRET_WORD_PARSING added, length', value.length)
}
