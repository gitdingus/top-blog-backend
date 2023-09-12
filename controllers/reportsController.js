const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { body, param, validationResult } = require('express-validator');
const express = require('express');
const Report = require('../models/report.js');

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next(createError(401, "Unauthorized"));
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
  body('reportingUser', 'Must provide id of reporting user')
    .isMongoId(),
  body('reason', 'Must include a reason')
    .isLength({ min: 1, max: 200 }),
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
      reason: req.body.reason,
      reportCreated: new Date(),
    });

    await newReport.save();
    res.status(204).json({ msg: "api_post_reports: Not implemented"});
  }),
];

exports.api_get_reports = [
  asyncHandler(async (req, res, next) => {
    res.status(200).json({ msg: "api_get_reports: Not implemented"});
  }),
];