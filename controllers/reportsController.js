const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { body, query, validationResult } = require('express-validator');
const express = require('express');
const Report = require('../models/report.js');

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next(createError(401, 'Unauthorized'));
  }

  next();
}

const isAdminOrModerator = (req, res, next) => {
  const allowedTypes = ['Admin', 'Moderator'];

  if (!req.isAuthenticated()) {
    return next(createError(401, 'Unauthorized'));
  }

  if (!allowedTypes.includes(req.user.accountType)) {
    return next(createError(403, 'Forbidden'));
  }

  next();
}
exports.api_post_reports = [
  isLoggedIn,
  express.json(),
  express.urlencoded({ extended: false }),
  body('contentType', 'Must be "Comment" or "BlogPost"')
    .custom((val) => {
      return ["Comment", "BlogPost"].includes(val);
  }),
  body('contentId', 'Must provide content id')
    .isMongoId(),
  body('reason', 'Must include a reason')
    .isLength({ min: 1, max: 200 })
    .escape(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        errors: errors.array(),
      });
      return;
    }

    const newReport = new Report({
      contentType: req.body.contentType,
      contentId: req.body.contentId,
      reportingUser: req.body.reportingUser,
      reportedUser: req.body.reportedUser,
      reason: req.body.reason,
      reportCreated: new Date(),
    });

    await newReport.save();
    res.status(204).json({ msg: "api_post_reports: Not implemented"});
  }),
];

exports.api_get_reports = [
  isAdminOrModerator,
  query('settled', 'Settled must be boolean value')
    .optional()
    .isBoolean({ strict: true }),
  query('contentType', 'Content type must be "comment" or "blogpost"')
    .optional()
    .custom((val) => {
      const contentTypes = ['comment', 'blogpost'];

      return contentTypes.includes(val.toLower());
    }),
  query('contentId')
    .optional()
    .isMongoId()
    .withMessage('contentId must be valid mongoId')
    .custom((val, { req }) => {
      return req.query.contentType !== undefined;
    })
    .withMessage('Must specify contentType if using contentId'),
  query('reportedUser')
    .optional(),
  query('reportingUser')
    .optional(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if(!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const matchObj = {};

    if (req.query.settled !== undefined) {
      matchObj.settled = req.query.settled;
    }

    if (req.query.contentType !== undefined) {
      matchObj.contentType = req.query.contentType;
    }

    if (req.query.contentId !== undefined) {
      matchObj.contentId = req.query.contentId;
    }

    if (req.query.reportedUser !== undefined) {
      matchObj.reportedUser = req.query.reportedUser;
    }

    if (req.query.reportingUser !== undefined) {
      matchObj.reportingUser = req.query.reportingUser;
    }

    const reports = await Report.find( matchObj ).exec();

    res.status(200).json(reports);
  }),
];