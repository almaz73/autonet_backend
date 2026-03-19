import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    host: '213.159.206.196',//'mx.orange.local',
    port: 587,
    auth: {
        user: 'autoset_info@cartat.ru',
        pass: 'Xx0nx75hL',
    },
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