import AdminJS from 'adminjs'
import AdminJSExpress from '@adminjs/express'


export const adminJs = new AdminJS({
    databases: [], //  базы данных
    resources: [], //  ресурсы
    rootPath: '/administrator', // Меняем пути c /admin
    loginPath: '/administrator/login',
    logoutPath: '/administrator/logout',
});

adminJs.watch()

export const routerAdminJs = AdminJSExpress.buildRouter(adminJs); // Создание роутера для Express