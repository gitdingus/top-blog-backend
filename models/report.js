const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
  contentType: {
    type: String,
    enum: ['Comment', 'BlogPost'],
    required: true
  },
  contentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    required: true,
  },
  reportingUser: {
    type: String,
    required: true,
  },
  reportedUser: {
    type: String,
    required: true,
  },
  reportCreated: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    trim: true,
    maxLength: 200,
    required: true,
  },
  respondingModerator: {
    type: String,
  },
  actionTaken: {
    type: String,
    maxLength: 200,
    trim: true,
  },
  dateOfAction: {
    type: Date,
  },
  settled: {
    type: Boolean,
  },
});

module.exports = mongoose.model('Report', reportSchema);
