let Discord = require('discord.io');
const config = require('./config.json');
const http = require('http');
const https = require('https');
const regex = /(?:https\:\/\/)?(?:clips\.twitch\.tv)\/(\w*)/gmi;
const fs = require('fs');
const optionsTemplate = {
  host: 'api.twitch.tv',
  port: 443,
  path: '/kraken/clips/',
  method: 'GET',
  headers: {
    'Accept': 'application/vnd.twitchtv.v5+json',
    'Client-ID': config.twitch_clientID
  }
};
// Initialize Discord Bot
let bot = new Discord.Client({
   token: config.discord_token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {

    if (message.substring(0, 1) == '!') {
      if (isServerOwner(userID,channelID)) {
        let args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        switch(cmd) {
          case 'addStreamer':
            addStreamer(channelID, args[0])
            bot.sendMessage({
              to: channelID,
              message: config.rules[channelID].allowedStreamers
            });
            break;
          case 'addChannel':
            addChannel(channelID, args[0]);
            bot.sendMessage({
              to: channelID,
              message: config.rules[channelID]
            });
            break;
          case 'removeStreamer':
            removeStreamer(channelID, args[0]);
            bot.sendMessage({
              to: channelID,
              message: config.rules[channelID].allowedStreamers
            });
            break;
          case 'removeChannel':
            removeChannel(channelID);
            bot.sendMessage({
              to: channelID,
              message: "Channel has been removed form the watch list."
            });
            break;
           }
        }
     } else {
       if (inWatchList(channelID)) {
         var matches;
         while (matches = regex.exec(message)) {
             var options = Object.assign({}, optionsTemplate);
             options.path += matches[1]
             var port = options.port == 443 ? https : http;
             var req = port.request(options, function(res){
                 var output = '';
                 console.log(options.host + ':' + res.statusCode);
                 res.setEncoding('utf8');
                 res.on('data', function (chunk) {
                     output += chunk;
                 });
                 res.on('end', function() {
                     var obj = JSON.parse(output);
                     if (!isAllowedToPost(channelID, obj)) {
                       bot.deleteMessage({
                         channelID: channelID,
                         messageID: evt.d.id
                       }, function (err) {
                         console.log(err)
                       });
                     }
                  });
             });

             req.on('error', function(err) {
                 //res.send('error: ' + err.message);
             });

             req.end();
           }

       }
     }
});

function inWatchList(channelID){
  // TODO: make a proper dynamic system with DB
  if (config.rules.hasOwnProperty(channelID)) {
    return true;
  }
  return false;
}

function isAllowedToPost(channelID, clipInfo){
  // TODO: make a proper dynamic system with DB and maybe allow server owner to post anything
  if(clipInfo.hasOwnProperty('error')){
    console.log("Invalid slug" + clipInfo);
    return false;
  } else {
    return config.rules[channelID].allowedStreamers.indexOf(clipInfo.broadcaster.name) > -1;
  }
  return false;
}

function isServerOwner(userID, channelID){
  return userID === bot.servers[bot.channels[channelID].guild_id].owner_id;
}

function addStreamer(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  if (config.rules[channelID].allowedStreamers.indexOf(streamer) == -1) {
    config.rules[channelID].allowedStreamers.push(streamer);
    saveConfig();
  }
}

function removeStreamer(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  var index = config.rules[channelID].allowedStreamers.indexOf(streamer);
  if (index !== -1) {
    config.rules[channelID].allowedStreamers.splice(index, 1);
    saveConfig();
  }
}

function addChannel(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  if (!inWatchList(channelID)) {
    let rule = {"allowedStreamers":[streamer]};
    config.rules[channelID] = rule;
    saveConfig();
  }
}

function removeChannel(channelID){
  delete config.rules[channelID];
  saveConfig();
}

function saveConfig(){
  var json = JSON.stringify(config);

  fs.writeFile('./config.json', json, 'utf8', (error) => {console.log(error);  });
}
