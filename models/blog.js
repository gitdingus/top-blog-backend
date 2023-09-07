const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const blogSchema = new Schema({
  owner: {
    doc: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      required: true,
      type: String,
    },
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
  private: {
    type: Boolean,
    required: true,
  },
});

module.exports = mongoose.model('Blog', blogSchema);
