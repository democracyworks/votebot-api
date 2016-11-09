var resutil = require('../lib/resutil');
var express = require('express');
var model = require('../models/conversation');
var user_model = require('../models/user');
var bot_model = require('../models/bot');
var message_model = require('../models/message');
var auth = require('../lib/auth');
var log = require('../lib/logger');
var error = require('../lib/error');
var config = require('../config');
var l10n = require('../lib/l10n');

exports.hook = function(app)
{
	app.post('/conversations', create);
	app.post('/conversations/:id/messages', new_message);
	app.post('/conversations/incoming', incoming);
	app.get('/conversations/:id/new', poll);
};

var create = function(req, res)
{
	var user_id = config.bot.user_id;
	var data = req.body;

	if (!data.options)
		data.options = {};

	data.options.force_active = true;

	model.create(user_id, data)
		.then(function(convo) {
			resutil.send(res, convo);
		})
		.catch(function(err) {
            resutil.error(res, 'Problem starting conversation', err);
		});
};

var new_message = function(req, res)
{
	var user_details = req.body.user;
	var data = req.body.message;
	var conversation;
	var conversation_id = req.params.id;
	var user_id = null;
	user_model.get_by_username(user_details.username).then(function(user) {
		user_id = user.id;
		return model.get(conversation_id)
	})
	.then(function(_conversation) {
		conversation = _conversation;

		if(!conversation) throw error('Conversation '+conversation_id+' not found', {code: 404});
		
		return message_model.create(user_id, conversation_id, data)
	})
	.then(function(message) {

		if (config.app.disabled)
			return message_model.create(
						config.bot.user_id,
						conversation.id,
						{ body: l10n('msg_disabled', conversation.locale) }
					)

		bot_model.next(user_id, conversation, message)
		resutil.send(res, message);
	})
	.catch(function(err) {
        resutil.error(res, 'Problem sending message', err);
	});
};

var incoming = function(req, res)
{
	var data = req.body;
	log.info('incoming: ', JSON.stringify(data));
	message_model.incoming_message(data)
		.then(function() {
			// acknowledge response
			// Twilio expects TwiML or plain text
			resutil.send(res, '<?xml version="1.0" encoding="UTF-8" ?><Response></Response>', {content_type: 'application/xml'});
		})
		.catch(function(err) {
			log.error('messages: incoming: ', err);
			resutil.error(res, 'Problem receiving message', err);
		});
};

var poll = function(req, res)
{
	var user_id = config.bot.user_id;
	var conversation_id = req.params.id;
	var last_id = req.query.last_id || 0;
	var username = req.query.username || '';
	model.poll(user_id, conversation_id, last_id, username)
		.then(function(messages) {
			resutil.send(res, messages);
		})
		.catch(function(err) {
			resutil.error(res, 'Problem grabbing messages', err);
		});
};