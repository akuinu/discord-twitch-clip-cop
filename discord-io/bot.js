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
          case 'info':
            bot.sendMessage({
              to: channelID,
              message: info(channelID)
            });
            break;
          case 'addStreamer':
            bot.sendMessage({
              to: channelID,
              message: addStreamer(channelID, args[0])
            });
            break;
          case 'addChannel':
            bot.sendMessage({
              to: channelID,
              message: addChannel(channelID, args[0])
            });
            break;
          case 'removeStreamer':
            bot.sendMessage({
              to: channelID,
              message: removeStreamer(channelID, args[0])
            });
            break;
          case 'removeChannel':
            bot.sendMessage({
              to: channelID,
              message: removeChannel(channelID)
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

function getAllowedStreamersString(channelID){
  return config.rules[channelID].allowedStreamers.join(', ');
}

function info(channelID){
  if (inWatchList) {
    return "Channel is in watchlist. Allowed streamers: " + getAllowedStreamersString(channelID);
  }
  return "Current channel is not is watchlist.";
}

function addStreamer(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  if (inWatchList(channelID)) {
    if (config.rules[channelID].allowedStreamers.indexOf(streamer) == -1) {
      config.rules[channelID].allowedStreamers.push(streamer);
      saveConfig();
      return "Streamer " + streamer + " has been added to Allowed Streamers in this channel.";
    }
    return "Streamer " + streamer + " is alreaddy in Allowed Streamers in this channel.";
  }
  return "This Channel is not in watchlist. Use !addChannel <streamer>";
}

function removeStreamer(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  if (inWatchList(channelID)) {
    var index = config.rules[channelID].allowedStreamers.indexOf(streamer);
    if (index !== -1) {
      config.rules[channelID].allowedStreamers.splice(index, 1);
      if (config.rules[channelID].allowedStreamers.length === 0) {
        removeChannel(channelID);
        return "Streamer " + streamer + " was last allowed streamer, removed channel form watchlist.";
      }else {
        saveConfig();
        return "Streamer " + streamer + " has been removed to Allowed Streamers in this channel.";
      }
    }
    return "Streamer " + streamer + "'s clips are not allowed here.";
  }
  return "This Channel is not in watchlist.";
}

function addChannel(channelID, streamer){
  streamer = streamer.trim().toLowerCase();
  if (!inWatchList(channelID)) {
    let rule = {"allowedStreamers":[streamer]};
    config.rules[channelID] = rule;
    saveConfig();
    return "Channel added to watchlist. Allowed streamer: " + streamer;
  }
  return "Channel already in watchlist. Allowed streamers: " + getAllowedStreamersString(channelID) + "\n\r To add use !addStreamer <streamer>";
}

function removeChannel(channelID){
  delete config.rules[channelID];
  saveConfig();
  return "Channel has been removed from the watchlist.";
}

function saveConfig(){
  var json = JSON.stringify(config);

  fs.writeFile('./config.json', json, 'utf8', (error) => {console.log(error);  });
}
