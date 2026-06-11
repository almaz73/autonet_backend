import* as articleDAO from './bdDAO.js'

// Get all article items withoptional pagination and city filter
function getAll_bd(page = 1, pageSize = 10, city = null) {
    return new Promise((resolve, reject) => {
        articleDAO.getAllbd((err, bdItems) => {
            if (err) {
                console.error('Error getting all article items',err);
                return reject(err);
            }
            resolve(bdItems);
        },page, pageSize, city);
    });
}


export {
    getAll_bd,
};