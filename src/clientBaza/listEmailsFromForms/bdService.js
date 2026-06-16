import* as bdDAO from './bdDAO.js'

// Get all article items withoptional pagination and city filter
function getAll_bd(page = 1, pageSize = 10, city = null) {
    return new Promise((resolve, reject) => {
        bdDAO.getAllbd((err, data) => {
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
        }, page, pageSize, city);
    });
}


export {
    getAll_bd,
};