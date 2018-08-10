const fs = require('fs');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

import {listEvents} from './calendarRoutes';
import mongoose from 'mongoose';
import User from './models/users';

let ngrok = 'https://aaa862b4.ngrok.io';

const startAuth = (slackId, channel, passOAuth) => fs.readFile('credentials.json', (err, content) => {
    console.log('in start Auth');
    console.log('credentials:', JSON.parse(content));
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), listEvents, slackId, channel, passOAuth);
    console.log('slack id in strt atuh:', slackId)
});

const authorize = (credentials, listEvents, id, channel, passOAuth) => {
    console.log('slack id in auth:', id)
    console.log('in authorize');
    const {client_secret, client_id} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, `${ngrok}/authCode`);
    console.log('oauth:', oAuth2Client);
    // Check if we have previously stored a token.
    User.findOne({slackId: id})
        .then(user => {
            if (!user) {
                console.log('no user found');
                return getAccessToken(oAuth2Client, listEvents, passOAuth, id, channel);
            } else {
                oAuth2Client.setCredentials(user.token);
                oAuth2Client.on('tokens', (tokens) => {
                    if (tokens.refresh_token) {
                       user.token = tokens;
                       user.save()
                           .catch(err => console.log(err));
                    }
                });
                listEvents(oAuth2Client);
                passOAuth(oAuth2Client, null);
            }
        })
};

const getAccessToken = (oAuth2Client, listEvents, passOAuth, id, channel) => {
    console.log('slackid in get access token:', id);
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: JSON.stringify({
            id: id,
            channel: channel
        })
    });
    passOAuth(oAuth2Client, listEvents, authUrl);
};

export default startAuth;