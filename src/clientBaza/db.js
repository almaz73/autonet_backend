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
try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
} catch (error) {
    console.error('Unable to connect to the database:', error);
}


// Define User model if not already defined
const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
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

// Create tables
try {
    await sequelize.sync(); // This will create tables if they don't exist
} catch (error) {
    console.error('Error creating tables:', error);
}

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

export { sequelize, User, history_period, clientEmails };