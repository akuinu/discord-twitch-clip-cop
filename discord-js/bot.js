const Discord = require('discord.js');
const client = new Discord.Client();
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

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.content.substring(0, 1) == '!') {
    if (isServerOwner(msg)) {
      let args = msg.content.substring(1).split(' ');
      var cmd = args[0];
      args = args.splice(1);
      switch(cmd) {
        case 'ping':
          msg.reply('Pong!');
          break;
        case 'info':
          msg.reply(info(msg.channel.id));
          break;
        case 'addStreamer':
          msg.reply(addStreamer(msg.channel.id, args[0]));
          break;
        case 'addChannel':
          msg.reply(addChannel(msg.channel.id, args[0]));
          break;
        case 'removeStreamer':
          msg.reply(removeStreamer(msg.channel.id, args[0]));
          break;
        case 'removeChannel':
          msg.reply(removeChannel(msg.channel.id));
          break;
      }
    }
  } else {
    if (inWatchList(msg.channel.id)) {
      var matches;
      while (matches = regex.exec(msg.content)) {
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
            if (!isAllowedToPost(msg.channel.id, obj)) {
              msg.delete();
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

function isServerOwner(msg){
  return msg.author.id === msg.channel.guild.ownerID;
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

client.login(config.discord_token);
