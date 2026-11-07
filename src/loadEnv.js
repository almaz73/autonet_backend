// .env в .gitignore; загружаем его до инициализации моделей и настроек админки
if (typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile()
    } catch (error) {
        if (error?.code !== 'ENOENT') console.error('Не удалось загрузить .env:', error.message)
    }
} else {
    console.warn('process.loadEnvFile недоступен (нужен Node 20.12+), переменные окружения задайте в системе')
}
