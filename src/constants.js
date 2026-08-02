export const Version = 'ver.3.022'

export const devMode = false // для тестирования

export const FolderPhoto = '../front/pub_auto'
export const FolderXML = '../front/XML'
export const FolderForSitemap = '../front'
export const FolderLINKS = '../front/LINKS' // тут ссылки для новых фоток, ссылки существующих фоток и ссылки фоток для удаления
export const FolderPhotoForPromoActions = '../front/pub_promo'
export const FolderPhotoForArticle = '../front/pub_article'

export const receivedDataTypes = {
    '1': 'Обратный звонок',
    '2': 'Забронировать автомобиль',
    '3': 'Оценить автомобиль',
    '4': 'Заявка на техосмотр автомобиля',
    '5': 'Запись на шиномонтаж',
    '6': 'Заявка на автокредит',
    '7': 'Заявка на замену масла',
    '8': 'Заявка на ремонт двигателя',
    '9': 'Заявка на подбор автомобиля',
    '10': 'Заявка на франшизу',
    '11': 'Вакансии - анкета с сайта',
    '12': 'Ремонт АКПП',
    '13': 'Сервисное обслуживание',
    '15': 'Письмо ген. директору',
    '17': 'Автострахование'
}

export let xmlUrls = [
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AVTO_NIGNEKAMSK.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_AMK.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Astrahan.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
];
export let xmlNames = [
    'AVTO_NIGNEKAMSK.xml',
    'AlfaAvto5_AMK.xml',
    'AlfaAvto5_Astrahan.xml',
    'AlfaAvto5_Tver.xml',
    'alfa5_gktm.xml',
    'alfa-trade.xml'
];

export function getTime() {
    return new Date().toLocaleDateString('ru') + ' ' + new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    }) + ' '
}

export function transliterate(text) {
    const converter = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    return text.split('').map(char => {
        // Проверяем регистр, чтобы сохранить его в латинице
        const isUpperCase = char === char.toUpperCase();
        const lowerChar = char.toLowerCase();

        if (converter[lowerChar] !== undefined) {
            const converted = converter[lowerChar];
            return isUpperCase ? converted.charAt(0).toUpperCase() + converted.slice(1) : converted;
        }

        return char; // Оставляем без изменений (например, цифры или знаки)
    }).join('');
}

// чтобы привязать динамические сслыки к html прямо на сервере
export let manifest_links = {}
export function set_manifest(val) {
    manifest_links = val
}

export const RussianBrandsRus = ['ВАЗ (LADA)', 'ЗАЗ', 'УАЗ', 'ИЖ', 'Богдан', 'ГАЗ', 'Атом', 'Москвич', 'ЛуАЗ', 'ВИС', 'ЗиС']
export const RussianBrandsLat = ['VAZ(LADA)', 'ZAZ', 'UAZ', 'IZH', 'Bogdan', 'GAZ', 'Atom', 'Moskvich', 'Luaz', 'VIS', 'ZiS']