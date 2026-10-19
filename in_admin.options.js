import {AdminJS} from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import {Database, Resource} from '@adminjs/sequelize'
import {sequelize, User, history_period, clientEmails} from './src/clientBaza/db.js'

AdminJS.registerAdapter({Database, Resource})

export const adminJs = new AdminJS({
    databases: [sequelize],
    resources: [
        {
            resource: User,
            options: {
                // navigation: {name: 'Пользователи', icon: 'User'},
                navigation: null,
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
                    NAVIGATION: 'Навигация',
                    pages: 'Страницы',
                    selectedRecords: 'Выбрано ({{count}})',
                    // Перевод названий ваших таблиц/моделей
                    Users: 'Пользователи',
                    clientEmails: 'Соглашения',
                    history_period: 'Время продаж',
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

export const routerAdminJs = AdminJSExpress.buildRouter(adminJs); // Создание роутера для Express