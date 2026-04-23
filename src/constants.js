export const Version = 'ver.2.7.311'

export const devMode = false // для тестирования

export const FolderPhoto = '../front/pub_auto'
export const FolderXML = '../front/XML'
export const FolderLINKS = '../front/LINKS' // тут ссылки для новых фоток, ссылки существующих фоток и ссылки фоток для удаления
export const FolderPhotoForPromoActions = '../front/pub_promo'


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