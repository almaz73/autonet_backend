import * as promoDAO from './promoDAO.js'
import {clearPromoCache} from "./generationPagesForPromo.js";

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


// Create new promo item
function createPromo(promo) {
    return new Promise((resolve, reject) => {
        promoDAO.createPromo(promo, (err, lastID) => {
            if (err) {
                console.error('Error creating promo item', err);
                return reject(err);
            }
            clearPromoCache()
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
            clearPromoCache()
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
            clearPromoCache()
            resolve(changes);
        });
    });
}

// Save promo photo
function savePromoPhoto(id, photoData) {
    return new Promise((resolve, reject) => {
        promoDAO.savePromoPhoto(id, photoData, (err, photoUrl) => {
            if (err) {
                console.error('Error saving promo photo', err);
                return reject(err);
            }
            clearPromoCache()
            resolve(photoUrl);
        });
    });
}

export {
    getAllPromo,
    createPromo,
    updatePromo,
    deletePromo,
    savePromoPhoto
};