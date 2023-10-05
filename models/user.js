const validator = require('validator');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true, 
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: 'Must enter a valid email addres',
    },
  },
  status: {
    type: String,
    required: true,
    enum: [ 'Good', 'Banned', 'Restricted' ],
  },
  accountType: {
    type: String,
    required: true,
    enum: [ 'Admin', 'Moderator', 'Commenter', 'Blogger' ],
  },
  public: Boolean,
  salt: {
    type: String,
    required: true,
    minLength: 32,
  },
  hash: {
    type: String,
    required: true,
    minLength: 128,
  },
  accountCreated: {
    type: Date,
    required: true,
  },
  image: {
    type: String,
  }
});

module.exports = mongoose.model('User', userSchema);