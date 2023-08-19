const express = require('express');
const blogsController = require('../controllers/blogsController.js');

const blogsRouter = express.Router();

// Public Category Information
blogsRouter.get('/api/blogs/categories', blogsController.api_get_category_list);
blogsRouter.get('/api/blogs/categories/:categoryId', blogsController.api_get_category_details);

// Public Author Information
blogsRouter.get('/api/blogs/authors', blogsController.api_get_authors_list);
blogsRouter.get('/api/blogs/authors/:username', blogsController.api_get_author_details);

// NO TESTS YET
blogsRouter.get('/api/blogs/', blogsController.api_get_blogs);

//Tested, has to show up at bottom
// Get blog information
blogsRouter.get('/api/blogs/:blogName', blogsController.api_get_blog_details);
blogsRouter.get('/api/blogs/:blogName/posts', blogsController.api_get_blog_posts);

module.exports = blogsRouter;