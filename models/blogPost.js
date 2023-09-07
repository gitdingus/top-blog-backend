const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const blogPostSchema = new Schema({
  blog: {
    doc: {
      required: true,
      type: Schema.Types.ObjectId,
      ref: 'Blog',
    },
    private: { 
      required: true,
      type: Boolean,
    }
  },
  author: {
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
    required: true,
  }
});

module.exports = mongoose.model('BlogPost', blogPostSchema);