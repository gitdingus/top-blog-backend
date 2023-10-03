const express = require('express');
const asyncHandler = require('express-async-handler');
const { query, body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const createError = require('http-errors');
const Blog = require('../models/blog.js');
const BlogPost = require('../models/blogPost.js');
const Comment = require('../models/comment.js');
const Report = require('../models/report.js');
const User = require('../models/user.js');

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

// params contentType, contentId
exports.get_content = [
  isAdminOrModerator,
  asyncHandler(async (req, res, next) => {
    const { contentType, contentId } = req.params;
    let content; 
    if (contentType === 'BlogPost') {
      content = await BlogPost.findById(contentId).exec();
    } else if (contentType === 'Comment') {
      content = await Comment.findById(contentId).exec();
    }

    if (content === null) {
      res.status(404).json({ msg: 'Content not found' });
      return;
    }

    res.status(200).json({ contentType, content });
    return;
  }),
];

exports.api_get_users = [
  isAdminOrModerator,
  express.json(),
  express.urlencoded({ extended: false }),
  query('page', 'Page must be an integer value')
    .optional()
    .isInt({ min: 0 }),
  query('username')
    .optional(),
  query('first_name')
    .optional(),
  query('last_name')
    .optional(),
  query('email', 'Email address is invalid')
    .optional()
    .isEmail(),
  query('status')
    .optional(),
  query('account_type')
    .optional(),
  query('created_after')
    .optional()
    .isDate(),
  query('created_before')
    .optional()
    .isDate(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }

    const matchObj = {};
    const LIMIT = 20;
    let skip = 0;

    if (req.query.page !== undefined) {
      skip = Number.parseInt(req.query.page) * LIMIT;
    }

    if (req.query.username !== undefined) {
      matchObj.username = req.query.username;
    }

    if (req.query.first_name !== undefined) {
      matchObj.firstName = req.query.first_name;
    }

    if (req.query.last_name !== undefined) {
      matchObj.lastName = req.query.last_name;
    }

    if (req.query.email !== undefined) {
      matchObj.email = req.query.email;
    }

    if (req.query.status !== undefined) {
      matchObj.status = req.query.status;
    }

    if (req.query.account_type !== undefined) {
      matchObj.accountType = req.query.account_type;
    }

    if (req.query.created_after !== undefined) {
      matchObj.created.$gte = new Date(req.query.created_after);
    }

    if (req.query.created_before !== undefined) {
      matchObj.created.$lte = new Date(req.query.created_before);
    }

    const users = await User
      .find(matchObj)
      .skip(skip)
      .limit(LIMIT)
      .exec();

    users.forEach((user) => {
      user.salt = undefined;
      user.hash = undefined;

      if (req.user.accountType !== 'Admin' && user.public !== true) {
        user.firstName = undefined;
        user.lastName = undefined;
        user.email = undefined;
      }
    })

    res.status(200).json( users );
  }),
];

exports.api_post_moderate_content = [
  isAdminOrModerator,
  express.json(),
  express.urlencoded({ extended: true }),
  body('reportId')
    .isMongoId(),
  query('action', 'Must specify action to take')
    .custom((val) => {
      const validActions = [ 'ban', 'restrict', 'delete' ];

      if (!validActions.includes(val)) {
        return false;
      }

      return true;
    }),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json( { errors: errors.array() });
      return;
    }

    const report = await Report.findById(req.body.reportId).exec();

    if (report === null) {
      res.status(404).json({ msg: 'Report not found' });
      return;
    }
    
    const { contentType, contentId, reportedUser } = report;
    const action = req.query.action;

    if (action === 'ban' || action === 'restrict') {
      let newStatus;
      if (action === 'ban') {
        newStatus = 'Banned';
      } else if (action === 'restrict') {
        newStatus = 'Restricted';
      }
      // In addition to updating status in user... 
      // user status is denormalized across blogs, blogsposts, and comments
      const session = await mongoose.startSession();
      session.withTransaction(async (s) => {
        const users = await User.find({ username: reportedUser }).session(s).exec();
  
        if (users.length === 0) {
          throw new Error('user not found');
        }
  
        const user = users[0]; // usernames unique, will only ever be one result
        
        const blogs = await Blog.find({ 'owner.doc': user._id }).session(s).exec();
        const blogPosts = await BlogPost.find({ 'author.doc': user._id }).session(s).exec();
        const comments = await Comment.find({ 'author.doc': user._id }).session(s).exec();

        user.status = newStatus;

        report.settled = true;
        report.dateOfAction = new Date();
        report.respondingModerator = req.user.username;
        report.actionTaken = newStatus;

        return Promise.all([          
          ...blogs.map((blog) => {
            blog.owner.status = newStatus;
            return blog.save({ session: s });
          }),
          ...blogPosts.map((blogpost) => {
            blogpost.author.status = newStatus;
            return blogpost.save({ session: s });
          }),
          ...comments.map((comment) => {
            comment.author.status = newStatus;
            return comment.save({ session: s });
          }),
          user.save({ session: s }),
          report.save({ session: s })
        ]);
      })
        .then(() => session.commitTransaction())
        .then(() => {
          session.endSession();
          res.status(204).end();
          
          return;
        })
        .catch((err) => { 
          return next(createError(500, 'Mod action failed'));
        });
    } else if (req.query.action === 'delete') {
      const session = await mongoose.startSession();
      session.withTransaction(async (s) => {
        let model;
        if (contentType === 'Comment') {
          model = Comment;
        } else if (contentType === 'BlogPost') {
          model = BlogPost;
        }

        report.settled = true;
        report.dateOfAction = new Date();
        report.respondingModerator = req.user.username;
        report.actionTaken = 'Delete Content';

        console.log(report.modifiedPaths());

        // If deleting a blogpost there may be comments associated with that blog post
        // For now nothing will be done about that since comments are retrieved only in
        // blog posts, and we shouldn't destroy other users comments just because a blog post 
        // is removed. In the future if you are able to navigate directly to comments and back
        // to the blogpost, it will just 404 which is acceptable.
        await model.findByIdAndDelete(contentId).session(s).exec();
        await report.save({ session: s });
      })
        .then((promise) => {console.log(promise); return session.commitTransaction()})
        .then(() => session.endSession())
        .then(() => {
          res.status(204).end();
        })
        .catch((err) => {
          console.log(err);
          res.status(500).end();
        });
      return;
    } 
  }),
];

// gets param userId
exports.api_post_moderate_user = [
  isAdminOrModerator,
  query('account_status', 'Unrecognizable account status')
    .optional()
    .custom((val, { req }) => {
      const acceptedAccountStatuses = ['Banned', 'Good', 'Restricted'];

      if (!acceptedAccountStatuses.includes(req.query.account_status)) {
        return false;
      }

      return true;
    }),
  query('account_type', 'Unrecognizable account type')
    .optional()
    .custom((val, { req }) => {
      const acceptedAccountTypes = ['Admin', 'Blogger', 'Commenter', 'Moderator'];

      if (!acceptedAccountTypes.includes(req.query.account_type)) {
        return false;
      }

      return true;
    }),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    if(req.query.delete_user === 'true') {
      // Only admins can delete accounts
      if (!req.user.accountType === 'Admin') {
        return res.status(403).json({ msg: 'Forbidden' });
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        return Promise.all([
          Comment.deleteMany({ 'author.doc': req.params.userId }).session(session).exec(),
          BlogPost.deleteMany({ 'author.doc': req.params.userId }).session(session).exec(),
          Blog.deleteMany({ 'owner.doc': req.params.userId }).session(session).exec(),
          User.deleteOne({ _id: req.params.userId }).session(session).exec(),
        ]);
      })
        .then(() => session.commitTransaction())
        .then(() => session.endSession())
        .then(() => res.status(204).end())
        .catch((err) => next(err));

      return;
    }

    if (req.query.account_status !== undefined) {
      const session = await mongoose.startSession();
      const { userId } = req.params;
      const status = req.query.account_status;
      // when updating status, must change for 
      // user, blog.owner.status, blogpost.author.status, comment.author.status
      session.withTransaction(async () => {
        const [ user, blogs, blogposts, comments ] = await Promise.all([
          User.findById(userId).session(session).exec(),
          Blog.find({ 'owner.doc': userId }).session(session).exec(),
          BlogPost.find({ 'author.doc': userId }).session(session).exec(),
          Comment.find({ 'author.doc': userId }).session(session).exec(),
        ]);

        user.status = status;

        const blogsPromise = blogs.map((blog) => {
          blog.owner.status = status;
          return blog.save({ session });
        });

        const blogPostsPromise = blogposts.map((post) => {
          post.author.status = status;
          return post.save({ session });
        });

        const commentsPromise = comments.map((comment) => {
          comment.author.status = status;
          return comment.save({ session });
        })

        return Promise.all([
          user.save({ session }),
          ...blogsPromise,
          ...blogPostsPromise,
          ...commentsPromise,
        ]);
      })
        .then(() => session.commitTransaction())
        .then(() => session.endSession())
        .then(() => res.status(204).end())
        .catch((err) => next(err));

      return;
    }

    if (req.query.account_type !== undefined) {
      // only admin can change account type
      if (req.user.accountType !== 'Admin') {
        return res.status(403).json({ msg: 'Forbidden' });
      }

      // for now just update account type without worrying about what it 
      // means to change in behavior

      const user = await User.findById(req.params.userId).exec();
      user.accountType = req.query.account_type;

      await user.save();
      return res.status(204).end();
    }
  }),
];