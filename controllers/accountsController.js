const express = require('express');
const passport = require('passport');
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const User = require('../models/user.js');
const Category = require('../models/category.js');
const Blog = require('../models/blog.js');
const BlogPost = require('../models/blogPost.js');
const { generateSaltHash, validPassword, passwordConfig } = require('../utils/passwordUtils.js');

const isLoggedInUser = (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user._id.toString() !== req.params.userId) {
      return next(createError(403, 'Forbidden'));
    }
  } else {
    return next(createError(401, 'Unauthorized'));
  }

  next();
}

const isBloggerInGoodStanding = asyncHandler(async(req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user.accountType !== 'Blogger' || req.user.status !== 'Good') {
      return next(createError(403, 'Forbidden'));
    }

  } else {
    return next(createError(401, 'Unauthorized'));
  }

  next();
});

exports.api_post_create_account = [
  express.json(),
  express.urlencoded({ extended: false }),
  body('username', 'Must supply a username')
    .trim()
    .toLowerCase()
    .isLength({ min: 1 })
    .bail()
    .escape()
    .custom(async (username) => {
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
    .bail()
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
  /*
      Keep at end due to bail conditions

      Don't report any errors for confirm_password field 
      if there are any problems with the password
  */
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
    .bail({ level: 'request' })
    .isStrongPassword(passwordConfig)
    .withMessage('Password is not strong enough')
    .bail({ level: 'request' }),
  body('confirm_password')
    .if((value, { req }) => req.body.password)
    .isLength({ min: 1 })
    .withMessage('Must confirm password')
    .bail()
    .custom((value, { req }) => {
      return value === req.body.password;
    })
    .withMessage('Passwords do not match'),
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
    const user = await User.findOne({ username: req.params.username }, { salt: 0, hash: 0, __v: 0 }).exec();

    if (user === null) {
      return next(createError(404, 'User not found'));
    }

    const userObj = user.toObject();
    /*
        For logged in requests: Only admins and user has access to all
        their data if account is public
        If request is not authenticated automatically restrict user information
    */ 

    if (req.isAuthenticated()) {
      if (!(req.user.accountType === 'Admin' 
        || req.user.username === req.params.username)) {
          userObj._id = undefined; // Should never be sent even if queried user is public
          if (!userObj.public) {
            restrictAccessTo(userObj);
          }
      }
    } else {
      userObj._id = undefined; // Never send to unauthenticated users
      restrictAccessTo(userObj);
    }

    res
      .status(200)
      .json({ user: userObj });
  }),
];

exports.api_post_update_profile = [
  isLoggedInUser,
  express.json(),
  express.urlencoded({ extended: false }),
  body('first_name')
    .if((value, { req }) => req.body.first_name !== undefined)
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name must be at least 1 character')
    .escape(),
  body('last_name')
    .if((value, { req }) => req.body.last_name !== undefined)
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name must be at least 1 character')
    .escape(),
  body('email')
    .if((value, { req }) => req.body.email !== undefined)
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Please input a valid email address')
    .bail()
    .escape()
    .custom(async (email, { req }) => {
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
    const user = User.findById(req.params.userId).exec();
    const updatedInfo = {};

    if (req.body.first_name) {
      updatedInfo.firstName = req.body.first_name;
    }

    if (req.body.last_name) {
      updatedInfo.lastName = req.body.last_name;
    }

    if (req.body.email) {
      updatedInfo.email = req.body.email;
    }

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
          userInfo: updatedInfo, 
        });

      return;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.userId, updatedInfo, { returnDocument: 'after' });

    //DO NOT SEND SALT OR HASH TO CLIENT
    updatedUser.salt = undefined;
    updatedUser.hash = undefined;

    // Remove this for easier testing
    updatedUser.__v = undefined; 

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
  body('old_password')
    .notEmpty().bail({ level: 'request' }).withMessage('Must enter old password')
    .custom(async (oldPassword, { req }) => {
      const user = await User.findById(req.params.userId, 'salt hash').exec();

      if (!validPassword(oldPassword, user.salt, user.hash)) {
        throw new Error('Incorrect password');
      }

      return true;
    }).bail({ level: 'request' }),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Must enter new password')
    .bail({ level: 'request' })
    .isStrongPassword(passwordConfig)
    .withMessage('New password is not strong enough')
    .bail({ level: 'request' }),
  body('confirm_password')
    .if((value, { req }) => req.body.password)
    .isLength({ min: 1 })
    .withMessage('Must confirm password')
    .bail()
    .custom((value, { req }) => {
      return value === req.body.password;
    })
    .withMessage('Passwords do not match'),
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.userId, 'salt hash').exec();
    const errors = validationResult(req);

    // Shouldn't happen due to isLoggedInUser?
    if (user === null) {
      return next(createError(404, 'User not found'));
    }

    if (!errors.isEmpty()) {
      res.status(400)
        .json({ errors: errors.array() });
      return;
    }

    const { salt, hash } = generateSaltHash(req.body.password);

    user.salt = salt;
    user.hash = hash;

    await user.save();

    res.status(204).end();
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
    const user = await User.findById(req.params.userId).exec();

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

exports.api_post_create_blog = [
  isLoggedInUser,
  isBloggerInGoodStanding,
  express.json(),
  express.urlencoded({ extended: false }),
  body('name', 'Blog name must be between 1 and 50 characters')
    .trim()
    .isLength({ min: 1, max: 50 })
    .escape(),
  body('description', 'Blog description must be between 1 and 500 characters')
    .trim()
    .isLength({ min: 1, max: 500 })
    .escape(),
  body('category', 'Invalid Category Id')
    .isMongoId()
    .custom(async (val) => {
      const category = await Category.findById(val);

      if (category === null) {
        throw new Error('Category not found');
      }

      return true;
    })
    .withMessage('Category not found'),
  // created gets set before making call to save document
  asyncHandler(async(req, res, next) => {
    const errors = validationResult(req);
    const blog = new Blog({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
    });

    if (!errors.isEmpty()) {
      res.status(400)
        .json({
          errors: errors.array(),
          blog,
        });

      return;
    }

    blog.owner = req.params.userId,
    blog.created = new Date();

    const newBlog = await blog.save();

    res.status(200)
      .json({ 
        msg: 'Successful', 
        blog: newBlog,
      });
  }),
];

/* Has params userId and blogId */
exports.api_post_create_blogpost = [
  isLoggedInUser,
  isBloggerInGoodStanding,
  express.json(),
  express.urlencoded({ extended: false }),
  body('title', 'Title must be between 1 and 50 characters')
    .trim()
    .isLength({ min: 1, max: 50 })
    .escape(),
  body('content', 'Blog post must contain content')
    .trim()
    .isLength({ min: 1 })
    .escape(),
  asyncHandler(async(req, res, next) => {
    const errors = validationResult(req).array();
    const blog = await Blog.findById(req.params.blogId);

    const blogPost = new BlogPost({
      title: req.body.title,
      content: req.body.content,
    });

    if (blog === null) {
      errors.push({ msg: 'Blog does not exist' });
    }

    if (errors.length > 0) { 
      res.status(400)
        .json({
          errors,
          blogPost,
        });
      return;
    }

    blogPost.blog = req.params.blogId;
    blogPost.author = req.params.userId;
    blogPost.created = new Date();

    const newPost = await blogPost.save();

    res.status(200).json({ 
      msg: 'Successful',
      newPost,
    });
  }),
];

exports.api_get_list_blogs = [
  isLoggedInUser,
  asyncHandler(async(req, res, next) => {
    const blogs = await Blog.find({ owner: req.params.userId }).exec();

    res.status(200)
      .json({ blogs });
  }),
];

exports.api_get_blogs_posts = [
  isLoggedInUser,
  asyncHandler(async(req, res, next) => {
    const posts = await BlogPost.find({ blog: req.params.blogId }).exec();

    res.status(200)
      .json({ posts });
  }),
];

exports.api_get_blog_posts = [
  isLoggedInUser,
  asyncHandler(async(req, res, next) => {
    const posts = await BlogPost.find({ }).exec();

    res.status(200)
      .json({ posts });
  }),
]; 