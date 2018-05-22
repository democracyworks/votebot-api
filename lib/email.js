var Promise = require('bluebird');
var config = require('../config');
var template = require('nunjucks');
var us_states = require('./us_states');
var us_election = require('./us_election');
var moment = require('moment-timezone');
var marked = require('marked');
var ICS = require('ics');
var SparkPost, client, tmpl_env;

tmpl_env = template.configure('templates', {
    noCache: true,
    autoescape: false
});

exports.create = function(to, subject, text, attachments)
{
    SparkPost = require("sparkpost");
    client = new SparkPost(config.sparkpost_api_key);

    var recipientsFormatted = [];

    for (var i = 0; i < to.length; i++) {
        recipientsFormatted.push({address: to[i]});
    }

    return new Promise(function(resolve, reject) {
        client.transmissions.send({
          content: {
            from: {
              name: 'HelloVote',
              email: config.mail.from
            },
            subject: subject,
            html: text,
            attachments: attachments
          },
          recipients: recipientsFormatted
        }, function(err, data) {
            if (err) {
                return reject(err);
            } else {
                return resolve(data);
            }
        });
    });
};

exports.sendNVRAReceipt = function(user, pdf_url) {
  var tmpl = tmpl_env.getTemplate('receipt_nvra.html', true),
      subj = '**IMPORTANT** More steps to register to vote!',
      state_name = us_states.abbr_to_name(user.settings.state),
      requirements = us_election.get_registration_requirements(user.settings.state),
      verificationInfo = getVerificationInfo(requirements),
      verify = verificationInfo.verify,
      markdown_verify_text = verificationInfo.markdown_verify_text,
      deadline_text = us_election.get_mail_deadline_text(user.settings.state),
      custom_share = us_election.state_share_urls[user.settings.state];

  var body = tmpl.render({
    user: user,
    pdf_url: pdf_url,
    verify: verify,
    markdown_verify_text: markdown_verify_text,
    deadline_text: deadline_text,
    custom_share: custom_share
  });

  return exports.create([user.settings.email], subj, body);
}

exports.sendOVRReceipt = function(user) {
  var tmpl = tmpl_env.getTemplate('receipt_ovr.html', true),
      subj = '**PLEASE REVIEW** Your HelloVote registration receipt',
      state_name = us_states.abbr_to_name(user.settings.state),
      requirements = us_election.get_registration_requirements(user.settings.state),
      ovr_site_url = us_election.state_confirmation_disclosures[user.settings.state].ovr_site_url,
      friendly_timestamp = moment().tz('America/Los_Angeles').format('MMMM D, YYYY - h:mm A z'),
      verificationInfo = getVerificationInfo(requirements),
      verify = verificationInfo.verify,
      markdown_verify_text = verificationInfo.markdown_verify_text,
      deadline_text = us_election.get_mail_deadline_text(user.settings.state);

  var body = tmpl.render({
    user: user,
    ovr_site_url: ovr_site_url,
    state_name: state_name,
    friendly_timestamp: friendly_timestamp,
    verify: verify,
    markdown_verify_text: markdown_verify_text,
    deadline_text: deadline_text
  });

  return exports.create([user.settings.email], subj, body);
}

exports.sendMailReceipt = function(user, pdf_url, mail_eta, mail_carrier) {
  var tmpl = tmpl_env.getTemplate('receipt_mail.html', true),
      subj = 'Your voter registration form is on its way!',
      state_name = us_states.abbr_to_name(user.settings.state),
      requirements = us_election.get_registration_requirements(user.settings.state),
      friendly_timestamp = moment().tz('America/Los_Angeles').format('MMMM D, YYYY - h:mm A z'),
      friendly_eta = moment(mail_eta).tz('America/Los_Angeles').format('MMMM D'),
      verificationInfo = getVerificationInfo(requirements),
      verify = verificationInfo.verify,
      markdown_verify_text = verificationInfo.markdown_verify_text,
      deadline_text = us_election.get_mail_deadline_text(user.settings.state);

  var body = tmpl.render({
    user: user,
    pdf_url: pdf_url,
    state_name: state_name,
    friendly_timestamp: friendly_timestamp,
    friendly_eta: friendly_eta,
    mail_carrier: mail_carrier,
    verify: verify,
    markdown_verify_text: markdown_verify_text,
    deadline_text: deadline_text
  });

  return exports.create([user.settings.email], subj, body);
}

exports.sendExternalOVRNotification = function(user) {
  var tmpl = tmpl_env.getTemplate('external_ovr_notification.html', true),
      state_name = us_states.abbr_to_name(user.settings.state),
      subj = '**IMPORTANT** Register to vote in '+state_name,
      requirements = us_election.get_registration_requirements(user.settings.state),
      verificationInfo = getVerificationInfo(requirements),
      verify = verificationInfo.verify,
      markdown_verify_text = verificationInfo.markdown_verify_text,
      deadline_text = us_election.get_mail_deadline_text(user.settings.state);

  var body = tmpl.render({
    user: user,
    state_name: state_name,
    ovr_url: requirements['RegisterOnline'],
    verify: verify,
    markdown_verify_text: markdown_verify_text,
    deadline_text: deadline_text
  });

  return exports.create([user.settings.email], subj, body);
}

var getVerificationInfo = function(requirements) {
  var markdown_verify_text = false;
  if (requirements && requirements["CheckRegistration"]) {
    if (requirements["CheckRegistration"].indexOf('http') === 0) {
      var verify = requirements["CheckRegistration"];
    } else {
      var verify = marked(requirements["CheckRegistration"]).replace('<p>', '').replace('</p>', '').trim();
      markdown_verify_text = true;
    }
  } else {
    var verify = 'https://am-i-registered-to-vote.org/';
  }
  return {
    verify: verify,
    markdown_verify_text: markdown_verify_text
  }
}

exports.sendCalendarInvite = function(user, invite) {
  var tmpl = tmpl_env.getTemplate('commit_to_vote.html', true),
      state_name = us_states.abbr_to_name(user.settings.state),
      subj = 'Get Ready for Election Day',
      ics = new ICS();

  var body = tmpl.render({
    user: user,
    state_name: state_name,
    state_abbr: user.settings.state,
    election_day: moment(config.election.date, 'YYYY-MM-DD').format('dddd, MMMM Do'),
    polling_place: user.results.polling_place || {},
    gttp_link: invite.url
  });

  var event = ics.buildEvent(invite);
  var attachment = {
    type: 'text/calendar',
    name: 'election-day.ics',
    data: new Buffer(event).toString('base64')
  }

  return exports.create([user.settings.email], subj, body, [attachment]);
}
