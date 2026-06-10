import {getDB} from '../db.js';

const TYPES = {
    '1': 'Обратный звонок',
    '2': 'Забронировать автомобиль',
    '3': 'Оценить автомобиль',
    '4': 'Заявка на техосмотр автомобиля',
    '5': 'Запись на шиномонтаж',
    '6': 'Заявка на автокредит',
    '7': 'Заявка на замену масла',
    '8': 'Заявка на ремонт двигателя',
    '9': 'Заявка на подбор автомобиля',
    '10': 'Заявка на франшизу',
    '11': 'Вакансии',
    '12': 'Ремонт АКПП',
    '13': 'Сервисное обслуживание',
    '14': 'Заявка на осмотр авто',
    '15': 'Письмо генеральному',
    '16': 'Обратный звонок по промоакциям',
    '17': 'Автострахование'
}

// Create clientEmails table if it doesn't exist
function createEmailsTable(db) {

    // Language=SQLite
    const createEmailsTableSQL = `
        CREATE TABLE IF NOT EXISTS clientEmails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fio TEXT,      
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type_form TEXT,
            city TEXT,
            mark_model_year TEXT,
            credit TEXT,
            link TEXT,
            address TEXT,
            advertising BOOLEAN NOT NULL DEFAULT 1,
            concent BOOLEAN NOT NULL DEFAULT 1)
    `;

    db.run(createEmailsTableSQL, (err) => {
        if (err) {
            console.error('Error creating clientEmails table', err.message);
        } else {
            console.log('success');
        }
    });
}

function parsing(receivedData) {
    // 1. Разбиваем текст на массив строк и удаляем пустые строки
    const lines = receivedData.text.split('\n').filter(Boolean);

    // 2. Создаем объект, чтобы удобно обращаться к значениям
    const data = {};
    lines.forEach(line => {
        let [key, value] = line.split(': ');
        if (key && value) data[key.trim()] = value.trim();
    })
    data.type = receivedData.type
    return data
}

function addEmailToDatabase(receivedData) {
    let data = parsing(receivedData)

    console.log('#### data = ', data)

    let email = data['Email'] || data['email'] || '-'
    let phone = data['Телефон'] || '-'
    let fio = data['Имя']
    let credit = data['Сумма кредита']
    let type_form = TYPES[data.type]
    let city =  data['Город'] || '-'
    let mark_model_year = ((data['Марка']||'-')  + ' ' + (data['Модель']||'')  + ' ' + (data['Год']||''))
    let advertising = data['Согласие на рекламу']==='ДА'
    let concent = true
    let link = data['Ссылка'] || '-'
    let address = data['Авто адрес'] || '-'


    const db = getDB();

    // language=SQLite
    const insertEmailSQL = `
        INSERT INTO clientEmails (fio,email, phone, created_at, type_form, city, mark_model_year, credit, link, address, advertising, concent)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ? ,?, ?, ?, ?, ?)
    `;

    db.run(insertEmailSQL, [fio, email, phone, type_form, city, mark_model_year, credit, link, address, advertising, concent], function (err) {
        if (err) {
            console.error('Error adding email to database', err.message);
            const db = getDB();
            createEmailsTable(db);
        } else {
            console.log(`Email ${email} with phone ${phone} added to database`);
        }
    });
}

// New method to accept explicit parameters and store in DB
function addClientEmail(email = "", phone = "", city = "", mark_model_year = "", advertising = true, concent = true) {
    const db = getDB();

    // Ensure table exists
    createEmailsTable(db);

    // Convert boolean values to integers (SQLite BOOLEAN emulation)
    const advertisingInt = advertising ? 1 : 0;
    const concentInt = concent ? 1 : 0;

    // language=SQLite
    const insertEmailSQL = `
        INSERT INTO clientEmails (email, phone, created_at, city, mark_model_year, advertising, concent)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
    `;

    db.run(insertEmailSQL, [email, phone, city, mark_model_year, advertisingInt, concentInt], function (err) {
        if (err) {
            console.error('Error adding client email to database', err.message);
        }
    });
}

export { addEmailToDatabase, addClientEmail };
