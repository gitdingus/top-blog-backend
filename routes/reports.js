const reportsRouter = require('express').Router();
const reportsController = require('../controllers/reportsController.js');

reportsRouter.post('/', reportsController.api_post_reports);
reportsRouter.get('/', reportsController.api_get_reports);

module.exports = reportsRouter;