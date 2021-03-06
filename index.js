console.log('KojimaBot is starting...');

const Discord = require('discord.js');
const client = new Discord.Client({
    disableMentions: 'everyone',
    ws: {
        intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES', 'GUILD_BANS', 'GUILD_WEBHOOKS', 'DIRECT_MESSAGES']
    }
});
const { Client: pgClient } = require('pg');
const fetch = require('node-fetch');
const DBL = require('dblapi.js');
const dbl = new DBL(process.env.DBLTOKEN, client);

const kojimaizer = require('./kojimaizer');
const katakanaifier = require('./katakanaifier');
const walkmanizer = require('./walkmanize');
const { intervalToMin, minToInterval } = require('./intervalHelper');

const postgresdate = d => `${d.getUTCFullYear()}-${('00'+(d.getUTCMonth()+1)).slice(-2)}-${('00'+d.getUTCDate()).slice(-2)} ${('00'+d.getUTCHours()).slice(-2)}:${('00'+d.getUTCMinutes()).slice(-2)}:${('00'+d.getUTCSeconds()).slice(-2)}`;

let displayBotGuilds = client => console.log(client.guilds.cache.map(g=>({ id: g.id, name: g.name, memberCount: g.memberCount }))); 

if (process.env.STATUS_WEBHOOK_ID && process.env.STATUS_WEBHOOK_TOKEN) {
    const statusWebhook = new Discord.WebhookClient(process.env.STATUS_WEBHOOK_ID, process.env.STATUS_WEBHOOK_TOKEN);

    statusWebhook.send("KojimaBot is starting...");

    process.on('cleanup', ()=>{
        statusWebhook.send('KojimaBot exiting...');
        console.log('KojimaBot process exiting...');
    });

    process.on('exit', ()=>{
        process.emit('cleanup');
    });

    process.on('SIGINT',  ()=>{
        statusWebhook.send('KojimaBot process caught SIGINT');
        process.exit(2);
    });

    process.on('uncaughtException', e=>{
        console.error(e);
        statusWebhook.send('KojimaBot encountered an exception, exiting...',
            new Discord.MessageAttachment(Buffer.from(
                `KojimaBot error log\nError: ${e.name} (${e.code})\nError type: ${e.type}\nStack trace:\n${e.stack}`
            ), `log-${new Date().toUTCString()}.txt`)
        );
        process.exit(99);
    });

    displayBotGuilds = client => {
        let guilds = client.guilds.cache.map(g=>({ id: g.id, name: g.name, memberCount: g.memberCount, iconURL: g.iconURL({format: 'png', dynamic: true}) }));
        statusWebhook.send(`Guild membership report: ${guilds.reduce((a,c)=>a+c.memberCount,0)} members in ${guilds.length} guilds`,
            new Discord.MessageAttachment(Buffer.from(JSON.stringify({
                totalMemberCount: guilds.reduce((a,c)=>a+c.memberCount,0),
                guildCount: guilds.length,
                guilds
            })), 'servers.json')
        );
    }
}

const pgclient = new pgClient({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pgclient.connect();

/**
 * @typedef {Object} GuildInfo
 * @property {String} id - Guild ID
 * @property {Discord.GuildChannel} destChannel - Destination channel ID/object
 * @property {String} lastUsername - Username of last member to send a message
 * @property {Boolean} entermessage - If join messages are enabled
 * @property {Boolean} leavemessage - If leave messages are enabled
 * @property {Number} greetInt - Greeting interval in minutes
 * @property {Date} greetedLast - Last time a greeting was sent
 * @property {Boolean} jpenabled - If japanese mode is enabled
 */

/**
 * @type {GuildInfo[]}
 */
let guilds = [];

const postBotStats = () => {
    try {
        let totalMembers = client.guilds.cache.reduce((a,c)=>a+c.memberCount,0);
        let totalGuilds = client.guilds.cache.size;
        console.log(`Bot stats: ${totalMembers} members in ${totalGuilds} guilds`);
        // dbl (top.gg) handled by module
        // discordbotlist.com
        fetch(`https://discordbotlist.com/api/v1/bots/${client.user.id}/stats`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.DBOTTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                users: totalMembers,
                guilds: totalGuilds
            })
        });
        // discord.bots.gg
        fetch(`https://discord.bots.gg/api/v1/bots/${client.user.id}/stats`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.BOTSGGTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildCount: totalGuilds
            })
        });
        // bots.ondiscord.xyz
        fetch(`https://bots.ondiscord.xyz/bot-api/bots/${client.user.id}/guilds`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.BOTSONDISCORDTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildCount: totalGuilds
            })
        });
    } catch (e) {
        console.error('Exception in postBotStats:', e);
    }
};

dbl.on('posted', postBotStats);

client.once('ready', () => {
    client.user.setActivity("Hi Sponge Bob");
    console.log('Login success');
    displayBotGuilds(client);
    postBotStats();
});

/**
 * Send a message to a guild.
 * @param {GuildInfo} guild - Guild to send messages to.
 * @param {String} message - Message to send (english) 
 * @param {String} messagejp - Message to send (japanese)
 */
const sendMessageInGuild = (guild, message, messagejp) => {
    try {
        //console.log(`Sending a message to guild ${guild}:`)
        //console.log('Message(en):',message);
        //console.log('Message(jp):',messagejp);
        if (guild.jpenabled && guild.destChannel.guild.me.hasPermission('MANAGE_WEBHOOKS')) {
            guild.destChannel.fetchWebhooks().then(webhooks=>{
                if (webhooks.size < 1) return guild.destChannel.createWebhook('小島秀夫', {avatarURL: 'https://kojimaize.xyz/img/kojimajp.jpg'});
                return webhooks.first();
            }).then(webhook=>{
                webhook.send(messagejp, {
                    username: '小島秀夫',
                    avatarURL: 'https://kojimaize.xyz/img/kojimajp.jpg',
                });
            }).catch(e=>console.error(`Error sending message: ${e}`));
        } else {
            guild.destChannel.send(message).catch(e=>console.error(`Error sending message: ${e}`));
        }
    } catch (e) {
        console.error('Exception in sendMessageInGuild:', e);
    }
}

setInterval(()=>{
    try {
        let count = 0;
        console.log(`Evaluating whether to send messages to ${guilds.length} guilds`);
        guilds.forEach((guild, idx) => {
            if (guild.destChannel && guild.lastUsername && guild.greetInt && guild.greetedLast && Math.floor(Math.abs(new Date() - guild.greetedLast)/60000) >= guild.greetInt && guild.greetInt > 0) {
                count++;
                if (typeof guild.destChannel === 'string') {
                    //console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
                    client.guilds.fetch(guild.id).then(guildobj=>{
                        let bak = guild.destChannel;
                        guilds[idx].destChannel = guildobj.channels.resolve(guild.destChannel);
                        if (!guild.destChannel) {
                            guild.destChannel = bak;
                            console.error(`Couldn't resolve channel ${guild.destChannel} in ${guild.id}.`);
                            return;
                        }
                        //guild.destChannel.send(kojimaizer(guild.lastUsername));
                        katakanaifier(guild.lastUsername).then(jp=>{
                            sendMessageInGuild(guild, kojimaizer(guild.lastUsername), `こんにちは ${jp}`);
                        });
                    }).catch(()=>console.error(`Couldn't fetch guild ${guild.id}, maybe the bot was kicked?`));
                } else {
                    katakanaifier(guild.lastUsername).then(jp=>{
                        sendMessageInGuild(guild, kojimaizer(guild.lastUsername), `こんにちは ${jp}`);
                    });
                }
                guilds[idx].greetedLast = new Date();
                pgclient.query(`UPDATE guilds SET greetedlast='${postgresdate(new Date())}' WHERE gid='${guild.id}';`);
            }
        });
        console.log(`Sent messages to ${count} guilds`);
    } catch (e) {
        console.error('Exception in greet interval handler:', e);
    }
}, 60000);

client.on('guildMemberAdd', member => {
    try {
        console.log('Guild recieved new member!');
        if (Date.now() - member.user.createdAt < 1000*60*60*24) return; // if account is less than a day old do not announce (prevents join username abuse)
        let djsguild = member.guild;
        let guildObjIdx = guilds.findIndex(fguild=>fguild.id===djsguild.id);
        if (guildObjIdx === -1 || !guilds[guildObjIdx].entermessage) return;

        let guild = guilds[guildObjIdx];

        if (guild.destChannel) {
            if (typeof guild.destChannel === 'string') {
                //console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
                client.guilds.fetch(guild.id).then(guildobj=>{
                    guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guild.destChannel);
                    //guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
                    katakanaifier(guild.lastUsername).then(jp=>{
                        sendMessageInGuild(guild, kojimaizer(member.user.username) + ` <@!${member.id}>`, `こんにちは ${jp} <@!${member.id}>`);
                    });
                });
            } else {
                //guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
                katakanaifier(guild.lastUsername).then(jp=>{
                    sendMessageInGuild(guild, kojimaizer(member.user.username) + ` <@!${member.id}>`, `こんにちは ${jp} <@!${member.id}>`);
                });
            }
        }
    } catch (e) {
        console.error('Exception in guildMemberAdd handler:', e);
    }
});

client.on('guildMemberRemove', member => {
    try {
        console.log('Guild lost member...');
        if (Date.now() - member.user.createdAt < 1000*60*60*24) return; // if account is less than a day old do not announce (prevents join username abuse)
        let djsguild = member.guild;
        let guildObjIdx = guilds.findIndex(fguild=>fguild.id===djsguild.id);
        if (guildObjIdx === -1 || !guilds[guildObjIdx].leavemessage) return;

        let guild = guilds[guildObjIdx];

        if (guild.destChannel) {
            if (typeof guild.destChannel === 'string') {
                //console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
                client.guilds.fetch(guild.id).then(guildobj=>{
                    guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guild.destChannel);
                    //guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
                    katakanaifier(guild.lastUsername).then(jp=>{
                        sendMessageInGuild(guild, kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`, `さようなら ${jp} (${member.user.username}#${member.user.discriminator})`);
                    });
                });
            } else {
                //guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
                katakanaifier(guild.lastUsername).then(jp=>{
                    sendMessageInGuild(guild, kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`, `さようなら ${jp} (${member.user.username}#${member.user.discriminator})`);
                });
            }
        }
    } catch (e) {
        console.error('Exception in guildMemberRemove handler:', e);
    }
});

client.on('message', message => {
    try {
        if (!message) return;
        let guildObjIdx = message.guild ? guilds.findIndex(guild=>guild.id===message.guild.id) : -2;
        if (guildObjIdx === -1) {
            guildObjIdx = guilds.length;
            guilds.push({
                id: message.guild.id,
                destChannel: null,
                lastUsername: null,
                entermessage: false,
                leavemessage: false,
                greetInt: 15,
                greetedLast: new Date(),
                jpenabled: false
            });
            pgclient.query(`INSERT INTO guilds (gid, cid) VALUES ('${message.guild.id}','0');`);
        }
        //if (message.channel.type==='dm') console.log('Got DM');
        if (((message.guild && message.member && message.mentions.has(message.guild.me)) || message.channel.type==='dm') && message.content.indexOf('help') > -1 && !message.author.bot) {
            //console.log('Sending help');
            const prefix = `@HIDEO_KOJIMA`;
            const helpEmbed = new Discord.MessageEmbed()
                .setColor('#1DA1F2')
                .setTitle('HIDEO_KOJIMA Help')
                .setURL('https://kojimaize.xyz/')
                .setDescription(`${kojimaizer(message.author.username)}\n\nHere Are My Commands:`)
                .setThumbnail('https://kojimaize.xyz/img/kojima.jpg')
                .addFields(
                    { name: `${prefix} help`, value: 'DM My Commands To You' },
                    { name: `help (DMs)`, value: 'DM My Commands To You' },
                    { name: `${prefix} setchannel \`<channel>\``, value: 'Set The Channel Where I Send Messages To' },
                    { name: `${prefix} togglewelcome`, value: 'Enable Or Disable Welcome Messages' },
                    { name: `${prefix} togglefarewell`, value: 'Enable Or Disable Leave Messages' },
                    { name: `${prefix} setinterval \`<interval>\``, value: 'Set Random User Greet Interval To <interval> - Set To 0 To Disable Random Greetings' },
                    { name: `${prefix} togglejp`, value: 'Toggle Japanese Mode - Requires KojimaBot To Have Manage Webhooks Permissions' },
                    { name: '\u200B', value: '\u200B' },
                    { name: 'Vote Greets', value: 'If You Vote For KojimaBot On [Top.gg](https://top.gg/bot/753757823535677561) Or [DiscordBotList](https://discord.ly/hideokojima) You Will Recieve A Credit.'},
                    { name: `${prefix} hi`, value: 'Have HIDEO Greet You In Exchange For 1 Credit' },
                    { name: `${prefix} listen \`<songname>\``, value: 'Play A Song On My Sony Walkman In Exchange For 2 Credits'},
                    { name: `checkbalance (DMs)`, value: 'See How Many Credits You Have' },
                );
            if (message.guild) message.author.send(helpEmbed).then(()=>message.react('📤').catch(()=>console.error("Couldn't react"))).catch(()=>console.error("Couldn't send DM"));
            else message.channel.send(helpEmbed);
            return;
        } else if (message.channel.type==='dm' && message.content.indexOf('checkbalance') > -1 && !message.author.bot) {
            //console.log('Sending balance');
            pgclient.query(`SELECT * FROM votes WHERE uid='${message.author.id}';`, (err, res)=>{
                if (err) throw err;
                console.log(`Vote row count for ${message.author.id} is ${res.rows.length}`);
                let votecount = 0;
                if (res.rows.length > 0) {
                    votecount = res.rows[0].count;
                }
                message.channel.send(`Current Balance Is ${votecount} Credits\n\nVote On Top.gg https://top.gg/bot/753757823535677561 Or DiscordBotList https://discord.ly/hideokojima To Get More`);
            })
        } else if (message.guild && message.member && message.mentions.has(message.guild.me) && message.member.permissions.has('MANAGE_GUILD', true) && !message.author.bot) {
            if (message.content.indexOf('setchannel') > -1) {
                //console.log('Setting channel');
                let channel = message.mentions.channels.first() || message.channel;
                let perms = new Discord.Permissions(channel.permissionsFor(message.guild.me).bitfield);
                if (perms.has('SEND_MESSAGES')) {
                    //console.log(`Set channel for ${guilds[guildObjIdx].id} to ${channel.id}`);
                    guilds[guildObjIdx].destChannel = channel;
                    message.channel.send(`Hi Ad Min\n\nI Set The Channel To ${message.mentions.channels ? '<#'+channel.id+'>' : 'This One'}`).catch(e=>console.error(`Error sending message: ${e}`));
                    pgclient.query(`UPDATE guilds SET cid='${channel.id}' WHERE gid='${guilds[guildObjIdx].id}';`);
                } else {
                    //console.log("Didn't set channel b/c it is readonly")
                    message.author.send(`Hi Ad Min\n\nI Can't Send Messages In #${channel.name} So I Did Not Change The Channel`).catch(e=>console.error(`Error sending message: ${e}`));
                }
                return;
            } else if (message.content.indexOf('togglewelcome') > -1) {
                guilds[guildObjIdx].entermessage = !guilds[guildObjIdx].entermessage;
                //console.log(`${guilds[guildObjIdx].entermessage ? 'Enabled' : 'Disabled'} welcome for ${guilds[guildObjIdx].id}`);
                message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].entermessage ? 'Now' : 'Not'} Greet People When They Join`).catch(e=>console.error(`Error sending message: ${e}`));
                pgclient.query(`UPDATE guilds SET entermsg='${guilds[guildObjIdx].entermessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
                return;
            } else if (message.content.indexOf('togglefarewell') > -1) {
                guilds[guildObjIdx].leavemessage = !guilds[guildObjIdx].leavemessage;
                //console.log(`${guilds[guildObjIdx].leavemessage ? 'Enabled' : 'Disabled'} farewell for ${guilds[guildObjIdx].id}`);
                message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].leavemessage ? 'Now' : 'Not'} Greet People When They Leave`).catch(e=>console.errpr(`Error sending message: ${e}`));
                pgclient.query(`UPDATE guilds SET leavemsg='${guilds[guildObjIdx].leavemessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
                return;
            } else if (message.content.indexOf('togglejp') > -1) {
                guilds[guildObjIdx].jpenabled = !guilds[guildObjIdx].jpenabled;
                //console.log(`${guilds[guildObjIdx].jpenabled ? 'Enabled' : 'Disabled'} japanese mode for ${guilds[guildObjIdx].id}`);
                message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].jpenabled ? 'Now' : 'Not'} Greet People In Japanese${guilds[guildObjIdx].jpenabled ? '\nMake Sure To Give Me Manage Webhooks Permissions' : ''}`).catch(e=>console.log(`Error sending message: ${e}`));
                pgclient.query(`UPDATE guilds SET jpenabled='${guilds[guildObjIdx].jpenabled}' WHERE gid='${guilds[guildObjIdx].id}';`);
                return;
            } else if (message.content.indexOf('setinterval') > -1) {
                let interv = intervalToMin(message.content.split(' ').pop());
                if (isNaN(interv)) return;
                guilds[guildObjIdx].greetInt = interv;
                //console.log(`Set greet interval for ${guilds[guildObjIdx].id} to ${interv} minutes`);
                message.channel.send(`Hi Ad Min\n\nI Will ${interv > 0 ? `Say Hi Every ${minToInterval(interv)}` : 'Not Say Hi Randomly'}`).catch(e=>console.log(`Error sending message: ${e}`));
                pgclient.query(`UPDATE guilds SET greetinterval=${guilds[guildObjIdx].greetInt} WHERE gid='${guilds[guildObjIdx].id}';`);
                return;
            }
        }
        if (message.guild) {
            if ((message.member && (message.member.id === message.guild.me.id)) || message.webhookID || !guilds[guildObjIdx].destChannel) return;
            let cidtest = guilds[guildObjIdx].destChannel;
            if (typeof cidtest !== 'string') cidtest = cidtest.id;
            if (message.channel.id !== cidtest) return;

            if (message.mentions.has(message.guild.me) && message.content.indexOf('hi') > -1 && message.content.indexOf('listen ') < 0) {
                pgclient.query(`SELECT * FROM votes WHERE uid='${message.author.id}';`, (err, res)=>{
                    if (err) throw err;
                    //console.log(`Vote row count for ${message.author.id} is ${res.rows.length}`);
                    let votecount = 0;
                    if (res.rows.length > 0) {
                        votecount = res.rows[0].count;
                    }
                    if (votecount > 0) {
                        if (typeof guilds[guildObjIdx].destChannel === 'string') {
                            //console.log(`Resolving channel ${guilds[guildObjIdx].destChannel} for guild ${guilds[guildObjIdx].id}`);
                            client.guilds.fetch(guilds[guildObjIdx].id).then(guildobj=>{
                                let bak = guilds[guildObjIdx].destChannel;
                                guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guilds[guildObjIdx].destChannel);
                                if (!guilds[guildObjIdx].destChannel) {
                                    guilds[guildObjIdx].destChannel = bak;
                                    console.log(`Couldn't resolve channel ${guilds[guildObjIdx].destChannel} in ${guilds[guildObjIdx].id}.`);
                                    return;
                                }
                                //console.log('Saying hi to', message.author.username);
                                katakanaifier(message.author.username).then(jp=>{
                                    sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                                }).catch(e=>console.error('espeak error', e));
                            }).catch(()=>console.error(`Couldn't fetch guild ${guilds[guildObjIdx].id}, maybe the bot was kicked?`));
                        } else {
                            //console.log('Saying hi to', message.author.username);
                            katakanaifier(message.author.username).then(jp=>{
                                sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                            }).catch(e=>console.error('espeak error', e));
                        }
                        pgclient.query(`UPDATE votes SET count=${votecount-1} WHERE uid='${message.author.id}'`);
                    } else {
                        message.author.send(`You Do Not Have Enough Credits Left\n\nVote On Top.gg https://top.gg/bot/753757823535677561 Or DiscordBotList https://discord.ly/hideokojima To Get More`).catch(()=>console.error("Couldn't send DM"));
                    }
                })
            } else if (message.mentions.has(message.guild.me) && message.content.indexOf('listen ') > -1) {
                let didFulfill = false;
                let pargs = message.content.split('listen ');
                if (pargs.length < 2) return;
                let songQuery = pargs.pop();
                if (!songQuery) return;
                pgclient.query(`SELECT * FROM votes WHERE uid='${message.author.id}';`, (err, res)=>{
                    if (err) throw err;
                    //console.log(`Vote row count for ${message.author.id} is ${res.rows.length}`);
                    let votecount = 0;
                    if (res.rows.length > 0) {
                        votecount = res.rows[0].count;
                    }
                    if (votecount > 1) {
                        if (typeof guilds[guildObjIdx].destChannel === 'string') {
                            //console.log(`Resolving channel ${guilds[guildObjIdx].destChannel} for guild ${guilds[guildObjIdx].id}`);
                            client.guilds.fetch(guilds[guildObjIdx].id).then(guildobj=>{
                                let bak = guilds[guildObjIdx].destChannel;
                                guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guilds[guildObjIdx].destChannel);
                                if (!guilds[guildObjIdx].destChannel) {
                                    guilds[guildObjIdx].destChannel = bak;
                                    console.log(`Couldn't resolve channel ${guilds[guildObjIdx].destChannel} in ${guilds[guildObjIdx].id}.`);
                                    return;
                                }
                                //console.log('Saying hi to', message.author.username);
                                /*
                                katakanaifier(message.author.username).then(jp=>{
                                    sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                                }).catch(e=>console.error('espeak error', e));
                                */
                                guilds[guildObjIdx].destChannel.startTyping();
                                walkmanizer(songQuery).then(walkmanized=>{
                                    guilds[guildObjIdx].destChannel.send(`Good morning. ${walkmanized.url}`, new Discord.MessageAttachment(walkmanized.finalimg, 'walkman.png')).then(()=>didFulfill=true).catch(e=>{
                                        guilds[guildObjIdx].destChannel.send('Sorry, I Do Not Have Image Permissions');
                                    });
                                }).catch(e=>{
                                    guilds[guildObjIdx].destChannel.send(`Couldn't Find Song, Sorry...\nMake Sure Your Song Is On Spotify Or Deezer`);
                                }).finally(()=>guilds[guildObjIdx].destChannel.stopTyping());
                            }).catch(()=>console.error(`Couldn't fetch guild ${guilds[guildObjIdx].id}, maybe the bot was kicked?`));
                        } else {
                            //console.log('Saying hi to', message.author.username);
                            /*
                            katakanaifier(message.author.username).then(jp=>{
                                sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                            }).catch(e=>console.error('espeak error', e));
                            */
                            guilds[guildObjIdx].destChannel.startTyping();
                            walkmanizer(songQuery).then(walkmanized=>{
                                guilds[guildObjIdx].destChannel.send(`Good morning. ${walkmanized.url}`, new Discord.MessageAttachment(walkmanized.finalimg, 'walkman.png')).then(()=>didFulfill=true).catch(e=>{
                                    guilds[guildObjIdx].destChannel.send('Sorry, I Do Not Have Image Permissions');
                                });
                            }).catch(e=>{
                                guilds[guildObjIdx].destChannel.send(`Couldn't Find Song, Sorry...\nMake Sure Your Song Is On Spotify Or Deezer`);
                            }).finally(()=>guilds[guildObjIdx].destChannel.stopTyping());;
                        }
                        if (didFulfill) pgclient.query(`UPDATE votes SET count=${votecount-2} WHERE uid='${message.author.id}'`);
                    } else {
                        message.author.send(`You Do Not Have Enough Credits Left\n\nVote On Top.gg https://top.gg/bot/753757823535677561 Or DiscordBotList https://discord.ly/hideokojima To Get More`).catch(()=>console.error("Couldn't send DM"));
                    }
                })
            }
        
            guilds[guildObjIdx].lastUsername = message.author.username;
            //console.log(guilds[guildObjIdx].lastUsername);
        }
    } catch (e) {
        console.error('Exception in message handler:', e);
    }
});

client.on('guildCreate', guild=>{
    console.log(`Joined new guild ${guild.name}!`);
    postBotStats();
});

client.on('guildDelete', guild=>{
    console.log(`Left guild ${guild.name} ${guild.id}`);
    postBotStats();
});

console.log('Querying postgresql db');
pgclient.query('SELECT * FROM guilds;', (err, res)=>{
    if (err) throw err;
    console.log('Responded with row count', res.rows.length);
    for (let row of res.rows) {
        //console.log(row);
        guilds.push({
            id: row.gid,
            destChannel: row.cid,
            lastUsername: null,
            entermessage: row.entermsg,
            leavemessage: row.leavemsg,
            greetInt: row.greetinterval,
            greetedLast: row.greetedlast,
            jpenabled: row.jpenabled
        });
    }
    console.log('Logging into discord');
    client.login(process.env.BOTTOKEN);
});