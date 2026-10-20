// создание client.sqlite если нет
import { Sequelize, DataTypes } from 'sequelize';
import sqlite3 from 'sqlite3';
import path from "path";
import fs from "fs";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../client.sqlite');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB_FILE,
    logging: false,
});

// Test the connection
sequelize.authenticate()
    .then(() => console.log('Database connection has been established successfully.'))
    .catch((error) => console.error('Unable to connect to the database:', error));


// Define User model if not already defined
const Admins = sequelize.define('Admins', {
    name: {type: DataTypes.STRING, required: true, unique: true},
    email: {type: DataTypes.STRING, required: true, unique: true},
    password: {type: DataTypes.STRING, required: true},
    role: {
        type: String,
        enum: ['superadmin', 'manager', 'moderator', 'promo_manager'],
        default: 'manager',
        required: true
    }
}, {
    timestamps: false
});

const clientEmails = sequelize.define('clientEmails', {
    fio: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.TEXT, allowNull: false },
    phone: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.TEXT, allowNull: false },
    type_form: { type: DataTypes.TEXT, allocdwNull: false },
    city: { type: DataTypes.TEXT, allocdwNull: false },
    credit: { type: DataTypes.TEXT, allocdwNull: false },
    link: { type: DataTypes.TEXT, allocdwNull: false },
    address: { type: DataTypes.TEXT, allocdwNull: false },
}, {
    timestamps: false
});

const promo = sequelize.define('promo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    onMain: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    description: { type: DataTypes.TEXT },
    code: { type: DataTypes.TEXT },
    photo278: { type: DataTypes.TEXT },
    photo585: { type: DataTypes.TEXT },
    photo1200: { type: DataTypes.TEXT },
    styles: { type: DataTypes.TEXT },
}, {
    tableName: 'promo',
    timestamps: false,
});

// Define User model if not already defined
const history_period = sequelize.define('Сколько дней висело', {
    startedDate: { type: DataTypes.TEXT, allowNull: false },
    endDate: { type: DataTypes.TEXT, allowNull: false },
    car: { type: DataTypes.TEXT, allowNull: false },
    days: { type: DataTypes.INTEGER, allowNull: false },
    id: {type: DataTypes.INTEGER, primaryKey: true, allowNull: false},
}, {
    tableName: 'history_period',
    timestamps: false,
});

// Passenger загружает ESM через require(), поэтому top-level await здесь нельзя
sequelize.sync() // This will create tables if they don't exist
    .then(async () => {
        // Дефолтный суперадмин при первом запуске (если таблица Admins пуста)
        if (await Admins.count() === 0) {
            await Admins.create({
                name: 'Superadmin',
                email: 'admin@autonet.ru',
                password: 'Autonet_2026_this_parole_will_be_never_used',
                role: 'superadmin',
            });
            console.log('Создан администратор по умолчанию: admin@autonet.ru / Autonet_2026');
        }
    })
    .catch((error) => console.error('Error creating tables or default admin:', error));

// Create database connection
export function getDB() {
    const dbExists = fs.existsSync(DB_FILE);
    const db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
            return;
        }
        // console.log(`Connected to database at ${DB_FILE}`);
    });
    createTables(db);
    if (!dbExists) createTables(db);

    return db;
}

// Create tables
function createTables(db) {
    // language=SQLite
    const createPromoTable = `
        CREATE TABLE IF NOT EXISTS promo
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            onMain      BOOLEAN NOT NULL DEFAULT 1,
            priority    INTEGER NOT NULL DEFAULT 0,
            active      BOOLEAN NOT NULL DEFAULT 1,
            description TEXT,
            code        TEXT,
            photo278    TEXT,
            photo585    TEXT,
            photo1200   TEXT,
            styles      TEXT
        )
    `;

    // Добавляем колонку 'age' с типом INTEGER, которая по умолчанию будет равна 0
    const sql = `ALTER TABLE promo ADD COLUMN styles INTEGER DEFAULT ""`;
    db.run(sql, (err) => {
        if (err) {
            console.error('Ошибка при добавлении колонки:', err.message);
        } else {
            console.log('Новая колонка успешно добавлена!');
        }
    });

    db.run(createPromoTable, (err) => {
        if (err) console.error('Error creating promo table', err.message);
        else console.log('created successfully');
    });


    // language=SQLite
    const createArticleTable = `
        CREATE TABLE IF NOT EXISTS article
        (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            onMain       BOOLEAN NOT NULL DEFAULT 1,
            priority     INTEGER NOT NULL DEFAULT 0,
            active       BOOLEAN NOT NULL DEFAULT 1,
            data         TEXT,
            code         TEXT,
            shortContent TEXT,
            content      TEXT,
            photo        TEXT
        )
    `;

    db.run(createArticleTable, (err) => {
        if (err) console.error('Error creating promo table', err.message);
        else console.log('Promo table created successfully');
    });
}

export { sequelize, Admins, history_period, clientEmails, promo };