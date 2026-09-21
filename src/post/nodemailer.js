import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    host: 'email.cartat.ru', // Адрес SMTP сервера //mx.orange.local
    port: 465,                // Порт (465 - SSL, 587 - TLS)
    secure: true,             // true для 465, false для 587
    // tls: { rejectUnauthorized: false }, // пока сертификата нет
    // secure: false,
    // port: 25,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
