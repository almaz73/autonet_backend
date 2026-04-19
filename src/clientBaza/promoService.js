import * as promoDAO from './promoDAO.js'

// Get all promo items
function getAllPromo() {
    return new Promise((resolve, reject) => {
        promoDAO.getAllPromo((err, promoItems) => {
            if (err) {
                console.error('Error getting all promo items', err);
                return reject(err);
            }
            resolve(promoItems);
        });
    });
}

// Get active promo items
function getActivePromo() {
    return new Promise((resolve, reject) => {
        promoDAO.getActivePromo((err, promoItems) => {
            if (err) {
                console.error('Error getting active promo items', err);
                return reject(err);
            }
            resolve(promoItems);
        });
    });
}

// Get promo item by ID
function getPromoById(id) {
    return new Promise((resolve, reject) => {
        promoDAO.getPromoById(id, (err, promoItem) => {
            if (err) {
                console.error('Error getting promo item by ID', err);
                return reject(err);
            }
            resolve(promoItem);
        });
    });
}

// Create new promo item
function createPromo(promo) {
    return new Promise((resolve, reject) => {
        promoDAO.createPromo(promo, (err, lastID) => {
            if (err) {
                console.error('Error creating promo item', err);
                return reject(err);
            }
            resolve(lastID);
        });
    });
}

// Update promo item
function updatePromo(id, promo) {
    return new Promise((resolve, reject) => {
        promoDAO.updatePromo(id, promo, (err, changes) => {
            if (err) {
                console.error('Error updating promo item', err);
                return reject(err);
            }
            resolve(changes);
        });
    });
}

// Delete promo item
function deletePromo(id) {
    return new Promise((resolve, reject) => {
        promoDAO.deletePromo(id, (err, changes) => {
            if (err) {
                console.error('Error deleting promo item', err);
                return reject(err);
            }
            resolve(changes);
        });
    });
}

export {
    getAllPromo,
    getActivePromo,
    getPromoById,
    createPromo,
    updatePromo,
    deletePromo
};