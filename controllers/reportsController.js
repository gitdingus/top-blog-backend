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

const convertFieldsToArray = (req, res, next) => {
  const fields = ['contentType', 'settled', 'actionTaken'];

  fields.forEach((field) => {
    if (req.query[field] === undefined) {
      return;
    }
    else if (!Array.isArray(req.query[field])) {
      req.query[field] = [ req.query[field] ];
    }
  });

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
  body('reportingUser')
    .custom(async (val, { req }) => {
      const report = await Report.find({ contentId: req.body.contentId, reportingUser: req.body.reportingUser }).exec();

      if (report.length > 0) {
        throw new Error('We have already received your report');
      }
    }),
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
  convertFieldsToArray,
  query('settled', 'Settled must be boolean value')
    .optional(),
  query('contentType', 'Content type must be "Comment" or "BlogPost"')
    .optional(),
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
    console.log(req.query);
    
    if (req.query.skip === undefined) {
      
    }
    if (req.query.settled !== undefined) {
      let settledArray = [];
      if (req.query.settled.includes('true')) {
        settledArray.push({ settled: true });
      }
      if (req.query.settled.includes('false')) {
        settledArray.push({ settled: { $ne: true }});
        settledArray.push({ settled: false });
      }
      matchObj.$or = settledArray;
    }

    if (req.query.contentType !== undefined) {
      matchObj.contentType = { $in: req.query.contentType };
    }

    if (req.query.actionTaken !== undefined) {
      matchObj.actionTaken = { $in: req.query.actionTaken };
    }

    if (req.query.reportedUser !== undefined) {
      matchObj.reportedUser = req.query.reportedUser;
    }

    if (req.query.reportingUser !== undefined) {
      matchObj.reportingUser = req.query.reportingUser;
    }

    if (req.query.respondingModerator !== undefined) {
      matchObj.respondingModerator = req.query.respondingModerator;
    }

    if (req.query.reportedAfter !== undefined) {
      if (matchObj.reportCreated === undefined) {
        matchObj.reportCreated = {};
      }
      matchObj.reportCreated.$gte = new Date(req.query.reportedAfter);
    }

    if (req.query.reportedBefore !== undefined) {
      if (matchObj.reportCreated === undefined) {
        matchObj.reportCreated = {};
      }
      matchObj.reportCreated.$lte = new Date(req.query.reportedBefore);
    }

    if (req.query.respondedAfter !== undefined) {
      if (matchObj.dateOfAction === undefined) {
        matchObj.dateOfAction = {};
      }
      matchObj.dateOfAction.$gte = new Date(req.query.respondedAfter);
    }

    if (req.query.respondedBefore !== undefined) {
      if (matchObj.dateOfAction === undefined) {
        matchObj.dateOfAction = {};
      }
      matchObj.dateOfAction.$lte = new Date(req.query.respondedBefore);
    }

    const LIMIT = 20;
    let skip = 0;
    
    if (req.query.page !== undefined) {
      skip = Number.parseInt(req.query.page) * LIMIT;
    }

    const reports = await Report
    .find(matchObj)
    .skip(skip)
    .limit(LIMIT)
    .exec();
    
    res.status(200).json(reports);
  }),
];

exports.api_get_report = [
  isAdminOrModerator,
  asyncHandler(async (req, res, next) => {
    const report = await Report.findById(req.params.reportId);

    if (report === null) {
      res.status(404).json({ msg: 'Report not found' });
    }

    res.status(200).json({ report });
  }),
]