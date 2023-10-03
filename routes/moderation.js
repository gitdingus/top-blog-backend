const moderationRouter = require('express').Router();
const moderationController = require('../controllers/moderationController.js');

moderationRouter.post('/content', moderationController.api_post_moderate_content);
moderationRouter.get('/users', moderationController.api_get_users);
moderationRouter.post('/users/:userId', moderationController.api_post_moderate_user);
moderationRouter.get('/:contentType/:contentId', moderationController.get_content);

module.exports = moderationRouter;
