import {getAllhistory, getHistoryPeriod, getHistoryPeriodDays} from './historyDAO.js'

function getAll_history(page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
        getAllhistory((err, data) => {
            if (err) {
                console.error('Error getting article items', err);
                return reject(err);
            }
            resolve({
                items: data.items,
                total: data.total,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(data.total / pageSize)
            });
        }, page, pageSize);
    });
}

function get_history_period(page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
        getHistoryPeriod((err, data) => {
            if (err) {
                console.error('Error getting article items', err);
                return reject(err);
            }
            resolve({
                items: data.items,
                total: data.total,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(data.total / pageSize)
            });
        }, page, pageSize);
    });
}

function get_history_period_days(page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
        
        console.log('pageSize = ',pageSize)
        
        getHistoryPeriodDays((err, data) => {
            console.log('data total = ',data.total)
            if (err) {
                console.error('Error getting article items', err);
                return reject(err);
            }
            resolve({
                items: data.items,
                total: data.total,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(data.total / pageSize)
            });
        }, page, pageSize);
    });
}


export {
    getAll_history,
    get_history_period,
    get_history_period_days
};