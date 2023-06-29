const express = require('express');
const accountsController = require('../controllers/accountsController.js');

const accountsRouter = express.Router();

// Account creation and authentication
accountsRouter.post('/api/create-account', accountsController.api_post_create_account);
accountsRouter.post('/api/login', accountsController.api_post_login);
accountsRouter.post('/api/logout', accountsController.api_post_logout);

// User profile
accountsRouter.get('/api/users/:username', accountsController.api_get_user_profile);

// Update account information
accountsRouter.post('/api/users/:id/update', accountsController.api_post_update_profile);
accountsRouter.post('/api/users/:id/change-password', accountsController.api_post_change_password);
accountsRouter.post('/api/users/:id/update-settings', accountsController.api_post_update_settings);

// Creating blogs and blog posts
accountsRouter.post('/api/users/:userId/blogs/create-blog', accountsController.api_post_create_blog);
accountsRouter.post('/api/users/:userId/blogs/:blogId/create-post', accountsController.api_post_create_blogpost);
accountsRouter.get('/api/users/:userId/blogs', accountsController.api_post_list_blogs);

module.exports = accountsRouter;