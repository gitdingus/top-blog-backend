const express = require('express');
const accountsController = require('../controllers/accountsController.js');

const accountsRouter = express.Router();

accountsRouter.post('/api/create-account', accountsController.api_post_create_account);
accountsRouter.post('/api/login', accountsController.api_post_login);
accountsRouter.post('/api/logout', accountsController.api_post_logout);

accountsRouter.get('/api/profile/:username', accountsController.api_get_user_profile);

module.exports = accountsRouter;