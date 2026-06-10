import * as articleDAO from './bdDAO.js'

// Get all article items
function getAll_bd() {
    return new Promise((resolve, reject) => {
        articleDAO.getAllbd((err, bdItems) => {
            if (err) {
                console.error('Error getting all article items', err);
                return reject(err);
            }
            resolve(bdItems);
        });
    });
}


export {
    getAll_bd,
};