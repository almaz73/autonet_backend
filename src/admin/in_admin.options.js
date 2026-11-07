import {AdminJS, ComponentLoader} from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import {Database, Resource} from '@adminjs/sequelize'
import path from 'path'
import {fileURLToPath} from 'url'
import {sequelize, Admins, history_period, clientEmails, promo, dealers, changeHistory} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'
import {clearPromoCache} from '../clientBaza/promo/generationPagesForPromo.js'
import {uploadPromoPhotos} from './promo-upload-action.js'
import {applyPromoPhotoText} from './promo-text-action.js'
import {uploadDealerPhoto} from './dealer-photo-action.js'

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
    PromoBool: componentLoader.add('PromoBool', path.join(__dirname, 'promo-bool.jsx')),
    ChangeHistoryCell: componentLoader.add('ChangeHistoryCell', path.join(__dirname, 'change-history-cell.jsx')),
}

const isDev = process.env.USERNAME === 'almaz' // на моем компе без пароля для разработки


// Проверка: имеет ли текущий админ роль суперпользователя
const isSuperAdmin = ({ currentAdmin }) => {
    return currentAdmin?.role?.toLowerCase() === 'superadmin';
};

// Промо-менеджеру разрешён только раздел «Акции»
const isPromoManager = ({ currentAdmin }) => {
    return currentAdmin?.role?.toLowerCase() === 'promo_manager';
};

// Менеджеру разрешён только просмотр
const isManager = ({ currentAdmin }) => {
    return currentAdmin?.role?.toLowerCase() === 'manager';
};

const hideForPromoManager = {
    isAccessible: (context) => !isPromoManager(context),
};

// Раздел/действие скрыто для promo_manager и manager
const hideForPromoManagerAndManager = {
    isAccessible: (context) => !isPromoManager(context) && !isManager(context),
};

const hideForManager = {
    isAccessible: (context) => !isManager(context),
};

// Раздел «Администраторы» (и пароли) — только суперадмину;
// локально авторизация отключена, поэтому доступ не ограничиваем
const superAdminOnly = {
    isAccessible: (context) => isDev || isSuperAdmin(context),
};

// пишем в changeHistory только успешные изменения: кто, когда, какую запись и что с ней сделал
const logChange = (entity, action) => async (response, request, context) => {
    if (request.method !== 'post' || response?.notice?.type !== 'success') return response

    const changed = response.records ?? (response.record ? [response.record] : [])
    const adminName = context.currentAdmin?.name ?? context.currentAdmin?.email ?? null

    await Promise.all(changed.map((record) => changeHistory.create({
        admin_name: adminName,
        action,
        ...(entity === 'promo'
            ? { promo_id: record.id ?? record.params?.id, promo_name: record.params?.name ?? null }
            : { dealer_id: record.id ?? record.params?.id, dealer_city: record.params?.city ?? null }),
    })))

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
                actions: {
                    // доступ к администраторам и паролям только у superadmin
                    new: superAdminOnly,
                    list: superAdminOnly,
                    show: superAdminOnly,
                    edit: superAdminOnly,
                    delete: superAdminOnly,
                    bulkDelete: superAdminOnly,
                    search: superAdminOnly,
                },
            },
        },
        {
            resource: clientEmails,
            options: {
                tableName: 'clientEmails',
                listProperties: ['fio', 'phone', 'email', 'address', 'link', 'type_form', 'credit', 'created_at'],
                navigation: null,
                actions: {
                    list: hideForPromoManager,
                    show: hideForPromoManager,
                    new: hideForPromoManagerAndManager,
                    edit: hideForPromoManagerAndManager,
                    delete: hideForPromoManagerAndManager,
                    bulkDelete: hideForPromoManagerAndManager,
                    search: hideForPromoManager,
                },
                sort: {
                    sortBy: 'id',      // Поле для сортировки (можно заменить на 'createdAt' или 'startedDate')
                    direction: 'desc', // 'desc' — по убыванию (последние будут наверху), 'asc' — по возрастанию [1]
                },
                properties: {
                    address: {
                        components: {list: Components.ClientAddress},
                    },
                    link: {
                        components: {list: Components.ClientLink},
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
                actions: {
                    list: hideForPromoManager,
                    show: hideForPromoManager,
                    new: hideForPromoManagerAndManager,
                    edit: hideForPromoManagerAndManager,
                    delete: hideForPromoManagerAndManager,
                    bulkDelete: hideForPromoManagerAndManager,
                    search: hideForPromoManager,
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
                        before: (request) => {
                            if (!request.query?.perPage) {
                                request.query = {...request.query, perPage: 50}
                            }
                            return request
                        },
                    },
                    edit: {
                        isAccessible: hideForManager.isAccessible,
                        component: Components.PromoEdit,
                        after: afterPromoChange('update'),
                    },
                    // режим просмотра не нужен: клик по строке открывает редактирование
                    show: {
                        isAccessible: () => false,
                    },
                    new: {
                        isAccessible: hideForManager.isAccessible,
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
                        ...hideForManager,
                        after: afterPromoChange('delete'),
                    },
                    bulkDelete: {
                        ...hideForManager,
                        after: afterPromoChange('delete'),
                    },
                    // вызывается кнопкой загрузки фото из PromoEdit, в интерфейсе не показывается
                    uploadPhotos: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: hideForManager.isAccessible,
                        handler: uploadPromoPhotos,
                    },
                    // вызывается редактором текста из PromoEdit, в интерфейсе не показывается
                    applyPhotoText: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: hideForManager.isAccessible,
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
            resource: dealers,
            options: {
                tableName: 'dealers',
                navigation: null,
                listProperties: ['city', 'address',  'profile', 'link'],
                actions: {
                    list: {
                        before: (request) => {
                            if (!request.query?.perPage) {
                                request.query = {...request.query, perPage: 300}
                            }
                            return request
                        },
                    },
                    edit: {
                        isAccessible: hideForManager.isAccessible,
                        component: Components.DealerEdit,
                        after: logChange('dealer', 'update'),
                    },
                    // режим просмотра не нужен: клик по строке открывает редактирование
                    show: {
                        isAccessible: () => false,
                    },
                    new: {
                        ...hideForManager,
                        after: logChange('dealer', 'create'),
                    },
                    delete: {
                        ...hideForManager,
                        after: logChange('dealer', 'delete'),
                    },
                    bulkDelete: {
                        ...hideForManager,
                        after: logChange('dealer', 'delete'),
                    },
                    // вызывается кнопкой загрузки фото из DealerEdit, в интерфейсе не показывается
                    uploadPhoto: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: hideForManager.isAccessible,
                        handler: uploadDealerPhoto,
                    },
                },
                properties: {
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
                            {value: 'Новые бренды', label: 'Новые бренды'},
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
                    // журнал изменений — только просмотр и только суперадмину
                    list: superAdminOnly,
                    search: superAdminOnly,
                    show: {isAccessible: () => false},
                    new: {isAccessible: () => false},
                    edit: {isAccessible: () => false},
                    delete: {isAccessible: () => false},
                    bulkDelete: {isAccessible: () => false},
                },
                properties: {
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
        logo: '/st/logo_20.svg',
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
                            promo_id: 'Акция/Контакт',
                            promo_name: 'Название / город',
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
                }
            }
        }
    }
});

adminJs.watch()

// Проверка логина и пароля при входе в /administrator
const authenticate = async (email, password) => {
    const admin = await Admins.findOne({where: {email}});
    if (admin && admin.password === password) {
        return admin; // запись попадёт в currentAdmin внутри админки
    }
    return null;
};

// чтобы временно отключить авторизацию
export const routerAdminJs = isDev ?
    AdminJSExpress.buildRouter(adminJs) :
    AdminJSExpress.buildAuthenticatedRouter(adminJs, {
        authenticate,
        cookieName: 'adminjs',
        cookiePassword: 'Adm1nJs_autonet_s3ssion_2026', // секрет для подписи сессии
        maxRetries: 5, // не более 5 попыток входа подряд с одного IP
    }, null, {
        resave: false,
        saveUninitialized: true,
    });