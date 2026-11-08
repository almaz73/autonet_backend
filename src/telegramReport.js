// Токен бота и чат для служебных уведомлений храним в .env, а не в исходниках
const botToken = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID

let warned = false

export function sendTelegram(message) {
    if (!botToken || !chatId) {
        if (!warned) {
            console.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не заданы в .env — уведомления в Telegram отключены')
            warned = true
        }
        return
    }

    let linkTelega = `https://api.telegram.org/${botToken}/sendMessage?chat_id=${chatId}&parse_mode=HTML&text=${message}`;

    try {
        fetch(linkTelega)
            .then(response => response.json())
            .then(() => {
                // console.log('сообщение доставлено = ')
            });
    } catch (e) {
        console.log('Ошибка. ТЕЛЕГРАММ НЕ ОТПРАВИЛСЯ')
    }

}
