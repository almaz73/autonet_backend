// генерируем страницы для страниц промоакций

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