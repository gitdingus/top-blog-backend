const express = require('express');
const accountsController = require('../controllers/accountsController.js');

const accountsRouter = express.Router();

// Get currently logged in user
accountsRouter.get('/api/current-user', accountsController.api_get_current_user);

// Account creation and authentication
accountsRouter.post('/api/create-account', accountsController.api_post_create_account);
accountsRouter.post('/api/login', accountsController.api_post_login);
accountsRouter.post('/api/logout', accountsController.api_post_logout);

// User profile
accountsRouter.get('/api/users/:username', accountsController.api_get_user_profile);

// Update account information
accountsRouter.post('/api/users/:userId/update', accountsController.api_post_update_profile);
accountsRouter.post('/api/users/:userId/change-password', accountsController.api_post_change_password);
accountsRouter.post('/api/users/:userId/update-settings', accountsController.api_post_update_settings);

// Creating blogs and blog posts
accountsRouter.post('/api/users/:userId/blogs/create-blog', accountsController.api_post_create_blog);
accountsRouter.post('/api/users/:userId/blogs/:blogId/create-post', accountsController.api_post_create_blogpost);

// Viewing a users blogs and blogposts
// Routes for a user to view their own information
accountsRouter.get('/api/users/:userId/blogs', accountsController.api_get_blogs_list);
accountsRouter.get('/api/users/:userId/blogs/:blogId/posts', accountsController.api_get_blogs_posts);
accountsRouter.get('/api/users/:userId/blog-posts', accountsController.api_get_blog_posts);

// NO TESTS YET

accountsRouter.get('/api/users/:userId/blogs/:blogId/', accountsController.api_get_blog_details);
accountsRouter.get('/api/users/:userId/blog-posts/:blogPostId', accountsController.api_get_blogpost);
accountsRouter.post('/api/users/:userId/blogs/:blogId/edit', accountsController.api_post_edit_blog);
accountsRouter.post('/api/users/:userId/blogs/post/:postId/create-comment', accountsController.api_post_comment);
accountsRouter.delete('/api/users/:userId/blogs/:blogId/', accountsController.api_delete_blog);
accountsRouter.delete('/api/users/:userId/blog-posts/:blogPostId', accountsController.api_delete_blogpost);

module.exports = accountsRouter;