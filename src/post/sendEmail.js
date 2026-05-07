import {transporterYandex} from "../nodemailerYandex.js";
import {transporter} from "../nodemailer.js";

export async function sendEmail(text) {
    await transporterYandex.sendMail({
        from: 'almaz73@yandex.ru',
        to: 'almaz73@gmail.com',
        subject: 'ОТЧЕТ ПО ОБНОВЛЕНИЮ',
        text: text
    });

    // await transporter.sendMail({
    //     from: 'autoset_info@cartat.ru',
    //     to: 'almaz73@yandex.ru, almaz73@gmail.com',
    //     subject: 'ОТЧЕТ ПО ОБНОВЛЕНИЮ',
    //     text: text
    // });


}