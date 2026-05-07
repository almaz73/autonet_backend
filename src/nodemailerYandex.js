import nodemailer from "nodemailer";
import dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();

export const transporterYandex = nodemailer.createTransport({
    service: 'yandex',
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // Используем SSL
    auth: {
        user: process.env.SMTP_USER_YA,
        pass: process.env.SMTP_PASS_YA,
        // user: 'almaz73@yandex.ru',
        // pass: 'ehmyphfngojaocwx',
    }
});

console.log('8889988899 process.env.SMTP_USER_YA = ',process.env.SMTP_USER_YA)

setTimeout(()=>{

})
// console.log('transporterYandex = ',transporterYandex)

// let result = await transporter.sendMail({
//     from: 'almaz_73@mail.ru',
//     to: 'a.fayzrakhmanov@cartat.ru',
//     subject: 'Message from Node js',
//     text: 'Проверка работы почты с сайта.',
//     html:
//         'This <i>message</i> was sent from <strong>Node js</strong> server.',
// });
//
// console.log(result);