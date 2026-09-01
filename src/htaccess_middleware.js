export function seoRedirects(req, res, next) {
    // не подхватывается на сайте, но как пример временно подержу, не зря копался. ..
    const url = req.originalUrl
    if(['/st','/pub_promo/','/api',  '/pub_auto/','/assets', '/src/','/.well-known/'].find(el=>url.includes(el) )) return next()
    // console.log('>>>>> req.originalUrl = ',req.originalUrl)
    
    // console.log('req.query = ',req.query)

    if (req.query.pm_source || req.query.pm_block || req.query.pm_position || req.query.PAGEN_2 || req.query.PAGEN_1 || req.yclid) {
        // все такие ссылки  ?pm_source=inosmi.ru&pm_block=none&pm_position=0&PAGEN_2=6 уходят /cars
        return res.redirect(301, '/cars');
    }
    if (req.path === '/index.html') {
       return res.redirect(301, '/');
    }

    return next()
}