const express = require('express');
const passport = require('passport');
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const User = require('../models/user.js');
const { generateSaltHash, validPassword, passwordConfig } = require('../utils/passwordUtils.js');

const isLoggedInUser = (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user._id.toString() !== req.params.id) {
      return next(createError(403, 'Forbidden'));
    }
  } else {
    return next(createError(401, 'Unauthorized'));
  }

  next();
}

exports.api_post_create_account = [
  express.json(),
  express.urlencoded({ extended: false }),
  body('username', 'Must supply a username')
    .trim()
    .isLength({ min: 1 })
    .escape()
    .custom(async (value) => {
      const username = value.toLowerCase();
      const user = await User.findOne({ username });

      if (user !== null) {
        throw new Error('Username already exists');
      }

      return true;
    }),
  body('first_name', 'First name is a required field')
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body('last_name', 'Last name is a required field')
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body('email', 'Must provide a valid email address')
    .trim()
    .isEmail()
    .escape()
    .custom(async (value) => {
      const email = value.toLowerCase();
      const user = await User.findOne({ email });

      if (user !== null) {
        throw new Error('Account with this email already exists');
      }

      return true;
    }),
  body('account_type', 'Unrecognized account type')
    .custom((value) => {
      const validAccountTypesAtCreation = [ 'Commenter', 'Blogger' ];

      return validAccountTypesAtCreation.includes(value);
    }),
  body('password', 'Password is not strong enough')
    .isStrongPassword(passwordConfig),
  body('confirm_password', 'Passwords do not match')
    .custom((value, { req }) => {
      return value === req.body.password;
    }),
  // fields status and public assigned during creation
  asyncHandler(async (req, res, next) => {
    const newAccount = new User({
      username: req.body.username,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email,
      accountType: req.body.account_type,
    });
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log('returning errors');
      res
        .status(400)
        .json({
          errors: errors.array(),
          user: newAccount.toObject(),
        });
      return;
    }

    /*
      New Account has all required information from user

      Add default status value of 'Good' and public value 
      of 'false' before creating.

      Generate salt and hash for password before saving
      to database

      Generate timestamp for account creation
    */

    const { salt, hash } = generateSaltHash(req.body.password);

    newAccount.salt = salt;
    newAccount.hash = hash;
    newAccount.status = 'Good';
    newAccount.public = false;
    newAccount.accountCreated = Date.now();

    await newAccount.save();

    res
      .status(201)
      .json( { msg: 'Account Created' });
  }),
];

exports.api_post_login = [
  express.json(),
  express.urlencoded({ extended: false }),
  passport.authenticate('local'),
  (req, res, next) => {
    res
      .status(200)
      .json({ msg: 'Successful' });
  }
];

exports.api_post_logout = asyncHandler(async (req, res, next) => {
  req.logout(function (err) {
    if (err) { return next(err) }

    res
      .status(200)
      .json({ msg: 'Successful' });
  });
});

exports.api_get_user_profile = [
  asyncHandler(async (req, res, next) => {
    const restrictAccessTo = (user) => {
      const privateFields = [ 'firstName', 'lastName', 'email' ];

      privateFields.forEach((field) => {
        user[field] = undefined;
      });
    }
    const user = await User.findOne({ username: req.params.username }, { salt: 0, hash: 0 }).exec();
    
    if (user === null) {
      return next(createError('404', 'User not found'));
    }

    /*
        For logged in requests: Only admins and user has access to all
        their data if account is public
        If request is not authenticated automatically restrict user information
    */ 

    if (req.isAuthenticated()) {
      if (!(req.user.accountType === 'admin' 
        || req.user.username === req.params.username)) {
          user._id = undefined; // Should never be sent even if queried user is public
          if (!user.public) {
            restrictAccessTo(user);
          }
      }
    } else {
      user._id = undefined; // Never send to unauthenticated users
      restrictAccessTo(user);
    }

    res
      .status(200)
      .json({ user: user.toObject() });
  }),
];

exports.api_post_update_profile = [
  isLoggedInUser,
  express.json(),
  express.urlencoded({ extended: false }),
  body('first_name', 'First name is a required field')
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body('last_name', 'Last name is a required field')
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body('email', 'Must provide a valid email address')
    .trim()
    .isEmail()
    .escape()
    .custom(async (value, { req }) => {
      const email = value.toLowerCase();
      const user = await User.findOne({ email });

      if (user === null) {
        return true;
      }

      // Make sure a different user is not already using the email address
      if (user._id !== req.user._id) {
        throw new Error('Account with this email already exists');
      }

      return true;
    }),
  asyncHandler(async (req,res,next) => {
    const errors = validationResult(req);
    const user = User.findById(req.params.id).exec();
    const userInfo = {
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email,
    };

    if (user === null) {
      res.status(404)
        .json({
          msg: 'User not found',
        });
    }
    if (!errors.isEmpty()) {
      res
        .status(400)
        .json({ 
          errors: errors.array(),
          userInfo, 
        });

      return;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, userInfo, { returnDocument: 'after' });

    res
      .status(200)
      .json({ 
        msg: 'Successful', 
        user: updatedUser,
      });
  }),
];

exports.api_post_change_password = [
  isLoggedInUser,
  express.json(),
  express.urlencoded({ extended: false }),
  body('password', 'Password is not strong enough')
    .isStrongPassword(passwordConfig),
  body('confirm_password', 'Passwords do not match')
    .custom((value, { req }) => {
      return value === req.body.password;
    }),
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id, 'salt hash').exec();
    const errors = validationResult(req).array();

    if (user === null) {
      return next(createError(404, 'User not found'));
    }

    if (!req.body.old_password || !validPassword(req.body.old_password, user.salt, user.hash)) {
      errors.push( { msg: 'Invalid password' });
    }

    if (errors.length > 0) {
      res.status(400)
        .json({ errors: errors });
      return;
    }

    const { salt, hash } = generateSaltHash(req.body.password);

    user.salt = salt;
    user.hash = hash;

    await user.save();

    res.status(200)
      .json({ msg: 'Successful' });
  }),
]

exports.api_post_update_settings = [
  isLoggedInUser,
  express.json(),
  express.urlencoded({ extended: false }),
  body('public', 'Public must be a boolean value')
    .isBoolean(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    const user = await User.findById(req.params.id).exec();

    if (!errors.isEmpty()) {
      res.status(400)
        .json({ errors: errors.array() });
    }
    user.public = req.body.public;
    await user.save();

    res.status(200)
      .json({ msg: 'Successful' });
  }),
];