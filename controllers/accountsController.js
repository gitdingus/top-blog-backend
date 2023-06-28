const express = require('express');
const passport = require('passport');
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const User = require('../models/user.js');
const { generateSaltHash, validPassword, passwordConfig } = require('../utils/passwordUtils.js');

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



