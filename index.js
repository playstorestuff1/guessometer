// index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_URL = process.env.ROOT_URL || `https://${process.env.REPL_SLUG || ''}.repl.co`;

// --- Session setup ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
}));

// --- Passport setup ---
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `${process.env.ROOT_URL || ROOT_URL}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, done) => {
    // For a real app, find-or-create user in DB here.
    return done(null, { profile, accessToken });
  }
));

// --- Routes ---
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.send(`
      <h2>Welcome, ${req.user.profile.displayName}</h2>
      <p>Email: ${req.user.profile.emails?.[0]?.value || 'unknown'}</p>
      <a href="/private">Private page</a><br>
      <a href="/logout">Logout</a>
    `);
  }
  res.send(`<a href="/auth/google">Sign in with Google</a>`);
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

app.get('/private', ensureAuthenticated, (req, res) => {
  res.send(`<h1>Private</h1><p>Only for ${req.user.profile.displayName}</p><a href="/">Home</a>`);
});

app.get('/logout', (req, res) => {
  req.logout(function(err) {
    // callback required in newer passport versions
    res.redirect('/');
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));