if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const createError = require('http-errors');
const morgan = require('morgan');
const accountsRouter = require('./routes/accounts.js');

const app = express();

connectMongo()
  .then(() => {
    console.log('Connected to MongoDb');
  })
  .catch(err => console.log(err));

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
}

if (process.env.NODE_ENV = 'development') {
  app.use(morgan('dev'));
} else if (process.env.NODE_ENV = 'production') {
  app.use(morgan('common'));
}

app.use(cors());
app.use(express.static('/public'));

app.use('/', accountsRouter);

app.use((req, res, next) => {
  //If it reaches this point it's a 404 error
  return next(createError(404, 'File not found'));
});

app.use((err, req, res, next) => {
  res
    .status(err.status || 500)
    .json({ 
      error: err.message || 'There has been an error' 
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});