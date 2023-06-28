const express = require('express');
const accountsController = require('../controllers/accountsController.js');

const accountsRouter = express.Router();

accountsRouter.post('/api/create-account', accountsController.api_post_create_account);
accountsRouter.post('/api/login', accountsController.api_post_login);

module.exports = accountsRouter;