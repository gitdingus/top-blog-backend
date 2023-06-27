const crypto = require('crypto');

const passwordConfig = { 
  // Make stronger in prod
  minLength: 5,
  minLowercase: 0,
  minUppercase: 0,
  minNumbers: 0,
  minSymbols: 0,
  returnScore: false,
};

function generateSaltHash(password) {
  const normalizedPwd = password.normalize();
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(normalizedPwd, salt, 1000, 128, 'sha512').toString('hex');

  return {
    salt, hash
  }
}

function validPassword(password, salt, hash) {
  const normalizedPwd = password.normalize();
  const passwordAttempt = crypto.pbkdf2Sync(normalizedPwd, salt, 1000, 128, 'sha512').toString('hex');

  return passwordAttempt === hash;
}

module.exports = {
  passwordConfig,
  generateSaltHash,
  validPassword,
}
