# event-slack-bot

I created a slack bot that schedules google calendar events for a user. 

Technologies used: <b>Node.js, Express.js, DialogFlow, MongoDB</b>
APIs used: <b>Slack Real Time Messaging API, Google Calendar API</b>

I used the Slack Real Time Messaging API to receive user commands. Then, I trained a DialogFlow agent to process natural language user intents. Finally, I made requests to the Google Calendar API to schedule meetings and reminders on the user’s Google Calendar. I saved user data in MongoDB, including OAuth tokens and pending requests. 
