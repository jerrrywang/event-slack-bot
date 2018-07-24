var express = require("express");
const app = express();
const server = require("http").Server(app);
const projectId = process.env.projectId; //https://dialogflow.com/docs/agents#settings
const sessionId = 'quickstart-session-id';
const languageCode = 'en-US';
// Instantiate a DialogFlow client.
const dialogflow = require('dialogflow');
const sessionClient = new dialogflow.SessionsClient();
// Define session path
const sessionPath = sessionClient.sessionPath(projectId, sessionId);

const {RTMClient, WebClient} = require("@slack/client");
const token = process.env.BotUserToken;
const rtm = new RTMClient(token);
rtm.start();
const web = new WebClient(token);
web.channels.list()
    .then((res)=>{
        //console.log("res", res);
        const channel = res.channels.find((c) => c.is_member);
        if(channel){
            rtm.on("message", (event)=> {
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
                        console.log('Detected intent');
                        const result = responses[0].queryResult;
                        console.log("Result", result);
                        console.log(`  Query: ${result.queryText}`);
                        console.log(`  Parameters: `, result.parameters);
                        console.log(`  Response: ${result.fulfillmentText}`);
                        if(result.fulfillmentText === "reminder")
                        {
                            console.log("went inside");
                            let myDate = new Date(result.parameters.fields.date.stringValue);
                            let newDate = myDate.toUTCString();
                            console.log("Subject", result.parameters.fields.subject.stringValue);
                            web.chat.postMessage({
                                channel: event.channel,
                                as_user: true,
                                "text": `Please confirm \n Reminder: ${result.parameters.fields.subject.stringValue} \n When: ${newDate}`,
                                "attachments" : [
                                    {
                                    "text" : "Please Confirm",
                                    'fallback': 'You are unable to choose a game',
                                    'callback_id': 'slack-bot-jerry',
                                    'color': '#3AA3E3',
                                    'attachment_type': 'default',
                                    "actions":[
                                        {
                                        "name" : "Confirm",
                                        "text" : "Confirm",
                                        "type": "button",
                                        "value": "confirm"
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

                        }else {
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
        } else{
            console.log('This bot does not belong to any channel, invite it to at least one and try again');
        }
    });
app.get("/hi",(req,res)=>{
    res.send("hi")
});
app.post("/slack",(req,res)=>{
    console.log(">>>", JSON.parse(req.body.payload));
    res.end();
});
const port = 1337;
server.listen(port, () =>
{
    console.log(`Server listening on port ${port}!`);
});
