const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  blogPost: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'BlogPost',
  },
  author: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  created: {
    type: Date,
    required: true,
  },
  content: {
    type: String,
    trim: true,
    maxLength: 1000,
    required: true,
  }
});

module.exports = mongoose.model('Comment', commentSchema);
