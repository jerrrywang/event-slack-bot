const {google} = require('googleapis');

//List all events
const listEvents = (auth) => {
    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        if (events.length) {
            console.log('Upcoming 10 events:');
            events.map((event, i) => {
                const start = event.start.dateTime || event.start.date;
                console.log(`${start} - ${event.summary}`);
            });
        } else {
            console.log('No upcoming events found.');
        }
    });
};

//Add an event
const addEvent = (auth, event) => {
    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.insert({
            auth: auth,
            calendarId: 'primary',
            resource: event,
        }, (err, event) => {
            if (err) return console.log("Error contacting Calendar service:", err);
            console.log('Event created: %s', event.htmlLink);
        }
    )
};

export {listEvents, addEvent};