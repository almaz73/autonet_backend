import {AdminJS} from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import {Database, Resource} from '@adminjs/sequelize'
import {sequelize, Admins, history_period, clientEmails, promo} from './src/clientBaza/db.js'




// Проверка: имеет ли текущий админ роль суперпользователя
const isSuperAdmin = ({ currentAdmin }) => {
    return currentAdmin?.role?.toLowerCase() === 'superadmin';
};

console.log('isSuperAdmin = ',isSuperAdmin)

AdminJS.registerAdapter({Database, Resource})

export const adminJs = new AdminJS({
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
                        isAccessible: isSuperAdmin,
                    },
                },
            },
        },
        {
            resource: clientEmails,
            options: {
                tableName: 'clientEmails',
                listProperties: ['fio', 'address', 'link', 'city', 'type_form', 'credit', 'created_at'],
                navigation: null,
                sort: {
                    sortBy: 'id',      // Поле для сортировки (можно заменить на 'createdAt' или 'startedDate')
                    direction: 'desc', // 'desc' — по убыванию (последние будут наверху), 'asc' — по возрастанию [1]
                },
            },
        },
        {
            resource: history_period,
            options: {
                tableName: 'history_period',
                listProperties: ['startDate', 'endDate', 'car', 'days'],
                navigation: null,
            },
        },
        {
            resource: promo,
            options: {
                tableName: 'promo',
                listProperties: ['name', 'onMain', 'active', 'priority'],
                navigation: null,
                sort: {
                    sortBy: 'id',
                    direction: 'desc',
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
                },
                messages: {
                    successfullyCreated: 'Запись успешно создана.',
                    successfullyUpdated: 'Изменения успешно сохранены.',
                    successfullyDeleted: 'Запись успешно удалена.',
                    bulkDeleteSuccessful: 'Выбранные записи успешно удалены.',
                    errorPublishing: 'Ошибка при сохранении записи.',
                    noRecords: 'Записей пока нет.',
                },
                properties: {
                    // Глобальный перевод названий полей, если они совпадают в разных моделях
                    // navigation: 'Навигация',
                    onMain: 'На главной',
                    active: 'Активный',
                    name: 'Название',
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

export const routerAdminJs = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
    authenticate,
    cookieName: 'adminjs',
    cookiePassword: 'Adm1nJs_autonet_s3ssion_2026', // секрет для подписи сессии
    maxRetries: 5, // не более 5 попыток входа подряд с одного IP
}, null, {
    resave: false,
    saveUninitialized: true,
}); // Создание роутера для Express с авторизацией по паролю