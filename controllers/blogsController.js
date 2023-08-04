const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { param, validationResult } = require('express-validator');
const Blog = require('../models/blog.js');
const BlogPost = require('../models/blogPost.js');
const Category = require('../models/category.js');
const User = require('../models/user.js');

exports.api_get_category_list = asyncHandler (async (req, res, next) => {
  const categories = await Category.find({}).exec();

  console.log(categories);
  res.status(200).json({ categories });
});

exports.api_get_category_details = [
  param('categoryId')
    .isMongoId().withMessage('Invalid category Id'),
  asyncHandler (async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return next(createError(404, 'Category not found'));
    }

    const category = await Category.findById(req.params.categoryId);

    if (category === null) {
      return next(createError(404, 'Category not found'));
    }

    res.status(200).json({ category });
  }),
];

/*
  Security Concerns
    DO NOT INCLUDE: _id, salt, hash,
    Respect public/private profile
*/
exports.api_get_authors_list = asyncHandler (async (req, res, next) => {
  const authors = await User.find({ accountType: 'Blogger' }, { __v: 0, _id: 0, salt: 0, hash: 0,  }).exec();

  // check if profile is public, if not: remove private info (first and last names + email);
  authors.forEach((author) => {
    if (!author.public) {
      author.firstName = undefined;
      author.lastName = undefined;
      author.email = undefined;
    }
  });

  res.status(200).json({ authors });
});

/*
  Security Concerns
    DO NOT INCLUDE: _id, salt, hash,
    Respect public/private profile
*/
exports.api_get_author_details = asyncHandler ( async (req, res, next) => {
  const author = await User.find( { username: req.params.username, accountType: 'Blogger' }, { __v: 0, _id: 0, salt: 0, hash: 0 }).exec();

  console.log(author);
  if (!author.length > 0) {
    return next(createError(404, 'Author does not exist or does not belong to a blogger'));
  }

  if (author[0].public === false) {
    author[0].firstName = undefined;
    author[0].lastName = undefined;
    author[0].email = undefined;
  }

  res.status(200).json({ author: author[0] });
});

exports.api_get_blog_details = asyncHandler(async (req, res, next) => {
  const blog = await Blog.find({ name: req.params.blogName }).exec();

  if (!blog.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  res.status(200).json({ blog: blog[0] });
});

exports.api_get_blog_posts = asyncHandler(async(req, res, next) => {
  const blog = await Blog.find({ name: req.params.blogName }).exec();

  if (!blog.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  const posts = await BlogPost.find({ blog }).exec();

  res.status(200).json({ posts });
  res.status(200).json({ msg: 'GET BLOG POSTS: Not Implemented'});
});