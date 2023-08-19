const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { param, validationResult } = require('express-validator');
const Blog = require('../models/blog.js');
const BlogPost = require('../models/blogPost.js');
const Category = require('../models/category.js');
const User = require('../models/user.js');
const mongoose = require('mongoose');

exports.api_get_category_list = asyncHandler (async (req, res, next) => {
  const categoriesQuery = Category.find({});

  /* Not Tested */
  if (req.query.limit) {
    categoriesQuery.limit(req.query.limit);
  }

  if (req.query.skip) {
    categoriesQuery.skip(req.query.skip);
  }
  /* End not tested */

  const categories = await categoriesQuery.exec();

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
  const blogResults = 
    await Blog
      .find({ name: req.params.blogName })
      .populate('category')
      .populate('owner')
      .exec();

  if (!blogResults.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  const blog = blogResults[0];
  // Remove sensitive data
  blog.owner.salt = undefined;
  blog.owner.hash = undefined;
  blog.owner._id = undefined;

  // Remove private info if necessary
  if (blog.owner.public === false) {
    blog.owner.firstName = undefined;
    blog.owner.lastName = undefined;
    blog.owner.email = undefined;
  }

  res.status(200).json({ blog });
});

exports.api_get_blog_posts = asyncHandler(async(req, res, next) => {
  const blog = await Blog.find({ name: req.params.blogName }).exec();

  if (!blog.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  const posts = await BlogPost.find({ blog }).sort({ created: 'desc' }).exec();

  res.status(200).json({ posts });
});

exports.api_get_blogs = asyncHandler(async (req, res, next) => {
  const matchObj = {};
  let blogsQuery;

  if (req.query) {
    if (req.query.owner) {
      const authorId = await User.findOne({ username: req.query.owner }, '_id').exec();
      matchObj.owner = authorId._id;
    }

    if (req.query.category) {
      matchObj.category = new mongoose.Types.ObjectId(req.query.category);
    }

    if (req.query.preview === 'true') {
      const aggregate = [
        {
          $match: matchObj,
        },
        {
          $set: { 
            preview: { 
              $concat: [
                { $substrBytes: [ '$description', 0, 125 ] },
                '...',
              ],
            }, 
          },
        },
        {
          $unset: ['__v', 'description'],
        },
      ];

      const aggResults = await Blog.aggregate(aggregate);

      await Promise.all([
        Blog.populate(aggResults, { path: 'owner', select: 'username -_id' }),
        Blog.populate(aggResults, { path: 'category', select: 'name' }),
      ]);

      res.status(200).json({ blogs: aggResults });
      return;

    } else {
      blogsQuery = Blog
      .find(matchObj, '-__v')
      .populate('owner', 'username -_id')
      .populate('category', 'name');
  
      const blogs = await blogsQuery.exec();
    
      res.status(200).json({ blogs });
      return;
    }
  }


});