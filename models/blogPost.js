const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const blogPostSchema = new Schema({
  blog: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Blog',
  },
  author: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  title: {
    required: true,
    type: String,
    trim: true,
    maxLength: 50,
  },
  content: {
    required: true,
    type: String,
    trim: true,
    maxLength: 5000,
  },
  created: {
    required: true,
    type: Date,
  },
  private: {
    type: Boolean,
  }
});

module.exports = mongoose.model('BlogPost', blogPostSchema);