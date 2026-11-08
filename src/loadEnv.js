// .env в .gitignore; загружаем его до инициализации моделей и настроек админки.
// Путь считаем от корня проекта, а не от текущего каталога: скрипты обновления
// и мониторинга могут запускаться из любого места (cron, systemd).
import path from 'path'
import {fileURLToPath} from 'url'

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env')

if (typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(envFile)
    } catch (error) {
        if (error?.code !== 'ENOENT') console.error('Не удалось загрузить .env:', error.message)
    }
} else {
    console.warn('process.loadEnvFile недоступен (нужен Node 20.12+), переменные окружения задайте в системе')
}
