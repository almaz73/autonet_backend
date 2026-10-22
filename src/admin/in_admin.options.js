import {AdminJS, ComponentLoader} from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import {Database, Resource} from '@adminjs/sequelize'
import path from 'path'
import {fileURLToPath} from 'url'
import {sequelize, Admins, history_period, clientEmails, promo} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'
import {uploadPromoPhotos} from './promo-upload-action.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const componentLoader = new ComponentLoader()
const Components = {
    // абсолютный путь: относительный ломается в ESM на Windows
    PromoPhoto: componentLoader.add('PromoPhoto', path.join(__dirname, 'promo-photo.jsx')),
    PromoLink: componentLoader.add('PromoLink', path.join(__dirname, 'promo-link.jsx')),
    PromoEdit: componentLoader.add('PromoEdit', path.join(__dirname, 'promo-edit.jsx')),
    ClientLink: componentLoader.add('ClientLink', path.join(__dirname, 'client-link.jsx')),
    ClientAddress: componentLoader.add('ClientAddress', path.join(__dirname, 'client-address.jsx')),
    PromoBool: componentLoader.add('PromoBool', path.join(__dirname, 'promo-bool.jsx')),
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
                    new: {
                        // Кнопка "Создать" и вызов new доступны только суперадмину
                        isAccessible: (context) => isSuperAdmin(context) && !isPromoManager(context),
                    },
                    list: hideForPromoManagerAndManager,
                    show: hideForPromoManagerAndManager,
                    edit: hideForPromoManagerAndManager,
                    delete: hideForPromoManagerAndManager,
                    bulkDelete: hideForPromoManagerAndManager,
                    search: hideForPromoManagerAndManager,
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
                        isVisible: hideForManager,
                        component: Components.PromoEdit,
                    },
                    // режим просмотра не нужен: клик по строке открывает редактирование
                    show: {
                        isAccessible: () => false,
                    },
                    new: {
                        isVisible: hideForManager,
                        component: Components.PromoEdit,
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
                    delete: hideForManager,
                    bulkDelete: hideForManager,
                    // вызывается кнопкой загрузки фото из PromoEdit, в интерфейсе не показывается
                    uploadPhotos: {
                        isVisible: false,
                        method: 'post',
                        isAccessible: hideForManager.isAccessible,
                        handler: uploadPromoPhotos,
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
        }],
    rootPath: '/administrator',
    loginPath: '/administrator/login',
    logoutPath: '/administrator/logout',
    branding: {
        logo: '/st/logo_20.svg',
        companyName: 'Автосеть.РФ',
        softwareBrothers: true
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
                            description: 'Описание',
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