import {AdminJS, ComponentLoader} from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import {Database, Resource} from '@adminjs/sequelize'
import path from 'path'
import {fileURLToPath} from 'url'
import session from 'express-session'
import connectSqlite3 from 'connect-sqlite3'
import {randomBytes} from 'node:crypto'
import {sequelize, Admins, history_period, clientEmails, news, promo, dealers, changeHistory} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'
import {clearPromoCache} from '../clientBaza/promo/generationPagesForPromo.js'
import {uploadPromoPhotos} from './promo-upload-action.js'
import {applyPromoPhotoText} from './promo-text-action.js'
import {uploadDealerPhoto} from './dealer-photo-action.js'
import {uploadNewsPhoto} from './news-photo-action.js'
import {removeNewsPhoto} from '../clientBaza/news/newsPhoto.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const componentLoader = new ComponentLoader()
componentLoader.override('SidebarBranding', path.join(__dirname, 'site-logo.jsx'))
// подсветка только что отредактированной акции в списке
componentLoader.override('RecordsTable', path.join(__dirname, 'promo-list-table.jsx'))

const Components = {
    // абсолютный путь: относительный ломается в ESM на Windows
    PromoPhoto: componentLoader.add('PromoPhoto', path.join(__dirname, 'promo-photo.jsx')),
    PromoLink: componentLoader.add('PromoLink', path.join(__dirname, 'promo-link.jsx')),
    PromoEdit: componentLoader.add('PromoEdit', path.join(__dirname, 'promo-edit.jsx')),
    ClientLink: componentLoader.add('ClientLink', path.join(__dirname, 'client-link.jsx')),
    DealerLink: componentLoader.add('DealerLink', path.join(__dirname, 'dealer-link.jsx')),
    DealerEdit: componentLoader.add('DealerEdit', path.join(__dirname, 'dealer-edit.jsx')),
    ClientAddress: componentLoader.add('ClientAddress', path.join(__dirname, 'client-address.jsx')),
    ClientCreatedAt: componentLoader.add('ClientCreatedAt', path.join(__dirname, 'client-created-at.jsx')),
    PromoBool: componentLoader.add('PromoBool', path.join(__dirname, 'promo-bool.jsx')),
    ChangeHistoryCell: componentLoader.add('ChangeHistoryCell', path.join(__dirname, 'change-history-cell.jsx')),
    NewsEdit: componentLoader.add('NewsEdit', path.join(__dirname, 'news-edit.jsx')),
    NewsPhoto: componentLoader.add('NewsPhoto', path.join(__dirname, 'news-photo.jsx')),
    NewsLink: componentLoader.add('NewsLink', path.join(__dirname, 'news-link.jsx')),
    NewsDate: componentLoader.add('NewsDate', path.join(__dirname, 'news-date.jsx')),
}

// авторизация включена всегда; отключить её можно только явным флагом и только вне production
const adminAuthDisabled = process.env.NODE_ENV !== 'production' && process.env.ADMIN_AUTH_DISABLED === '1'


// --- Роли и доступы ---------------------------------------------------------
// Матрица ролей:
//   superadmin    — полный доступ, включая администраторов и роли;
//   admin         — всё, кроме раздела «Администраторы»;
//   promo_manager — акции и контакты + просмотр истории изменений;
//   manager       — просмотр всего, кроме «Администраторов» и «Времени продаж», без изменений.
// Доступ выдаётся только явно перечисленным ролям: неизвестная роль прав не получает.
const roleOf = (context) => context.currentAdmin?.role?.toLowerCase()

const allowRoles = (...roles) => ({
    isAccessible: (context) => roles.includes(roleOf(context)),
})

// раздел «Администраторы» и управление ролями/доступами
const superAdminOnly = allowRoles('superadmin')

// данные клиентов: promo_manager их не видит
const withoutPromoManager = allowRoles('superadmin', 'admin', 'manager')

// изменения данных клиентов
const adminOnly = allowRoles('superadmin', 'admin')

// акции и контакты: редактируют superadmin, admin и promo_manager
const promoEditors = allowRoles('superadmin', 'admin', 'promo_manager')

// просмотр истории изменений доступен всем четырём ролям
const allRoles = allowRoles('superadmin', 'admin', 'promo_manager', 'manager')

// карточка только для просмотра: менеджер не может открыть форму редактирования
const managerOnly = allowRoles('manager')

// массовое удаление не нужно: без доступных bulk-действий AdminJS не рисует
// колонку галочек и панель «Удалить выбранные» ни в одном списке
const noBulkActions = {isAccessible: () => false}

// историю изменений храним три месяца: перед записью нового изменения
// удаляем всё, что старше, чтобы таблица не разрасталась
const HISTORY_RETENTION_MONTHS = 3
const cleanupChangeHistory = () => sequelize.query(
    `DELETE FROM changeHistory WHERE datetime(created_at) < datetime('now', ?)`,
    {replacements: [`-${HISTORY_RETENTION_MONTHS} months`]},
)

// после удаления статьи убираем только загруженное через админку фото
const cleanupNewsPhoto = async (response) => {
    const records = response?.records ?? (response?.record ? [response.record] : [])
    await Promise.all(records.map((record) => removeNewsPhoto(record?.params?.image)))
    return response
}

// изменение статьи: сначала фиксируем в истории, затем при удалении чистим фото
const afterNewsChange = (action) => async (response, request, context) => {
    const result = await logChange('news', action)(response, request, context)
    return action === 'delete' ? cleanupNewsPhoto(result) : result
}

// пишем в changeHistory только успешные изменения: кто, когда, какую запись и что с ней сделал
const logChange = (entity, action) => async (response, request, context) => {
    if (request.method !== 'post' || response?.notice?.type !== 'success') return response

    const changed = response.records ?? (response.record ? [response.record] : [])
    const adminName = context.currentAdmin?.name ?? context.currentAdmin?.email ?? null

    // сбой очистки не должен ломать уже сохранённое изменение — только пишем в лог
    try {
        await cleanupChangeHistory()
    } catch (error) {
        console.error('Не удалось очистить историю изменений:', error.message)
    }

    await Promise.all(changed.map((record) => {
        const recordId = record.id ?? record.params?.id
        const target = entity === 'promo'
            ? { promo_id: recordId, promo_name: record.params?.name ?? null }
            : entity === 'news'
                ? { news_id: recordId, news_name: record.params?.name ?? null }
                : { dealer_id: recordId, dealer_city: record.params?.city ?? null }

        return changeHistory.create({admin_name: adminName, action, ...target})
    }))

    return response
};

// AdminJS пишет в promo напрямую через Sequelize, минуя promoService,
// поэтому кэш баннеров (/getMainBanners, /getActiveBanners) сбрасываем сами
const afterPromoChange = (action) => async (response, request, context) => {
    clearPromoCache()
    return logChange('promo', action)(response, request, context)
};


AdminJS.registerAdapter({Database, Resource})

export const adminJs = new AdminJS({
    componentLoader,
    databases: [sequelize],
    resources: [
        {
            resource: Admins,
            options: {
                // navigation: {name: 'Пользователи', icon: 'User'},
                navigation: null,
                // роли ограничены матрицей доступов выше; произвольный текст не даём вводить
                properties: {
                    role: {
                        availableValues: [
                            {value: 'superadmin', label: 'Суперадмин — полный доступ'},
                            {value: 'admin', label: 'Администратор — всё, кроме администраторов'},
                            {value: 'promo_manager', label: 'Промо-менеджер — акции, контакты, история'},
                            {value: 'manager', label: 'Менеджер — просмотр всего, кроме администраторов'},
                        ],
                    },
                },
                actions: {
                    // доступ к администраторам и паролям только у superadmin
                    new: superAdminOnly,
                    list: superAdminOnly,
                    show: superAdminOnly,
                    edit: superAdminOnly,
                    delete: superAdminOnly,
                    bulkDelete: noBulkActions,
                    search: superAdminOnly,
                },
            },
        },
        {
            resource: clientEmails,
            options: {
                tableName: 'clientEmails',
                // телефон, e-mail и кредит в списке скрыты; дата создания — без времени
                listProperties: ['fio', 'address', 'link', 'type_form', 'created_at'],
                navigation: null,
                actions: {
                    list: withoutPromoManager,
                    show: withoutPromoManager,
                    new: adminOnly,
                    edit: adminOnly,
                    delete: adminOnly,
                    bulkDelete: noBulkActions,
                    search: withoutPromoManager,
                },
                sort: {
                    sortBy: 'id',      // Поле для сортировки (можно заменить на 'createdAt' или 'startedDate')
                    direction: 'desc', // 'desc' — по убыванию (последние будут наверху), 'asc' — по возрастанию [1]
                },
                properties: {
                    // на узких экранах AdminJS оставляет только title-колонку
                    fio: {
                        isTitle: true,
                    },
                    address: {
                        components: {list: Components.ClientAddress},
                    },
                    link: {
                        components: {list: Components.ClientLink},
                    },
                    created_at: {
                        components: {list: Components.ClientCreatedAt},
                    },
                },
            },
        },
        {
            resource: history_period,
            options: {
                tableName: 'history_period',
                listProperties: ['endDate', 'car', 'days'],
                navigation: null,
                sort: {
                    sortBy: 'endDate',
                    direction: 'desc',
                },
                actions: {
                    // «Время продаж» доступно только суперадмину
                    list: superAdminOnly,
                    show: superAdminOnly,
                    new: superAdminOnly,
                    edit: superAdminOnly,
                    delete: superAdminOnly,
                    bulkDelete: noBulkActions,
                    search: superAdminOnly,
                },
                properties: {
                    // на узких экранах AdminJS оставляет только title-колонку
                    endDate: {
                        isTitle: true,
                    },
                },

            },
        },
        {
            resource: promo,
            options: {
                tableName: 'promo',
                listProperties: ['name', 'photo278', 'code', 'onMain', 'active', 'priority'],
                navigation: null,
                sort: {
                    sortBy: 'priority',
                    direction: 'asc',
                },
                actions: {
                    list: {
                        ...allRoles,
                        before: (request) => {
                            if (!request.query?.perPage) {
                                request.query = {...request.query, perPage: 50}
                            }
                            return request
                        },
                    },
                    edit: {
                        isAccessible: promoEditors.isAccessible,
                        component: Components.PromoEdit,
                        after: afterPromoChange('update'),
                    },
                    // просмотр карточки доступен менеджеру; остальным клик открывает редактирование
                    show: managerOnly,
                    new: {
                        isAccessible: promoEditors.isAccessible,
                        component: Components.PromoEdit,
                        after: afterPromoChange('create'),
                        before: async (request) => {
                            // код новой акции = максимальный существующий + 1
                            if (!request.payload?.code) {
                                request.payload = {
                                    ...(request.payload ?? {}),
                                    code: await promoService.getNextPromoCode(),
                                }
                            }
                            return request
                        },
                    },
                    delete: {
                        ...promoEditors,
                        after: afterPromoChange('delete'),
                    },
                    bulkDelete: noBulkActions,
                    // вызывается кнопкой загрузки фото из PromoEdit, в интерфейсе не показывается
                    uploadPhotos: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: promoEditors.isAccessible,
                        handler: uploadPromoPhotos,
                    },
                    // вызывается редактором текста из PromoEdit, в интерфейсе не показывается
                    applyPhotoText: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: promoEditors.isAccessible,
                        handler: applyPromoPhotoText,
                    },
                },
                properties: {
                    photo278: {
                        components: {list: Components.PromoPhoto},
                    },
                    code: {
                        components: {list: Components.PromoLink},
                    },
                    onMain: {
                        components: {list: Components.PromoBool},
                    },
                    active: {
                        components: {list: Components.PromoBool},
                    },
                    description: {
                        type: 'textarea',
                    },
                    styles: {
                        type: 'textarea',
                    },
                    content: {
                        type: 'richtext',
                    },
                },
            },
        },
        {
            resource: news,
            options: {
                tableName: 'news',
                listProperties: ['image', 'name', 'date', 'url', 'active'],
                navigation: null,
                sort: {
                    sortBy: 'date',
                    direction: 'desc',
                },
                actions: {
                    list: {
                        ...allRoles,
                        before: (request) => {
                            if (!request.query?.perPage) {
                                request.query = {...request.query, perPage: 50}
                            }
                            return request
                        },
                    },
                    edit: {
                        isAccessible: promoEditors.isAccessible,
                        component: Components.NewsEdit,
                        after: afterNewsChange('update'),
                    },
                    // просмотр карточки доступен менеджеру; остальным клик открывает редактирование
                    show: managerOnly,
                    new: {
                        isAccessible: promoEditors.isAccessible,
                        component: Components.NewsEdit,
                        after: afterNewsChange('create'),
                    },
                    delete: {
                        ...promoEditors,
                        after: afterNewsChange('delete'),
                    },
                    bulkDelete: noBulkActions,
                    search: allRoles,
                    // вызывается кнопкой загрузки фото из NewsEdit, в интерфейсе не показывается
                    uploadPhoto: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: promoEditors.isAccessible,
                        handler: uploadNewsPhoto,
                    },
                },
                properties: {
                    image: {
                        components: {list: Components.NewsPhoto},
                    },
                    date: {
                        components: {list: Components.NewsDate},
                    },
                    url: {
                        components: {list: Components.NewsLink},
                    },
                    active: {
                        components: {list: Components.PromoBool},
                    },
                    announce: {
                        type: 'textarea',
                    },
                    content: {
                        type: 'richtext',
                    },
                },
            },
        },
        {
            resource: dealers,
            options: {
                tableName: 'dealers',
                navigation: null,
                listProperties: ['city', 'address',  'profile', 'link'],
                actions: {
                    list: {
                        ...allRoles,
                        before: (request) => {
                            if (!request.query?.perPage) {
                                request.query = {...request.query, perPage: 300}
                            }
                            return request
                        },
                    },
                    edit: {
                        isAccessible: promoEditors.isAccessible,
                        component: Components.DealerEdit,
                        after: logChange('dealer', 'update'),
                    },
                    // просмотр карточки доступен менеджеру; остальным клик открывает редактирование
                    show: managerOnly,
                    new: {
                        ...promoEditors,
                        after: logChange('dealer', 'create'),
                    },
                    delete: {
                        ...promoEditors,
                        after: logChange('dealer', 'delete'),
                    },
                    bulkDelete: noBulkActions,
                    // вызывается кнопкой загрузки фото из DealerEdit, в интерфейсе не показывается
                    uploadPhoto: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: promoEditors.isAccessible,
                        handler: uploadDealerPhoto,
                    },
                },
                properties: {
                    // на узких экранах AdminJS оставляет только title-колонку
                    city: {
                        isTitle: true,
                    },
                    id: {
                        isVisible: {list: false, filter: false, show: false, edit: false},
                    },
                    address: {
                        type: 'textarea',
                    },
                    // при создании можно выбрать только один из допустимых профилей,
                    // несколько профилей отмечаются потом в форме редактирования
                    profile: {
                        availableValues: [
                            {value: 'Новые авто', label: 'Новые авто'},
                            {value: 'Авто с пробегом', label: 'Авто с пробегом'},
                            {value: 'Сервис', label: 'Сервис'},
                        ],
                    },
                    link: {
                        isDisabled: true,
                        components: {list: Components.DealerLink},
                    },
                },
            },
        },
        {
            resource: changeHistory,
            options: {
                tableName: 'changeHistory',
                navigation: null,
                listProperties: ['admin_name', 'promo_id', 'promo_name', 'created_at'],
                sort: {
                    sortBy: 'created_at',
                    direction: 'desc',
                },
                actions: {
                    // журнал изменений — только просмотр, доступен всем ролям (включая promo_manager)
                    list: allRoles,
                    search: allRoles,
                    show: {isAccessible: () => false},
                    new: {isAccessible: () => false},
                    edit: {isAccessible: () => false},
                    delete: {isAccessible: () => false},
                    bulkDelete: {isAccessible: () => false},
                },
                properties: {
                    // на узких экранах AdminJS оставляет только title-колонку
                    admin_name: {
                        isTitle: true,
                    },
                    promo_id: {
                        components: {list: Components.ChangeHistoryCell},
                    },
                    promo_name: {
                        components: {list: Components.ChangeHistoryCell},
                    },
                },
            },
        }],
    rootPath: '/administrator',
    loginPath: '/administrator/login',
    logoutPath: '/administrator/logout',
    branding: {
        logo: '/st/logo_21.svg',
        companyName: 'Автосеть.РФ',
        softwareBrothers: true
    },
    assets: {
        styles: ['/admin-assets/admin.css'],
    },
    // Настройка локализации
    locale: {
        language: 'ru', // Установка языка по умолчанию
        availableLanguages: ['ru'],
        translations: {
            ru: { // или 'en'
                actions: {
                    new: 'Создать',
                    edit: 'Редактировать',
                    show: 'Просмотр',
                    delete: 'Удалить',
                    bulkDelete: 'Удалить выбранные',
                    list: 'Список',
                },
                buttons: {
                    save: 'Сохранить',
                    filter: 'Фильтр',
                    applyChanges: 'Применить изменения',
                    reset: 'Сбросить',
                    confirmRemoval: 'Вы уверены, что хотите удалить эту запись?',
                    createFirstRecord: 'Создать первую запись',
                    confirm: 'Да',
                    cancel: 'Отмена',
                },
                labels: {
                    loginWelcome: 'Добро пожаловать в панель управления',
                    pages: 'Страницы',
                    selectedRecords: 'Выбрано ({{count}})',
                    // Перевод названий ваших таблиц/моделей
                    Admins: 'Администраторы',
                    clientEmails: 'Соглашения',
                    news: 'Статьи',
                    history_period: 'Время продаж',
                    promo: 'Акции',
                    dealers: 'Контакты',
                    changeHistory: 'История изменений',
                    confirm: 'Подтверждение',
                },
                messages: {
                    successfullyCreated: 'Запись успешно создана.',
                    successfullyUpdated: 'Изменения успешно сохранены.',
                    successfullyDeleted: 'Запись успешно удалена.',
                    bulkDeleteSuccessful: 'Выбранные записи успешно удалены.',
                    errorPublishing: 'Ошибка при сохранении записи.',
                    noRecords: 'Записей пока нет.',
                    confirmDelete:'Вы уверены, что хотите удалить эту запись?'
                },
                resources: {
                    promo: {
                        properties: {
                            code: 'Ссылка',
                            title: 'SEO Title',
                            description: 'Meta Description',
                            styles: 'Стили',
                            content: 'Содержимое страницы',
                            photo278: 'Фото 278px',
                            photo585: 'Фото 585px',
                            photo1200: 'Фото 1200px',
                        },
                    },
                    history_period: {
                        properties: {
                            endDate: 'Дата реализации',
                            days: 'За сколько дней',
                            car: 'Автомобиль',
                        },
                    },
                    clientEmails:{
                        properties: {
                            fio: 'ФИО',
                            phone: 'Телефон',
                            email: 'E-mail',
                            address: 'Адрес',
                            link: 'Ссылка',
                            city: 'Город',
                            type_form: 'Форма',
                            credit:'Кредит',
                            created_at:'Создано'

                        },
                    },
                    news: {
                        properties: {
                            name: 'Заголовок',
                            title: 'SEO Title',
                            description: 'Meta Description',
                            announce: 'Краткое описание',
                            content: 'Содержимое страницы',
                            date: 'Дата',
                            url: 'Ссылка',
                            image: 'Фото',
                            active: 'Активная',
                        },
                    },
                    dealers: {
                        properties: {
                            city: 'Город',
                            url: 'Фото',
                            coords: 'Координаты',
                            address: 'Адрес',
                            tel: 'Телефон',
                            email: 'Email',
                            days: 'Режим работы',
                            profile: 'Профиль',
                            brands: 'Марки',
                            link: 'Ссылка',
                        },
                    },
                    changeHistory: {
                        properties: {
                            admin_name: 'Кто менял',
                            promo_id: 'Раздел',
                            promo_name: 'Название/город/статья',
                            created_at: 'Время',
                            action: 'Действие',
                        },
                    },
                },
                properties: {
                    // Глобальный перевод названий полей, если они совпадают в разных моделях
                    // navigation: 'Навигация',
                    onMain: 'На главной',
                    active: 'Активный',
                    name: 'Название',
                    photo278: 'Фото',
                    priority: 'Порядок',
                    id: 'ID',
                    createdAt: 'Дата создания',
                    updatedAt: 'Дата обновления',
                    email: 'Электронная почта',
                    password: 'Пароль',
                    role: 'Роль',
                }
            }
        }
    }
});

adminJs.watch()

// --- Настройка сессии админки -------------------------------------------------

// в production cookie должна уходить только по HTTPS (за nginx/Apache нужен trust proxy в index.js)
const isProduction = process.env.NODE_ENV === 'production'

// секрет подписи cookie сессии держим в .env, а не в исходниках
let adminSessionSecret = process.env.ADMIN_SESSION_SECRET
if (!adminSessionSecret) {
    if (isProduction) {
        throw new Error('ADMIN_SESSION_SECRET не задан: добавьте секрет в .env')
    }
    adminSessionSecret = randomBytes(48).toString('base64url')
    console.warn('ADMIN_SESSION_SECRET не задан — сгенерирован временный секрет, сессии сбросятся при рестарте')
}

// сессии храним в SQLite: они не теряются при рестарте и не копятся в памяти процесса
const SQLiteStore = connectSqlite3(session)
const adminSessionStore = new SQLiteStore({
    db: 'admin-sessions.sqlite',
    dir: process.cwd(),
    table: 'sessions',
})

// AdminJS не передаёт запрос в authenticate, а express-formidable внутри него сбрасывает
// AsyncLocalStorage, поэтому перегенерировать сессию из колбэка входа нельзя.
// Это и не требуется: при saveUninitialized: false до входа сессии не существует,
// поэтому подставить (зафиксировать) session ID некому — логин создаёт новый.

// Лимит попыток входа: 10 за 15 минут с одного IP, при превышении — блокировка на 15 минут.
// Дополняет встроенный maxRetries AdminJS (5 попыток за 60 секунд, хранится только в памяти)
const LOGIN_ATTEMPTS_LIMIT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const loginAttempts = new Map()

const pruneLoginAttempts = (now) => {
    for (const [ip, entry] of loginAttempts) {
        if (entry.resetAt <= now && (!entry.blockedUntil || entry.blockedUntil <= now)) {
            loginAttempts.delete(ip)
        }
    }
}

export const adminLoginRateLimit = (req, res, next) => {
    if (req.method !== 'POST' || !req.path.endsWith('/login')) return next()

    const now = Date.now()
    if (loginAttempts.size > 1000) pruneLoginAttempts(now)

    let entry = loginAttempts.get(req.ip)
    if (!entry || entry.resetAt <= now) {
        entry = {count: 0, resetAt: now + LOGIN_WINDOW_MS}
        loginAttempts.set(req.ip, entry)
    }

    if (entry.blockedUntil && entry.blockedUntil > now) {
        res.set('Retry-After', String(Math.ceil((entry.blockedUntil - now) / 1000)))
        return res.status(429).send('Слишком много попыток входа. Попробуйте позже.')
    }

    if (entry.count >= LOGIN_ATTEMPTS_LIMIT) {
        entry.blockedUntil = now + LOGIN_WINDOW_MS
        res.set('Retry-After', String(Math.ceil(LOGIN_WINDOW_MS / 1000)))
        return res.status(429).send('Слишком много попыток входа. Попробуйте позже.')
    }

    entry.count += 1
    // успешный вход (AdminJS отвечает редиректом 302) сбрасывает счётчик
    res.on('finish', () => {
        if (res.statusCode === 302) loginAttempts.delete(req.ip)
    })
    next()
}

// Проверка логина и пароля при входе в /administrator
const authenticate = async (email, password) => {
    const admin = await Admins.findOne({where: {email}});
    if (!admin || admin.password !== password) return null;
    return admin; // запись попадёт в currentAdmin внутри админки
};

// авторизация по умолчанию включена; ADMIN_AUTH_DISABLED=1 работает только вне production
export const routerAdminJs = adminAuthDisabled ?
    AdminJSExpress.buildRouter(adminJs) :
    AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate,
        cookieName: 'adminjs',
        cookiePassword: adminSessionSecret,
        maxRetries: 5, // не более 5 попыток входа подряд с одного IP
    }, null, {
        store: adminSessionStore,
        resave: false,
        saveUninitialized: false, // сессия создаётся при входе, а не на каждый запрос
        rolling: true, // продлевать cookie при активности
        cookie: {
            httpOnly: true,
            sameSite: 'strict', // основная защита от CSRF для админки
            secure: isProduction, // за reverse proxy с HTTPS
            maxAge: 8 * 60 * 60 * 1000, // 8 часов
        },
    });