// Replace the old Mongoose model with SQLite operations

class PostModel {
    static async create(postData) {
        const { author, title, content, picture } = postData;
        const result = await global.db.run(
            'INSERT INTO posts (author, title, content, picture) VALUES (?, ?, ?, ?)',
            [author, title, content, picture]
        );
        return { id: result.lastID, ...postData };
    }

    static async find() {
        return await global.db.all('SELECT * FROM posts');
    }

    static async findById(id) {
        return await global.db.get('SELECT * FROM posts WHERE id = ?', [id]);
    }

    static async findByIdAndUpdate(id, updateData) {
        const { author, title, content, picture } = updateData;
        await global.db.run(
            'UPDATE posts SET author = ?, title = ?, content = ?, picture = ? WHERE id = ?',
            [author, title, content, picture, id]
        );
        return await this.findById(id);
    }

    static async findByIdAndDelete(id) {
        const post = await this.findById(id);
        await global.db.run('DELETE FROM posts WHERE id = ?', [id]);
        return post;
    }
}

export default PostModel;
