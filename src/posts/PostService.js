import Post from "./Post.js";
import XmlImportService from "../xml_import/xmlImportService.js";

class PostService {
    async create(post, picture) {
        const fileName = picture ? this.fileService.saveFile(picture) : null;
        return await Post.create({...post, picture: fileName});;
    }

    async getAll() {
        return await Post.find();
    }

    async importXML() {
        return await XmlImportService.importXmlData();
    }
    
    async getOne(id) {
        if (!id) {
            throw new Error('не указан ID')
        }
        return await Post.findById(id);
    }

    async update(post) {
        if (!post.id) {
            throw new Error('не указан ID')
        }
        return await Post.findByIdAndUpdate(post.id, post);
    }

    async delete(id) {
        if (!id) {
            throw new Error('не указан ID')
        }
        return await Post.findByIdAndDelete(id);
    }
    
    // Add file service as dependency
    setFileService(service) {
        this.fileService = service;
    }
}


const postService = new PostService();

// Import file service after creation to avoid circular dependency
import fileService from "../photo_files/fileService.js";
postService.setFileService(fileService);

export default postService;
