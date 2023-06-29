const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const categorySchema = new Schema({
  name: {
    required: true,
    type: String,
    trim: true,
    maxLength: 30,
  },
  description: {
    required: true,
    type: String,
    trim: true,
    maxLength: 500,
  },
});

module.exports = mongoose.model('Category', categorySchema);
