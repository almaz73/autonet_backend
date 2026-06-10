// для тестирования метода

import {addEmailToDatabase, addClientEmail} from "../listEmailsFromForms/listClientEmails.js"




console.log('addEmailToDatabase = ', addEmailToDatabase)

let receivedData =  {
    type: 1,
    text: 'Имя: test\n' +
        'Телефон: +7 (555) 555-55-82\n' +
        'Согласие на рекламу: ДА\n' +
        'Ссылка: http://localhost:9173/\n'
}

// receivedData.text = "Имя: test\nТелефон: +7 (666) 666-66-66\nEmail: weew@we.rr\nСогласие на рекламу: ДА\nСсылка: http://localhost:9173/cars/car.html?id=c060dfe4-25fd-11f1-816d-00505601020a\nАвто адрес: Тверь Оснабрюкская 39\n"
receivedData.text = "Имя: test\nТелефон: +7 (988) 888-88-88\nГород: Казань\nМарка: Кадиллак\nМодель: 900\nГод: 2002\nСогласие на рекламу: ДА\n"

addEmailToDatabase(receivedData);