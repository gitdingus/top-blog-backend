const express = require('express');
const accountsController = require('../controllers/accountsController.js');

const accountsRouter = express.Router();

accountsRouter.post('/create-account', accountsController.post_create_account);

module.exports = accountsRouter;