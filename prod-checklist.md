- Add a proxy such as Cloudflare in front of your production deployment
- Add Winston Logging, and replace console.log statements with Winston; have a process for monitoring errors to identify bugs or other issues after lunch.
- (optional) Add email verification *Some experimental data has shown that bogus email addresses are not a significant problem in many cases*
- (optional) Add a filter for [disposable-email-domains](https://www.npmjs.com/package/disposable-email-domains).  *Some experimental data has shown that use of disposable emails is typically rare, and in many cases it might not be worth to add this filter.*
 

### Remove unused code and configs
The following is a list of various codes that you may not potential be using and you could remove depending on your application:
- /controllers/api.js entirely
- /views/api entirely
- app.js:
  - chalk usage
  - multer
  - apiController
  - csrf check exception for /api/upload
  - All API example routes
- passport.js all references and functions related to:
  - request ( require('request') )
- package.json
  - @octokit/rest, chalk, clockwork, express-status-monitor, instagram-node, lastfm, lob, multer, node-foursquare, node-linkedin, passport-github, passport-instagram, passport-linkedin-oauth2, passport-oauth, passport-openid, paypal-rest-sdk, stripe, tumbler.js, twilio
