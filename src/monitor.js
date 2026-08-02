import {sendEmail} from "./post/sendEmail.js";

const URL = 'https://xn--80aej9aped4f.xn--p1ai/'; // Адрес вашего сайта
const CHECK_INTERVAL = 300000;       // Проверка каждые 5 минут
const DELAY_BEFORE_RESTART = 180000; // Ожидание 3 минуты перед перезапуском

let isRecovering = false;

function checkServer() {
    if (isRecovering) return; // Не спамим проверками, если уже ждем перезапуска
    fetch(URL, {signal: AbortSignal.timeout(20000)}) // Тайм-аут 20 секунд
        .then(res => {
            if (!res.ok) handleFailure(`Код ответа: ${res.status}`);
        })
        .catch(err => handleFailure(err.message));
}

function handleFailure(reason) {
    isRecovering = true;
    sendEmail('!!!!!!!!!!! САЙТ УПАЛ !!!!!!!!!!!!' + reason)
    setTimeout(() => {
        // Тут наверно нужно будет удалить зависший процесс и перезапустить сервер:
        // 1) pkill -9 apache
        // 2) touch/ tmp/restart.txt
    }, DELAY_BEFORE_RESTART); // Ожидание несколько минут перед перезапуском nodemon...
}

// Запуск интервала проверок
setInterval(checkServer, CHECK_INTERVAL);
console.log('Мониторинг запущен...');