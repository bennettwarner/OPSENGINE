const { promisify } = require("util");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const passport = require("passport");
const _ = require("lodash");
const User = require("../models/User");
const validator = require("validator");
var tfa = require("2fa");

const randomBytesAsync = promisify(crypto.randomBytes);

var secure_smtp = "";
if (process.env.SECURE_SMTP == "true") {
  secure_smtp = "s";
}
var smtp_settings =
  "smtp" +
  secure_smtp +
  "://" +
  process.env.SMTP_USER +
  ":" +
  process.env.SMTP_PASS +
  "@" +
  process.env.SMTP_SERVER +
  ":" +
  process.env.SMTP_PORT;

/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect("/");
  }
  res.render("account/login", {
    title: "Login"
  });
};

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (validator.isEmpty(req.body.password))
    validationErrors.push({ msg: "Password cannot be blank." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/login");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("errors", info);
      return res.redirect("/login");
    }
    if (user.profile.state == false) {
      req.flash("errors", {
        msg:
          "User not yet approved. Please contact the " +
          process.env.COMPANY +
          " team."
      });
      return res.redirect("/login");
    }
    if (user.mfa_secret != null) {
      req.session.mfa_user = user._id;
      return res.redirect("/2fa");
    }
    req.logIn(user, err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Success! You are logged in." });
      res.redirect(req.session.returnTo || "/");
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
exports.logout = (req, res) => {
  req.logout();
  req.session.destroy(err => {
    if (err)
      console.log("Error : Failed to destroy the session during logout.", err);
    req.user = null;
    res.redirect("/");
  });
};

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
  if (req.user) {
    return res.redirect("/");
  }
  res.render("account/signup", {
    title: "Create Account"
  });
};

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });
  if (!validator.isLength(req.body.password, { min: 8 }))
    validationErrors.push({
      msg: "Password must be at least 8 characters long"
    });
  if (req.body.password !== req.body.confirmPassword)
    validationErrors.push({ msg: "Passwords do not match" });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/signup");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  User.findOne({}, (err, users) => {
    if (users == null) {
      role = "0";
      state = true;
    } else {
      role = "1";
      state = false;
    }

    const user = new User({
      email: req.body.email,
      password: req.body.password,
      profile: {
        title: "",
        role: role,
        state: state
      },
      theme: "light"
    });

    User.findOne({ email: req.body.email }, (err, existingUser) => {
      if (err) {
        return next(err);
      }
      if (existingUser) {
        req.flash("errors", {
          msg: "Account with that email address already exists."
        });
        return res.redirect("/signup");
      }
      user.save(err => {
        if (err) {
          return next(err);
        }
        req.flash("success", {
          msg:
            "Success! Please wait for an administrator to approve your account."
        });
        res.redirect("/");
      });
    });
  });
};

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
  res.render("account/profile", {
    title: "Account Management"
  });
};

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/account");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user.email = req.body.email || "";
    user.profile.name = req.body.name || "";
    user.profile.title = req.body.title || "";
    if (req.body.theme == "on") {
      user.theme = "dark";
    } else {
      user.theme = "light";
    }
    user.save(err => {
      if (err) {
        if (err.code === 11000) {
          req.flash("errors", {
            msg:
              "The email address you have entered is already associated with an account."
          });
          return res.redirect("/account");
        }
        return next(err);
      }
      req.flash("success", { msg: "Profile information has been updated." });
      res.redirect("/account");
    });
  });
};

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isLength(req.body.password, { min: 8 }))
    validationErrors.push({
      msg: "Password must be at least 8 characters long"
    });
  if (req.body.password !== req.body.confirmPassword)
    validationErrors.push({ msg: "Passwords do not match" });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/account");
  }

  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user.password = req.body.password;
    user.save(err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Password has been changed." });
      res.redirect("/account");
    });
  });
};

/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = (req, res, next) => {
  User.deleteOne({ _id: req.user.id }, err => {
    if (err) {
      return next(err);
    }
    req.logout();
    req.flash("info", { msg: "Your account has been deleted." });
    res.redirect("/");
  });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  User.findOne({ passwordResetToken: req.params.token })
    .where("passwordResetExpires")
    .gt(Date.now())
    .exec((err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        req.flash("errors", {
          msg: "Password reset token is invalid or has expired."
        });
        return res.redirect("/forgot");
      }
      res.render("account/reset", {
        title: "Password Reset"
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isLength(req.body.password, { min: 8 }))
    validationErrors.push({
      msg: "Password must be at least 8 characters long"
    });
  if (req.body.password !== req.body.confirm)
    validationErrors.push({ msg: "Passwords do not match" });
  if (!validator.isHexadecimal(req.params.token))
    validationErrors.push({ msg: "Invalid Token.  Please retry." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("back");
  }

  const resetPassword = () =>
    User.findOne({ passwordResetToken: req.params.token })
      .where("passwordResetExpires")
      .gt(Date.now())
      .then(user => {
        if (!user) {
          req.flash("errors", {
            msg: "Password reset token is invalid or has expired."
          });
          return res.redirect("back");
        }
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        return user.save().then(
          () =>
            new Promise((resolve, reject) => {
              req.logIn(user, err => {
                if (err) {
                  return reject(err);
                }
                resolve(user);
              });
            })
        );
      });

  const sendResetPasswordEmail = user => {
    if (!user) {
      return;
    }
    let transporter = nodemailer.createTransport(smtp_settings);
    const mailOptions = {
      to: user.email,
      from: process.env.FROM_EMAIL,
      subject: "Your OPSENGINE password has been changed",
      text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
    };
    return transporter
      .sendMail(mailOptions)
      .then(() => {
        req.flash("success", {
          msg: "Success! Your password has been changed."
        });
      })
      .catch(err => {
        if (err.message === "self signed certificate in certificate chain") {
          console.log(
            "WARNING: Self signed certificate in certificate chain. Retrying with the self signed certificate. Use a valid certificate if in production."
          );
          transporter = nodemailer.createTransport({
            service: "SendGrid",
            auth: {
              user: process.env.SENDGRID_USER,
              pass: process.env.SENDGRID_PASSWORD
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          return transporter.sendMail(mailOptions).then(() => {
            req.flash("success", {
              msg: "Success! Your password has been changed."
            });
          });
        }
        console.log(
          "ERROR: Could not send password reset confirmation email after security downgrade.\n",
          err
        );
        req.flash("warning", {
          msg:
            "Your password has been changed, however we were unable to send you a confirmation email. We will be looking into it shortly."
        });
        return err;
      });
  };

  resetPassword()
    .then(sendResetPasswordEmail)
    .then(() => {
      if (!res.finished) res.redirect("/");
    })
    .catch(err => next(err));
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.render("account/forgot", {
    title: "Forgot Password"
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = (req, res, next) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.email))
    validationErrors.push({ msg: "Please enter a valid email address." });

  if (validationErrors.length) {
    req.flash("errors", validationErrors);
    return res.redirect("/forgot");
  }
  req.body.email = validator.normalizeEmail(req.body.email, {
    gmail_remove_dots: false
  });

  const createRandomToken = randomBytesAsync(16).then(buf =>
    buf.toString("hex")
  );

  const setRandomToken = token =>
    User.findOne({ email: req.body.email }).then(user => {
      if (!user) {
        req.flash("errors", {
          msg: "Account with that email address does not exist."
        });
      } else {
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        user = user.save();
      }
      return user;
    });

  const sendForgotPasswordEmail = user => {
    if (!user) {
      return;
    }
    const token = user.passwordResetToken;
    let transporter = nodemailer.createTransport(smtp_settings);
    const mailOptions = {
      to: user.email,
      from: process.env.FROM_EMAIL,
      subject: "Reset your password on " + process.env.PLATFORM,
      text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        http://${req.headers.host}/reset/${token}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };
    return transporter
      .sendMail(mailOptions)
      .then(() => {
        req.flash("info", {
          msg: `An e-mail has been sent to ${user.email} with further instructions.`
        });
      })
      .catch(err => {
        console.log(err);
        req.flash("errors", {
          msg:
            "Error sending the password reset message. Please try again shortly."
        });
        return err;
      });
  };

  createRandomToken
    .then(setRandomToken)
    .then(sendForgotPasswordEmail)
    .then(() => res.redirect("/forgot"))
    .catch(next);
};

/**
 * GET /users
 */
exports.getUsers = (req, res) => {
  if (req.user.profile.role != "0") {
    res.redirect("/");
  } else {
    User.find({}, (err, users) => {
      res.render("account/users", {
        title: "User Management",
        users: users
      });
    });
  }
};

/**
 * GET /users/enable/:id
 */
exports.enableUser = (req, res) => {
  if (req.user.profile.role != "0") {
    res.redirect("/");
  } else {
    User.findById(req.params.id, (err, user) => {
      if (err) {
        return next(err);
      }
      user.profile.state = true;
      user.save(err => {
        if (err) {
          return next(err);
        }
        res.redirect("/users");
      });
    });
  }
};

/**
 * GET /users/disable/:id
 */
exports.disableUser = (req, res) => {
  if (req.user.profile.role != "0") {
    res.redirect("/");
  } else {
    User.findById(req.params.id, (err, user) => {
      if (err) {
        return next(err);
      }
      user.profile.state = false;
      user.save(err => {
        if (err) {
          return next(err);
        }
        res.redirect("/users");
      });
    });
  }
};

/**
 * GET /users/delete/:id
 */
exports.deleteUser = (req, res) => {
  if (req.user.profile.role != "0") {
    res.redirect("/");
  } else {
    User.remove({ _id: req.params.id }, (err, user) => {
      if (err) {
        return next(err);
      }
      res.redirect("/users");
    });
  }
};

/**
 * GET /users/edit/:id
 * Profile page.
 */
exports.getEditUser = (req, res) => {
  User.findById(req.params.id, (err, user) => {
    if (err) {
      return next(err);
    }
    res.render("account/edit", {
      title: "Edit User",
      current_user: user
    });
  });
};

/**
 * POST /users/edit/:id
 * Update profile information.
 */
exports.postEditUser = (req, res, next) => {
  if (req.user.profile.role != "0") {
    res.redirect("/");
  } else {
    User.findById(req.params.id, (err, user) => {
      if (err) {
        return next(err);
      }
      user.profile.name = req.body.name || "";
      user.profile.title = req.body.title || "";
      user.profile.role = req.body.role || "1";

      user.save(err => {
        if (err) {
          return next(err);
        }
        req.flash("success", { msg: "Profile information has been updated." });
        res.redirect("/users");
      });
    });
  }
};

exports.retro = (req, res, next) => {
  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    var rand_theme = Math.random() >= 0.5;
    console.log(rand_theme);
    if (rand_theme == true) {
      user.theme = "hacker";
    } else {
      user.theme = "geo";
    }
    user.save(err => {
      if (err) {
        return next(err);
      }
      req.flash("success", { msg: "Profile information has been updated." });
      res.redirect("/");
    });
  });
};

exports.getEnrollMFA = (req, res) => {
  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    if (user.mfa_secret != null) {
      req.flash("errors", {
        msg: "Already enrolled!"
      });
      res.redirect("/account");
    } else {
      tfa.generateKey(32, function(err, key) {
        // generate a google QR code so the user can save their new key
        // tfa.generateGoogleQR(name, accountname, secretkey, cb)
        tfa.generateGoogleQR(process.env.COMPANY, user.email, key, function(
          err,
          qr
        ) {
          //DELETE THIS for production
          // ##############################################
          // ############
          // data URL png image for google authenticator
          var counter = Math.floor(Date.now() / 1000 / 30);
          // generate a valid code (in real-life this will be user-input)
          var code = tfa.generateCode(key, counter);
          console.log(code);
          // ############
          // ##############################################

          res.render("account/enroll", {
            title: "Enroll in 2FA",
            mfa_secret: key,
            mfa_qr: qr
          });
        });
      });
    }
  });
};

exports.postEnrollMFA = (req, res) => {
  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    if (user.mfa_secret != null) {
      req.flash("errors", {
        msg: "Already enrolled!"
      });
      res.redirect("/account");
    } else {
      var validTOTP = tfa.verifyTOTP(req.body.mfa_secret, req.body.mfa_code);
      console.log(validTOTP);

      if (!validTOTP) {
        req.flash("errors", { msg: "Enrollment failed! Please try again." });
        res.redirect("/account");
      } else {
        user.mfa_secret = req.body.mfa_secret;
        user.save(err => {
          if (err) {
            return next(err);
          }
          req.flash("success", {
            msg: "Enrollment successful!"
          });
          res.redirect("/account");
        });
      }
    }
  });
};

/**
 * GET /users/edit/:id
 * Profile page.
 */
exports.getDisableEnrollment = (req, res) => {
  User.findById(req.user.id, (err, user) => {
    if (err) {
      return next(err);
    }
    user.mfa_secret = undefined;
    user.save(err => {
      if (err) {
        return next(err);
      }
      req.flash("success", {
        msg: "2FA Disabled!"
      });
      res.redirect("/account");
    });
  });
};

exports.getMFA = (req, res) => {
  if (req.user) {
    return res.redirect("/");
  }
  res.render("account/mfa", {
    title: "2FA Login"
  });
};

exports.postMFA = (req, res) => {
  if (req.user) {
    return res.redirect("/");
  }
  User.findById(req.session.mfa_user, (err, user) => {
    if (err) {
      return next(err);
    }
    var validTOTP = tfa.verifyTOTP(user.mfa_secret, req.body.mfa);

    if (validTOTP) {
      req.logIn(user, err => {
        if (err) {
          return next(err);
        }
        req.flash("success", { msg: "Success! You are logged in." });
        res.redirect(req.session.returnTo || "/");
      });
    } else {
      req.flash("errors", { msg: "Invalid 2FA token" });
      res.redirect("/login");
    }
  });
};
