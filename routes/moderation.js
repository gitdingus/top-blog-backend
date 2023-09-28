const moderationRouter = require('express').Router();
const moderationController = require('../controllers/moderationController.js');

moderationRouter.get('/:contentType/:contentId', moderationController.get_content);
moderationRouter.post('/content', moderationController.api_post_moderate_content);
module.exports = moderationRouter;