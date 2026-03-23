import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    // host: 'mx.orange.local',
    // secure: false,
    // port: 587,
    // tls: { rejectUnauthorized: false },
    // auth: {
    //     user: 'autoset_info@cartat.ru',
    //     pass: 'Xx0nx75hL',
    // },

    host: 'email.cartat.ru', // Адрес SMTP сервера
    // port: 465,                // Порт (465 - SSL, 587 - TLS)
    // secure: true,             // true для 465, false для 587
    secure: false,
    port: 587,
    auth: {
        user: 'autoset_info@cartat.ru',
        pass: 'Xx0nx75hL',
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