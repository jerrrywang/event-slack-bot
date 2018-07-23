const {RTMClient, WebClient} = require("@slack/client");
const token = process.env.BotUserToken;
const rtm = new RTMClient(token);
rtm.start();
const web = new WebClient(token);
web.channels.list()
    .then((res)=>{
        //console.log("res", res);
        console.log("res is", res);
        const channel = res.channels.find((c) => c.is_member);
        console.log("Channel is ", channel);
        if(channel){
            rtm.sendMessage("Hi slack team ", channel.id)
                .then((msg) => console.log(`Message sent to channel ${channel.name} with ts:${msg.ts}`))
                .catch((console.error));
            rtm.on("message", (event)=> {
                console.log("Event is ", event);
                if((event.subtype && event.subtype === "bot_message") || (!event.subtype && event.user === rtm.activeUserId)){
                    return;
                }
                console.log(`(channel:${event.channel}) ${event.user} says: ${event.text}`);
            });
        } else{
            console.log('This bot does not belong to any channel, invite it to at least one and try again');
        }
    });

