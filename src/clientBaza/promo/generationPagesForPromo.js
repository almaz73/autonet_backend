// генерируем страницы для страниц промоакций

import Controllers from "../../xml_import/Controllers.js";
import NodeCache from "node-cache";

const myPromoCache = new NodeCache({ stdTTL: 1000000}) // 1000000 секунд

export function clearPromoCache() {
    // myCache.del("myKey"); // Удалить конкретный элемент
    myPromoCache.flushAll(); // Очистить весь кэш (радикальный метод)
}

export async function generationPagesForPromo(app) {
    app.get('/page/:id', (req, res) => {
        const pageId = req.params.id;

        console.log('3333 = ',3333)
        
        // Данные, которые меняются
        const data = {
            title: `Страница №${pageId}`,
            content: `Это динамическое содержимое для страницы ${pageId}`,
            items: ['яблоко', 'банан', 'апельсин']
        };

        // Рендерим файл pub/page.ejs и передаем в него данные
        res.render('page', data);
    });

}

export async function getMainBanners (req, res){
    try {
        const cachedData = myPromoCache.get('/getMainBanners')
        if (cachedData)  return res.json(cachedData); // Отправка из кэша
        const promoItems = await Controllers.getActivePromoBanners();
        myPromoCache.set('/getMainBanners', promoItems);
        res.json(promoItems);
    } catch (error) {
        console.error('Error getting promo banners:', error);
        res.status(500).json({ error: 'Failed to get promo banners' });
    }
}