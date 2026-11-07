import './src/loadEnv.js' // первым: .env должен быть загружен до моделей и настроек админки
import express from 'express'
import helmet from 'helmet'
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import router from "./src/routers/router.js"; // Updated path to reflect router.js being inside src
import {fileURLToPath} from 'url';
import path from "path";
import routerAuth from "./src/routers/routerAuth.js";
import routerPromo from "./src/routers/routerPromo.js";
import routerArticles from "./src/routers/routerArticles.js";
import router_bd from "./src/routers/router_bd.js";
import router_ssr from "./src/routers/router_ssr.js";
import router_buyout from "./src/routers/router_buyout.js";
import router_history from "./src/routers/router_history.js";
import {generationPagesForPromo} from "./src/clientBaza/promo/generationPagesForPromo.js";
import Controllers from "./src/xml_import/Controllers.js";
import {routerAdminJs, adminJs, adminLoginRateLimit} from './src/admin/in_admin.options.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

// Роутеры проекта созданы через new Router() (это отдельные Express-приложения),
// поэтому X-Powered-By отключаем у каждого из них, а не только у основного app
for (const subApp of [router, routerAuth, routerPromo, routerArticles, router_bd, router_ssr, router_buyout, router_history, routerAdminJs]) {
    subApp?.disable?.('x-powered-by')
}

// не раскрываем Express в заголовках и включаем security-заголовки для всех ответов
app.disable('x-powered-by')
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            'default-src': ["'self'"],
            'base-uri': ["'self'"],
            'object-src': ["'none'"],
            'frame-ancestors': ["'self'"],
            'form-action': ["'self'"],
            // инлайн-скрипты/стили используются в EJS-шаблонах и в интерфейсе AdminJS
            'script-src': [
                "'self'",
                "'unsafe-inline'",
                'https://mc.yandex.ru', // Яндекс.Метрика
                'https://zcdn.ru', // чат поддержки
                'https://static.site-chat.me',
                'https://widget.me-talk.ru',
                'https://static.me-talk.ru',
            ],
            'script-src-attr': ["'unsafe-inline'"], // onclick и т.п. в старых шаблонах
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // шрифты интерфейса AdminJS
            'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'], // фото авто и дилеров лежат на внешних CDN
            'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
            'connect-src': [
                "'self'",
                'https://*.yandex.ru',
                'https://mc.yandex.ru',
                'https://zcdn.ru',
                'https://static.site-chat.me',
                'https://widget.me-talk.ru',
                'https://static.me-talk.ru',
                'https://dev.apibcknd.com',
                'wss://widget.me-talk.ru',
                'wss://dev.apibcknd.com',
            ],
            'frame-src': ["'self'", 'https://makemap.2gis.ru', 'https://*.2gis.ru', 'https://mc.yandex.ru', 'https://widget.me-talk.ru', 'https://static.me-talk.ru'], // карта дилеров, Вебвизор Метрики и окно чата
            'media-src': ["'self'", 'https:', 'blob:'],
            'worker-src': ["'self'", 'blob:'],
            'manifest-src': ["'self'"],
            // на локальном http этот запрет сломал бы загрузку ресурсов
            ...(isProduction ? {'upgrade-insecure-requests': []} : {}),
        },
    },
    // внешние картинки и карта 2ГИС не отдают CORP, при require-corp они бы перестали грузиться
    crossOriginEmbedderPolicy: false,
    referrerPolicy: {policy: 'strict-origin-when-cross-origin'},
    // HSTS включаем только на сервере с HTTPS
    hsts: isProduction ? {maxAge: 15552000, includeSubDomains: false, preload: false} : false,
}))

// за nginx/Apache/Passenger: нужно для secure-cookie админки и корректного IP в лимитере входа.
// TRUST_PROXY можно задать явно (число хопов или значение для express), по умолчанию 1 в production
const trustProxy = process.env.TRUST_PROXY
if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)
} else if (isProduction) {
    app.set('trust proxy', 1)
}

const adminRootPath = adminJs.options.rootPath
app.use(adminRootPath, adminLoginRateLimit) // ограничение попыток входа
app.use(adminRootPath, routerAdminJs); //Подключение админки

const PORT = process.env.PORT || 3000; // Passenger передаёт порт через PORT
// по умолчанию слушаем только localhost: снаружи сайт должен быть доступен через nginx/Apache с HTTPS.
// HOST=0.0.0.0 — только если нужен прямой доступ к Node извне, без reverse proxy
const HOST = process.env.HOST || '127.0.0.1'
const DB_PATH = './database.sqlite'; // Local SQLite file

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '..', 'front');


app.set('view engine', 'ejs');// Установка EJS как движка шаблонов
app.use(express.json({ limit: '30mb' }))
app.use('/', router_ssr)
app.use(express.static(frontendPath)); // 2. Раздаем статику
app.use('/admin-assets', express.static(path.join(__dirname, 'src', 'admin', 'assets')));
app.use(express.urlencoded({limit: '30mb',extended: true}));

// CORS: заголовки отдаём только своим Origin, а не любому присланному.
// Свой сайт по умолчанию; другие доверенные домены можно перечислить в CORS_ORIGINS через запятую
const corsOrigins = new Set([
    'https://xn--80aej9aped4f.xn--p1ai', // автосеть.рф
    'https://www.xn--80aej9aped4f.xn--p1ai',
    ...(isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']), // локальная разработка
])
for (const value of (process.env.CORS_ORIGINS || '').split(',')) {
    if (!value.trim()) continue
    try {
        corsOrigins.add(new URL(value.trim()).origin) // приводит к punycode и отбрасывает путь
    } catch {
        console.warn('CORS_ORIGINS: пропущен некорректный Origin:', value.trim())
    }
}

app.use('/api', (req, res, next) => {
    res.vary('Origin') // ответ зависит от Origin, это важно для кэшей и прокси

    const origin = req.get('origin')
    if (!origin) return next() // same-origin запросы CORS не требуют

    if (!corsOrigins.has(origin)) {
        // без CORS-заголовков браузер не отдаст ответ чужому сайту
        if (req.method === 'OPTIONS') return res.sendStatus(403)
        return next()
    }

    res.set('Access-Control-Allow-Origin', origin) // при credentials нельзя '*'
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.set('Access-Control-Max-Age', '600')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
})

app.use('/api/auth', routerAuth)
app.use('/api', router)
app.use('/api', router_buyout); // интеграция с внутренним сайтом/ отправка на оценку
app.use('/api', routerPromo)
app.use('/api', routerArticles)
app.use('/api', router_bd)
app.use('/api', router_history)

app.use((req, res, next) => {
    // console.log('req = ', req.url) // вот тут динамические страницы
    if (req.url.includes('/promo/') && !req.url.includes('/st/')) return generationPagesForPromo(res, req.url)      // отдаем промоакции
    if (!req.url.includes('/pub_auto/')) Controllers.redirectBrand(req.url, res)                                    // открываем страницу cars или бренды

    return res.render('404', {confirm: ''})
});

async function startApp() {
    try {
        // Open SQLite database with WAL mode
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_URI,
            uri: true
        });
        // Enable WAL mode
        await db.run('PRAGMA journal_mode=WAL');

        // Create sections and cars tables if they don't exist
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sections
            (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars
            (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // Make db available globally or pass to controllers
        global.db = db;

        app.listen(PORT, HOST, () => console.log(`SERVER STARTED ON http://${HOST}:${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

startApp()
