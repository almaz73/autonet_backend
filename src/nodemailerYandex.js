import nodemailer from "nodemailer";

export const transporterYandex = nodemailer.createTransport({
    service: 'yandex',
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // Используем SSL
    auth: {
        user: 'almaz73@yandex.ru',
        pass: 'ehmyphfngojaocwx',
    }
});

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