const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const blogSchema = new Schema({
  owner: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  name: {
    required: true,
    type: String,
    trim: true,
    maxLength: 25,
    match: /^[a-zA-Z-_]+$/,
  },
  title: {
    required: true,
    type: String,
    trim: true,
    maxLength: 50,
  },
  description: {
    required: true,
    type: String,
    trim: true,
    maxLength: 500,
  },
  category: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Category',
  },
  created: {
    required: true,
    type: Date,
  },
});

module.exports = mongoose.model('Blog', blogSchema);
