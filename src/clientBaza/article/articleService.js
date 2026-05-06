import * as articleDAO from './articleDAO.js'

// Get all article items
function getAllArticle() {
    return new Promise((resolve, reject) => {
        articleDAO.getAllArticle((err, articleItems) => {
            if (err) {
                console.error('Error getting all article items', err);
                return reject(err);
            }
            resolve(articleItems);
        });
    });
}


// Create new article item
function createArticle(article) {
    return new Promise((resolve, reject) => {
        articleDAO.createArticle(article, (err, lastID) => {
            if (err) {
                console.error('Error creating article item', err);
                return reject(err);
            }
            resolve(lastID);
        });
    });
}

// Update article item
function updateArticle(id, article) {
    return new Promise((resolve, reject) => {
        articleDAO.updateArticle(id, article, (err, changes) => {
            if (err) {
                console.error('Error updating article item', err);
                return reject(err);
            }
            resolve(changes);
        });
    });
}

// Delete article item
function deleteArticle(id) {
    return new Promise((resolve, reject) => {
        articleDAO.deleteArticle(id, (err, changes) => {
            if (err) {
                console.error('Error deleting article item', err);
                return reject(err);
            }
            resolve(changes);
        });
    });
}

// Save article photo
function saveArticlePhoto(id, photoData) {
    return new Promise((resolve, reject) => {
        articleDAO.saveArticlePhoto(id, photoData, (err, photoUrl) => {
            if (err) {
                console.error('Error saving article photo', err);
                return reject(err);
            }
            resolve(photoUrl);
        });
    });
}

export {
    getAllArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    saveArticlePhoto
};