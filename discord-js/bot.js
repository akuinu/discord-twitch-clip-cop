const Discord = require('discord.js');
const client = new Discord.Client();
const http = require('http');
const https = require('https');
const regex = /(?:https\:\/\/)?(?:clips\.twitch\.tv)\/(\w*)/gmi;
const fs = require('fs');

class Settings{
  //const fs = require('fs');
  constructor(){
    const config = require('./config.json');
    this.discord_token = config.discord_token;
    this.twitch_clientID = config.twitch_clientID;
    this.rules = config.rules;
  }

  getDiscordToken(){
    return this.discord_token;
  }
  getTwitchToken(){
    return this.twitch_clientID;
  }
  inWatchList(channelID) {return this.rules.hasOwnProperty(channelID); }
  isAllowedToPost(channelID, clipInfo){
    if(clipInfo.hasOwnProperty('error')){
      console.log("Invalid slug" + clipInfo);
      return false;
    } else {
      return this.rules[channelID].allowedStreamers.indexOf(clipInfo.broadcaster.name) > -1;
    }
  }
  getAllowedStreamersString(channelID){
    return this.rules[channelID].allowedStreamers.join(', ');
  }
  info(channelID){
    if (settings.inWatchList(channelID)) {
      return `Channel is in watchlist. Allowed streamers: ${settings.getAllowedStreamersString(channelID)}`;
    }
    return "Current channel is not is watchlist.";
  }

  addStreamer(channelID, streamer){
    streamer = streamer.trim().toLowerCase();
    if (this.inWatchList(channelID)) {
      if (this.rules[channelID].allowedStreamers.indexOf(streamer) == -1) {
        this.rules[channelID].allowedStreamers.push(streamer);
        this.saveConfig();
        return `Streamer ${streamer} has been added to Allowed Streamers in this channel.`;
      }
      return `Streamer ${streamer} is alreaddy in Allowed Streamers in this channel.`;
    }
    return "This Channel is not in watchlist. Use !addChannel <streamer>";
  }

  removeStreamer(channelID, streamer){
    streamer = streamer.trim().toLowerCase();
    if (this.inWatchList(channelID)) {
      var index = this.rules[channelID].allowedStreamers.indexOf(streamer);
      if (index !== -1) {
        this.rules[channelID].allowedStreamers.splice(index, 1);
        this.saveConfig();
        if (this.rules[channelID].allowedStreamers.length === 0) {
          return `Streamer ${ streamer} was last allowed streamer, removed channel form watchlist.`;
        }else {
          return `Streamer ${streamer} has been removed to Allowed Streamers in this channel.`;
        }
      }
      return `Streamer ${streamer}'s clips are not allowed here.`;
    }
    return "This Channel is not in watchlist.";
  }

  addChannel(channelID, streamer){
    streamer = streamer.trim().toLowerCase();
    if (!settings.inWatchList(channelID)) {
      let rule = {"allowedStreamers":[streamer]};
      this.rules[channelID] = rule;
      this.saveConfig();
      return `Channel added to watchlist. Allowed streamer: ${streamer}`;
    }
    return `Channel already in watchlist. Allowed streamers: ${settings.getAllowedStreamersString(channelID)} \n To add use !addStreamer <streamer>`;
  }

  removeChannel(channelID){
    delete this.rules[channelID];
    this.saveConfig();
    return "Channel has been removed from the watchlist.";
  }

  saveConfig(){
    var json = JSON.stringify(this);

    fs.writeFile('./config.json', json, 'utf8', (error) => {console.log(error);  });
  }
}

let settings = new Settings();
const optionsTemplate = {
  host: 'api.twitch.tv',
  port: 443,
  path: '/kraken/clips/',
  method: 'GET',
  headers: {
    'Accept': 'application/vnd.twitchtv.v5+json',
    'Client-ID': settings.getTwitchToken()
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
          msg.reply(settings.info(msg.channel.id));
          break;
        case 'addStreamer':
          msg.reply(settings.addStreamer(msg.channel.id, args[0]));
          break;
        case 'addChannel':
          msg.reply(settings.addChannel(msg.channel.id, args[0]));
          break;
        case 'removeStreamer':
          msg.reply(settings.removeStreamer(msg.channel.id, args[0]));
          break;
        case 'removeChannel':
          msg.reply(settings.removeChannel(msg.channel.id));
          break;
      }
    }
  } else {
    if (settings.inWatchList(msg.channel.id)) {
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
            if (!settings.isAllowedToPost(msg.channel.id, obj)) {
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

function isServerOwner(msg){
  return msg.author.id === msg.channel.guild.ownerID;
}

client.login(settings.getDiscordToken());
