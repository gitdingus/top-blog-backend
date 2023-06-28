if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const createError = require('http-errors');
const morgan = require('morgan');
const accountsRouter = require('./routes/accounts.js');
const User = require('./models/user.js');
const { validPassword } = require('./utils/passwordUtils.js');

const app = express();

// Connect to mongoDb database
connectMongo()
  .then(() => {
    console.log('Connected to MongoDb');
  })
  .catch(err => console.log(err));

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
}

// Configure passport local strategy

passport.use(new LocalStrategy(
  async function(username, password, done) {
    const user = await User.findOne({ username: username.toLowerCase() });

    if (user === null) { 
      console.log('user null');
      return done(null, false);
    }
    if (validPassword(password, user.salt, user.hash) === false) {
      return done(null, false);
    }

    return done(null, user);
  }
));

passport.serializeUser(
  function(user, done) {
    done(null, user._id);
  }
);

passport.deserializeUser(
  async function(id, done) {
    const user = await User.findById(id);

    done(null, user);
  }
)

app.use(cors( { origin: process.env.CORS_ORIGIN, credentials: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 5, // 5 Minutes
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_CONNECTION_STRING,
    collectionName: 'sessions',
  }),
}));

app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV = 'development') {
  app.use(morgan('dev'));
} else if (process.env.NODE_ENV = 'production') {
  app.use(morgan('common'));
}

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