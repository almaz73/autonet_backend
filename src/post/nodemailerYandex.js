import nodemailer from "nodemailer";

// Пароль приложения Яндекс.Почты берём из .env: в исходниках его быть не должно
const yandexUser = process.env.SMTP_YANDEX_USER
const yandexPass = process.env.SMTP_YANDEX_PASS

if (!yandexUser || !yandexPass) {
    console.warn('SMTP_YANDEX_USER/SMTP_YANDEX_PASS не заданы в .env — отправка писем через Яндекс работать не будет')
}

export const transporterYandex = nodemailer.createTransport({
    service: 'yandex',
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // Используем SSL
    auth: {
        user: yandexUser,
        pass: yandexPass,
    }
});
