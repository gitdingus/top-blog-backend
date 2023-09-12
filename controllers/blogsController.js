const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const { param, validationResult } = require('express-validator');
const Blog = require('../models/blog.js');
const BlogPost = require('../models/blogPost.js');
const Category = require('../models/category.js');
const Comment = require('../models/comment.js');
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
      .populate('owner.doc')
      .exec();

  if (!blogResults.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  if (blogResults[0].private === true) {
    return next(createError(403, 'Blog has been set to private'));
  }
  
  const blog = blogResults[0];
  // Remove sensitive data
  blog.owner.doc.salt = undefined;
  blog.owner.doc.hash = undefined;
  blog.owner.doc._id = undefined;

  // Remove private info if necessary
  if (blog.owner.doc.public === false) {
    blog.owner.doc.firstName = undefined;
    blog.owner.doc.lastName = undefined;
    blog.owner.doc.email = undefined;
  }

  res.status(200).json({ blog });
});

exports.api_get_blog_posts = asyncHandler(async(req, res, next) => {
  const blog = await Blog.find({ name: req.params.blogName }).exec();

  if (!blog.length > 0) {
    return next(createError(404, 'Blog not found'));
  }

  if (blog[0].private === true) {
    return next(createError(403, 'Blog has been set to private'));
  }

  const aggregate = [
    { 
      $match: {
        'blog.doc': blog[0]._id,
        'private': { $ne: true },
      }, 
    },
    {
      $project: {
        _id: 1,
        title: 1,
        created: 1,
        content: 1,
      }
    },
    {
      $set: {
        preview: {
          $concat: [
            { $substrBytes: [ '$content', 0, 200 ] },
            '...',
          ],
        },
      },
    },
    {
      $unset: ['__v', 'content'],
    },
  ];

  const posts = await BlogPost.aggregate(aggregate);
  
  res.status(200).json({ posts });
});

exports.api_get_blogs = asyncHandler(async (req, res, next) => {
  let matchObj = { private: { $ne: true } };
  let blogsQuery;

  if (req.query) {
    if (req.query.owner) {
      const authorId = await User.findOne({ username: req.query.owner }, '_id').exec();
      matchObj = { 
        ...matchObj,
        'owner.doc' : authorId._id,
      };
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
        Blog.populate(aggResults, { path: 'owner.doc', select: 'username public firstName lastName -_id' }),
        Blog.populate(aggResults, { path: 'category', select: 'name' }),
      ]);

      aggResults.forEach((blog) => {
        if (!blog.owner.doc.public) {
          blog.owner.doc.firstName = undefined;
          blog.owner.doc.lastName = undefined;
        }
      });

      res.status(200).json({ blogs: aggResults });
      return;

    } else {
      blogsQuery = Blog
      .find(matchObj, '-__v')
      .populate('owner.doc', 'username public firstName lastName -_id')
      .populate('category', 'name');
  
      const blogs = await blogsQuery.exec();
    
      blogs.forEach((blog) => {
        if (!blog.owner.doc.public) {
          blog.owner.doc.firstName = undefined;
          blog.owner.doc.lastName = undefined;
        }
      });
      
      res.status(200).json({ blogs });
      return;
    }
  }


});

exports.api_get_recent_posts = asyncHandler(async (req, res, next) => {
  const recentPosts = 
    await BlogPost
      .find({
        'blog.private' : { $ne: true },
        'author.status' : { $ne: 'Banned' },
        'private' : { $ne: true },
      })
      .select(['author', 'title', 'created', 'blog'])
      .sort({ 'created': 'desc' })
      .populate({
        path: 'author.doc',
        select: 'username public firstName lastName -_id',
      })
      .populate({
        path: 'blog.doc',
        select: 'category name private -_id',
        populate: {
          path: 'category',
          select: 'name',
        },
      })
      .limit(10)
      .exec();

  recentPosts.forEach((post) => {
    if (!post.author.doc.public) {
      post.author.doc.firstName = undefined;
      post.author.doc.lastName = undefined;
    }
  });
  
  res.status(200).json({ recentPosts });
});

exports.api_get_blogPost = asyncHandler(async (req,res,next) => {
  let blogPost = 
    await BlogPost
      .find({
        _id: req.params.postId,
        'blog.private': { $ne: true },
        'author.status': { $ne: 'Banned' },
        private: { $ne: true },
      })
      .populate({
        path: 'author.doc',
        select: '-salt -hash -_id'
      })
      .populate({
        path: 'blog.doc',
        select: 'category title name -_id',
        populate: {
          path: 'category',
          select: 'name',
        },
      })
      .exec();

  if (blogPost === null) {
    res.status(404).json({ msg: 'Blog post could not be retrieved' });
    return;
  }

  blogPost = blogPost[0];

  // Remove private information if necessary
  if (!blogPost.author.doc.public) {
    blogPost.author.doc.firstName = undefined;
    blogPost.author.doc.lastName = undefined;
    blogPost.author.doc.email = undefined;
  }

  res.status(200).json( { post: blogPost });
});

// URL Params postId - blogPosts unique Id
exports.api_get_blogpost_comments = asyncHandler(async (req, res, next) => {
  const comments = await Comment
    .find({ 
      blogPost: req.params.postId,
      'author.status' : { $ne: 'Banned' }
    })
    .populate('author.doc', 'firstName lastName username public -_id')
    .exec();

  comments.forEach((comment) => {
    if (!comment.author.doc.public) {
      comment.author.doc.firstName = undefined;
      comment.author.doc.lastName = undefined;
    }
  });

  res.status(200).json({
    msg: 'Success',
    comments: comments,
  });
});