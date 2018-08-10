import express from 'express';
import bodyParser from 'body-parser';
import startAuth from './routes/auth';
import {addEvent} from './routes/calendarRoutes';
import User from './models/users';
import mongoose from 'mongoose';

const projectId = process.env.projectId; //https://dialogflow.com/docs/agents#settings
const sessionId = 'quickstart-session-id';
const languageCode = 'en-US';
const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.sessionPath(projectId, sessionId);

const {RTMClient, WebClient} = require("@slack/client");
const token = process.env.BotUserToken;
const rtm = new RTMClient(token);
rtm.start();
const web = new WebClient(token);

mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('connected', () => {
    console.log("Connected to MongoDB!")
});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
    res.send('Hi');
});

let oAuth2Client = null;
let listEvents = null;

web.channels.list()
    .then(res => {
        const channel = res.channels.find((c) => c.is_member);
        if (channel) {
            rtm.on("message", (event) => {
                if((event.subtype && event.subtype === "bot_message") || (!event.subtype && event.user === rtm.activeUserId)){
                    return;
                }
                console.log(`(channel:${event.channel}) ${event.user} says: ${event.text}`);

                const request = {
                    session: sessionPath,
                    queryInput: {
                        text: {
                            text: event.text,
                            languageCode: languageCode,
                        },
                    },
                };
                sessionClient
                    .detectIntent(request)
                    .then(responses => {
                        const result = responses[0].queryResult;
                        console.log("Result", result);

                        if (result.fulfillmentText === "greeting") {
                            web.chat.postMessage({
                                channel: event.channel,
                                "text": "Beep boop. I'm a bot that can create google calendar events for you. Have you used me before?",
                                "attachments" : [
                                    {
                                        'fallback': 'You are unable to choose a game',
                                        'callback_id': 'auth',
                                        'color': '#3AA3E3',
                                        'attachment_type': 'default',
                                        "actions":[
                                            {
                                                "name" : "Yes",
                                                "text" : "Yes",
                                                "type": "button",
                                                "value": "yes"
                                            },
                                            {
                                                "name" : "No",
                                                "text" : "No",
                                                "type": "button",
                                                "value": "no"
                                            },
                                        ]
                                    }]
                            })
                        }
                        else if (result.fulfillmentText === "reminder") {
                            let data = {
                                summary: result.parameters.fields.subject.stringValue,
                                start: (new Date(result.parameters.fields.date.stringValue)).toISOString(),
                            };
                            // console.log(result.parameters);
                            // let myDate = new Date(result.parameters.fields.date.stringValue);
                            // let newDate = myDate.toUTCString();
                            web.chat.postMessage({
                                channel: event.channel,
                                "text": `Please confirm \n Reminder: ${result.parameters.fields.subject.stringValue} \n When: ${data.start}`,
                                "attachments" : [
                                    {
                                        "text" : "Please Confirm",
                                        'fallback': 'You are unable to choose a game',
                                        'callback_id': 'schedule',
                                        'color': '#3AA3E3',
                                        'attachment_type': 'default',
                                        "actions":[
                                            {
                                                "name" : "confirm",
                                                "text" : "Confirm",
                                                "type": "button",
                                                "value": JSON.stringify(data),
                                            },
                                            {
                                                "name" : "Cancel",
                                                "text" : "Cancel",
                                                "type": "button",
                                                "value": "cancel"
                                            },
                                        ]
                                    }]
                            })
                        } else {
                            rtm.sendMessage(result.fulfillmentText, event.channel)
                                .then((res) => {
                                    // `res` contains information about the posted message
                                    console.log('Message sent: ', res.ts);
                                })
                                .catch(console.error);
                            if (result.intent) {
                                console.log(`  Intent: ${result.intent.displayName}`);
                            } else {
                                console.log(`  No intent matched.`);
                            }
                        }
                    })
                    .catch(err => {
                        console.error('ERROR:', err);
                    });
            });
        } else {
            console.log('This bot does not belong to any channel, invite it to at least one and try again');
        }
    });

app.post('/slack', (req, res) => {
    //need slack id
    if(req.body.payload) {
        console.log("JSON payload:", JSON.parse(req.body.payload))
    }
    else {
        console.log("No payload:", req.body);
    }

    if (req.body.payload) {
        let json = JSON.parse(req.body.payload);

        //If the user has not used this bot before
        if (json.callback_id === 'auth' && json.actions[0].value === 'no') {
            startAuth(json.user.id, json.channel.id, (oAuth, callback, url) => {
                oAuth2Client = oAuth;
                listEvents = callback;
                rtm.sendMessage(`I need to be able to change events on your calendar. Click this link to give me authorization: ${url}`, json.channel.id)
                    .then((res) => {
                        console.log('Message sent: ', res.ts);
                    })
                    .catch(err => console.log(err));
            });
        }

        //If the user confirms he/she wants to schedule an event
        else if (json.callback_id === 'schedule' && json.actions[0].name === 'confirm') {
            let jsonEvent = JSON.parse(json.actions[0].value);
            let event = {
                'summary': jsonEvent.summary,
                // 'location': req.body.location,
                // 'description': req.body.description,
                'start': {
                    'dateTime': jsonEvent.start,
                    // 'timeZone': req.body.sTimeZone,
                },
                'end': {
                    'dateTime': jsonEvent.end ? jsonEvent.end : jsonEvent.start,
                //     'timeZone': req.body.eTimeZone,
                }
            };
            startAuth(json.user.id, null, (oAuth2Client) => {
                addEvent(oAuth2Client, event);
            });
        }
    }

});

app.get('/authCode', (req, res) => {
    oAuth2Client.getToken(req.query.code, (err, token) => {
        if (err) return console.log(err);
        oAuth2Client.setCredentials(token);

        let jsonState = JSON.parse(req.query.state);
        let newUser = new User ({
            slackId: jsonState.id,
            token: token
        });
        newUser.save()
            .then(() => {
                listEvents(oAuth2Client);
                res.send('OK');
                rtm.sendMessage('Thanks! I can now schedule events for you!', jsonState.channel)
                    .then((res) => {
                        console.log('Message sent: ', res.ts);
                    })
                    .catch(console.error);
            })
            .catch(err => {
                console.log(err);
                res.send("Oops");
            });
    });
});

app.post('/addEvent', (req, res) => {
    let event = {
        'summary': req.body.summary,
        'location': req.body.location,
        'description': req.body.description,
        'start': {
            'dateTime': (new Date(req.body.sDateTime)).toISOString(),
            'timeZone': req.body.sTimeZone,
        },
        'end': {
            'dateTime': (new Date(req.body.eDateTime)).toISOString(),
            'timeZone': req.body.eTimeZone,
        }
    };
    addEvent(oAuth2Client, event);
});



app.listen(3000);