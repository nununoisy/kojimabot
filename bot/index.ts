import * as Discord from 'discord.js';
import DBHelper from "../helpers/db";
import kojimaize from "../kojimaizer";
import katakanaize from "../katakanaizer";
import walkmanize from "../walkmanizer";
import { SpotifyAutocomplete } from "../walkmanizer/search";
import StatusWebhook from "./StatusWebhook";
import durationFormat from "../helpers/durationFormat";
import commands from "../helpers/commands";
import fetch from "node-fetch";
import { Api as TopggApi } from "@top-gg/sdk";
import limit from "p-limit";

const client = new Discord.Client({
    allowedMentions: {
        parse: ['users']
    },
    intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES', 'GUILD_BANS', 'DIRECT_MESSAGES']
});

const dbh = new DBHelper();
const statusWebhook = new StatusWebhook();

let topggApi: TopggApi | null = null;
if (process.env.DBLTOKEN) {
    topggApi = new TopggApi(process.env.DBLTOKEN);
}

/**
 * Post current bot status to the status webhook and to botlist APIs.
 * @async
 */
const postBotStats = async () => {
    await client.guilds.fetch();
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const totalGuilds = client.guilds.cache.size;
    console.log(`Posting bot stats...\nMembers: ${totalMembers}\nGuilds: ${totalGuilds}`);

    const requests: Promise<any>[] = [];
    if (process.env.DBLTOKEN) {
        requests.push(topggApi!.postStats({
            serverCount: totalGuilds,
            shardCount: 1
        }));
    }
    if (process.env.DBOTTOKEN) {
        requests.push(fetch(`https://discordbotlist.com/api/v1/bots/${client.user?.id}/stats`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.DBOTTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guilds: totalGuilds,
                members: totalMembers
            })
        }));
    }
    if (process.env.BOTSGGTOKEN) {
        requests.push(fetch(`https://discord.bots.gg/api/v1/bots/${client.user?.id}/stats`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.BOTSGGTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildCount: totalGuilds
            })
        }));
    }
    if (process.env.BOTSONDISCORDTOKEN) {
        requests.push(fetch(`https://bots.ondiscord.xyz/bot-api/bots/${client.user?.id}/guilds`, {
            method: 'POST',
            headers: {
                'Authorization': process.env.BOTSONDISCORDTOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildCount: totalGuilds
            })
        }));
    }
    await Promise.all(requests);

    const topGuilds = client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount);

    let statusMessage = `Bot stats:\nMembers: ${totalMembers}\nGuilds: ${totalGuilds}\nTop guilds:\n`;
    for (let i = 0; i < Math.min(totalGuilds, 10); i++) {
        const topGuild = topGuilds.at(i);
        statusMessage += `\n  ${i + 1}) ${topGuild?.name} :: ${topGuild?.memberCount} members\n`;
    }

    await statusWebhook.send(statusMessage);
}

client.on('ready', async () => {
    client.user?.setActivity("Hi Sponge Bob");
    console.log(`Logged in as ${client.user?.tag}!`);
    await postBotStats();
    if (process.env.DEV_GUILD) {
        const devGuild = await client.guilds.fetch(process.env.DEV_GUILD);
        await devGuild.commands.set(commands);

        client.guilds.cache.filter(guild => guild.id !== process.env.DEV_GUILD).forEach(guild => {
            guild.leave();
        });
    }
    await client.application?.commands.set(commands);
});

/**
 * Post a message to a guild's greeting channel in the correct language.
 *
 * @param {Discord.Guild} guild - Guild to post to.
 * @param {string} message - Message to post in English.
 * @param {string} messagejp - Message to post in Japanese.
 */
const sendMessageInGuild = async (guild: Discord.Guild, message: string, messagejp: string) => {
    try {
        const guildInfo = await dbh.getGuildInfo(guild.id);
        if (!guildInfo || !guildInfo.cid) {
            console.log(`No greeting channel for guild ${guild.name}`);
            return;
        }
        const channel = await guild.channels.fetch(guildInfo.cid);
        if (!channel) {
            console.log(`Greeting channel for guild ${guild.name} not found or not accessible`);
            return;
        }
        if (client.user != null && !channel.permissionsFor(client.user)?.has('SEND_MESSAGES')) {
            console.log(`Missing SEND_MESSAGES permission for channel ${channel.name} in guild ${guild.name}`);
            return;
        }
        if (!channel.isText()) {
            console.log(`Greeting channel for guild ${guild.name} is not a text channel`);
            return;
        }
        await channel.send(guildInfo.jpEnabled ? messagejp : message);
    } catch (e) {
        await statusWebhook.send(`Exception in sendMessageInGuild(): ${e}`);
        console.error('Exception in sendMessageInGuild():', e);
    }
}

// Limit for concurrent greeting messages to avoid rate limiting/database pressure
const greetingLimit = limit(150);

/**
 * Interval method to handle sending greeting messages.
 * @async
 */
const greetingInterval = async () => {
    try {
        const now = new Date();
        let greetingCount = 0;
        await client.guilds.fetch();
        console.log(`Checking ${client.guilds.cache.size} guilds for pending greetings...`);

        await Promise.allSettled(
            client.guilds.cache.map(async (cacheGuild) => greetingLimit(
                async () => {
                    console.log(`Checking guild ${cacheGuild.name}...`);
                    const guildInfo = await dbh.getGuildInfo(cacheGuild.id);
                    if (!guildInfo || !guildInfo.cid || guildInfo.cid === "0" ||
                            !guildInfo.lastUsername || guildInfo.greetInterval <= 0)
                        return;

                    const timeFromLastGreet = (now.getTime() - guildInfo.greetedLast.getTime()) / (1000 * 60);
                    console.log(`Time since last greeting: ${timeFromLastGreet} minutes`);
                    if (timeFromLastGreet < guildInfo.greetInterval)
                        return;

                    greetingCount++;
                    const message = `Hi ${await kojimaize(guildInfo.lastUsername)}`;
                    const messagejp = `こんにちは ${await katakanaize(guildInfo.lastUsername)}`;

                    const guild = await cacheGuild.fetch();

                    await sendMessageInGuild(guild, message, messagejp);

                    guildInfo.greetedLast = now;
                    if (!guildInfo.repeatGreet)
                        guildInfo.lastUsername = null;
                    await dbh.updateGuild(guildInfo);

                    console.log(`Sent greeting in guild ${guild.name}.`);
                }
            ))
        );
    } catch (e) {
        await statusWebhook.send(`Exception in greeting interval: ${e}`);
        console.error('Exception in greeting interval:', e);
    }
};

client.on('guildMemberAdd', async (member) => {
    try {
        const guildInfo = await dbh.getGuildInfo(member.guild.id);
        if (!guildInfo || !guildInfo.cid || !guildInfo.enterMessage)
            return;

        const message = `Hi ${await kojimaize(member.user.username)} <@${member.user.id}>`;
        const messagejp = `こんにちは ${await katakanaize(member.user.username)} <@${member.user.id}>`;

        await sendMessageInGuild(member.guild, message, messagejp);

        console.log(`Sent new member greeting to ${member.user.username} in guild ${member.guild.name}.`);
    } catch (e) {
        await statusWebhook.send(`Exception in guildMemberAdd handler: ${e}`);
        console.error('Exception in guildMemberAdd handler:', e);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const guildInfo = await dbh.getGuildInfo(member.guild.id);
        if (!guildInfo || !guildInfo.cid || !guildInfo.leaveMessage)
            return;

        const message = `Bye ${await kojimaize(member.user?.username ?? 'error')} (${member.user?.username}#${member.user?.discriminator})`;
        const messagejp = `さようなら ${await katakanaize(member.user?.username ?? 'eraa')} (${member.user?.username}#${member.user?.discriminator})`;

        await sendMessageInGuild(member.guild, message, messagejp);

        console.log(`Sent member removal greeting to ${member.user?.username} in guild ${member.guild.name}.`);
    } catch (e) {
        await statusWebhook.send(`Exception in guildMemberRemove handler: ${e}`);
        console.error('Exception in guildMemberRemove handler:', e);
    }
});

client.on('messageCreate', async (message) => {
    try {
        if (!message || !message.guildId || !message.author || !message.author.id || !message.author.username)
            return;

        if (message.author.id === client.user?.id)
            return;

        const guildInfo = await dbh.getGuildInfo(message.guildId);
        if (!guildInfo)
            return;

        if (message.channelId !== guildInfo.cid)
            return;

        guildInfo.lastUsername = message.author.username;
        await dbh.updateGuild(guildInfo);

        if (message.mentions.users.find((u) => u.id === client.user?.id)) {
            const commandMessage = await message.reply(`Commands Are Now Invoked Using Slash Commands. For Example: \`/greet\``);
            setTimeout(() => commandMessage.delete(), 10000);
        }
    } catch (e) {
        await statusWebhook.send(`Exception in messageCreate handler: ${e}`);
        console.error('Exception in messageCreate handler:', e);
    }
});

const canMemberInvokeAdminCommands = (member: Discord.GuildMember): boolean => {
    if (!member)
        return false;

    return member.permissions.has('ADMINISTRATOR') || member.permissions.has('MANAGE_GUILD');
};

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction || !interaction.guildId || !interaction.user.id || !interaction.user.username ||
                !(interaction.member instanceof Discord.GuildMember))
            return;

        if (interaction.isCommand() && interaction.command != null) {
            console.log(`Received command: /${interaction.command.name}`);
            if (interaction.command.name === "setchannel") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: false });

                const channelId = interaction.options.getChannel('channel')?.id;
                if (!channelId) {
                    await interaction.editReply("Hi Ad Min\n\nSorry, I Could Not Set The Channel. Make Sure I Have The Permissions To Send Messages In That Channel.");
                    return;
                }
                const channel = await interaction.guild?.channels.fetch(channelId);
                if (!channel || !channel.isText() || (client.user != null && !channel.permissionsFor(client.user)?.has("SEND_MESSAGES"))) {
                    await interaction.editReply("Hi Ad Min\n\nSorry, I Could Not Set The Channel. Make Sure I Have The Permissions To Send Messages In That Channel.");
                    return;
                }

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.cid = channel.id;
                    await dbh.updateGuild(guildInfo);
                }

                await interaction.editReply(`Hi Ad Min\n\nI Have Set The Greeting Channel To ${channel}.`);
            } else if (interaction.command.name === "setinterval") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: false });

                const interval = interaction.options.getInteger('interval');
                if ((!interval && interval !== 0) || interval < 0) {
                    await interaction.editReply("Hi Ad Min\n\nSorry, I Could Not Set The Interval. Make Sure The Interval Is Positive.");
                    return;
                }

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.greetInterval = interval;
                    await dbh.updateGuild(guildInfo);
                }

                if (interval > 0)
                    await interaction.editReply(`Hi Ad Min\n\nI Will Now Greet Members Every ${durationFormat(interval)}`);
                else
                    await interaction.editReply(`Hi Ad Min\n\nI Will No Longer Greet Members Automatically.`);
            } else if (interaction.command.name === "joinmessages") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: false });

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.enterMessage = interaction.options.getBoolean('enabled') ?? guildInfo.enterMessage;
                    await dbh.updateGuild(guildInfo);
                }

                if (guildInfo?.enterMessage)
                    await interaction.editReply(`Hi Ad Min\n\nI Will Now Greet New Members.`);
                else
                    await interaction.editReply(`Hi Ad Min\n\nI Will No Longer Greet New Members.`);
            } else if (interaction.command.name === "leavemessages") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ephemeral: false});

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.leaveMessage = interaction.options.getBoolean('enabled') ?? guildInfo.leaveMessage;
                    await dbh.updateGuild(guildInfo);
                }

                if (guildInfo?.leaveMessage)
                    await interaction.editReply(`Hi Ad Min\n\nI Will Now Say Farewell To Leaving Members.`);
                else
                    await interaction.editReply(`Hi Ad Min\n\nI Will No Longer Say Farewell To Leaving Members.`);
            } else if (interaction.command.name === "repeatgreetings") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }
                
                await interaction.deferReply({ephemeral: false});

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.repeatGreet = interaction.options.getBoolean('enabled') ?? guildInfo.repeatGreet;
                    await dbh.updateGuild(guildInfo);
                }

                if (guildInfo?.repeatGreet)
                    await interaction.editReply(`Hi Ad Min\n\nI Will Now Greet Again If Nobody Has Spoken Since My Last Greeting.`);
                else
                    await interaction.editReply(`Hi Ad Min\n\nI Will No Longer Greet Again If Nobody Has Spoken Since My Last Greeting.`);
            } else if (interaction.command.name === "japanesemode") {
                if (!canMemberInvokeAdminCommands(interaction.member)) {
                    await interaction.reply({
                        content: "Sorry, You Don't Have Permission To Use This Command.",
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ephemeral: false});

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);
                if (guildInfo) {
                    guildInfo.jpEnabled = interaction.options.getBoolean('enabled') ?? guildInfo.jpEnabled;
                    await dbh.updateGuild(guildInfo);
                }

                if (guildInfo?.jpEnabled)
                    await interaction.editReply(`Hi Ad Min\n\nI Will Greet Members In Japanese.`);
                else
                    await interaction.editReply(`Hi Ad Min\n\nI Will Greet Members In English.`);
            } else if (interaction.command.name === "checkbalance") {
                await interaction.deferReply({ ephemeral: true });

                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);
                if (credits) {
                    await interaction.editReply(`Hi ${await kojimaize(interaction.member.user.username)}\n\nYou Have ${credits} Credit${credits === 1 ? '' : 's'} Remaining.`);
                } else {
                    await interaction.editReply(`Hi ${await kojimaize(interaction.member.user.username)}\n\nYou Have No Credits Remaining.`);
                }
            } else if (interaction.command.name === "getcredits") {
                await interaction.deferReply({ ephemeral: true });

                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);

                const getCreditEmbed = new Discord.MessageEmbed()
                    .setColor('#1DA1F2')
                    .setTitle('Getting Credits')
                    .setURL('https://kojimaize.xyz/')
                    .setThumbnail('https://kojimaize.xyz/img/kojima.jpg')
                    .setDescription(`Hi ${await kojimaize(interaction.member.user.username)}.`)
                    .addField('What are credits?', 'Credits allow you to use fun commands like /greet and /listen.')
                    .addField('How do I get credits?', 'You can get credits by voting for KojimaBot on botlists like top.gg and discordbotlist.com.')
                    .addField('Why do I need credits?', 'Credits are a way to incentivize engagement and limit spam of fun commands which can be annoying if unlimited.')
                    .addField('How many credits do I have?', `You have ${credits} credit${credits === 1 ? '' : 's'}. You can check your balance at any time with /checkbalance.`);

                const botlistLinkRow = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setLabel('Vote on Top.gg')
                            .setURL('https://top.gg/bot/753757823535677561')
                            .setStyle('LINK'),
                        new Discord.MessageButton()
                            .setLabel('Vote on Discord Bot List')
                            .setURL('https://discordbotlist.com/bots/753757823535677561')
                            .setStyle('LINK')
                    );

                await interaction.editReply({
                    embeds: [ getCreditEmbed ],
                    components: [ botlistLinkRow ]
                });
            } else if (interaction.command.name === "greet") {
                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);
                if (credits < 1) {
                    await interaction.reply({
                        content: `Sorry, But You Do Not Have Enough Credits To Use This Command.`,
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: false });

                const guildInfoE = await dbh.getGuildInfo(interaction.guildId);
                if (!guildInfoE) {
                    await dbh.addNewGuild(interaction.guildId);
                }
                const guildInfo = guildInfoE || await dbh.getGuildInfo(interaction.guildId);

                const memberId = interaction.options.getUser('user')?.id ?? interaction.member.user.id;
                const member = await interaction.guild?.members.fetch(memberId);
                if (!member) {
                    await interaction.editReply(`I Could Not Find That Member. No Credits Deducted.`);
                    return;
                }

                if (!guildInfo?.jpEnabled) {
                    await interaction.editReply(`Hi ${await kojimaize(member.user.username)}`);
                } else {
                    await interaction.editReply(`こんにちは ${await katakanaize(member.user.username)}`);
                }

                await dbh.useCredits(interaction.member.user.id, credits, 1);

                await interaction.followUp({
                    content: `You Have ${credits - 1} Credit${credits - 1 === 1 ? '' : 's'} Remaining.`,
                    ephemeral: true
                });
            } else if (interaction.command.name === "listen") {
                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);
                if (credits < 2) {
                    await interaction.reply({
                        content: `Sorry, But You Do Not Have Enough Credits To Use This Command.`,
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: false });
                const query = interaction.options.getString("song");
                if (!query) {
                    await interaction.editReply(`You Must Provide A Song To Listen To. No Credits Deducted.`);
                    return;
                }
                const walkmanizeResult = await walkmanize(query);
                if (!walkmanizeResult) {
                    await interaction.editReply(`I Couldn't Find That Song On Spotify. No Credits Deducted.`);
                    return;
                }
                const row = new Discord.MessageActionRow()
                    .addComponents(
                        new Discord.MessageButton()
                            .setURL(walkmanizeResult.url ?? '')
                            .setLabel(`Listen on ${walkmanizeResult.source[0].toUpperCase() + walkmanizeResult.source.slice(1)}`)
                            .setStyle('LINK')
                    );
                await interaction.editReply({
                    content: `Good morning.\n\n${walkmanizeResult.url}`,
                    files: [{ attachment: walkmanizeResult.image, name: "walkman.png" }],
                    components: [ row ]
                });

                await dbh.useCredits(interaction.member.user.id, credits, 2);

                await interaction.followUp({
                    content: `You Have ${credits - 2} Credit${credits - 2 === 1 ? '' : 's'} Remaining.`,
                    ephemeral: true
                });
            } else if (interaction.command.name === "stealthgreet") {
                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);
                if (credits < 2) {
                    await interaction.reply({
                        content: `Sorry, But You Do Not Have Enough Credits To Use This Command.`,
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: true });

                const memberId = interaction.options.getUser('user')?.id ?? interaction.member.user.id;
                const member = await interaction.guild?.members.fetch(memberId);
                if (!member || !interaction.guild) {
                    await interaction.editReply(`I Could Not Find That Member. No Credits Deducted.`);
                    return;
                }

                await sendMessageInGuild(interaction.guild, `Hi ${await kojimaize(member.user.username)}`, `こんにちは ${await katakanaize(member.user.username)}`);

                await dbh.useCredits(interaction.member.user.id, credits, 2);

                await interaction.editReply(`You Have ${credits - 2} Credit${credits - 2 === 1 ? '' : 's'} Remaining.`);
            }
        } else if (interaction.isAutocomplete() && interaction.commandName) {
            console.log(`Fulfilling autocomplete interaction for command /${interaction.commandName}`);
            if (interaction.commandName === 'listen') {
                const credits = await dbh.getUserCreditBalance(interaction.member.user.id);
                if (credits < 2) {
                    await interaction.respond([{
                        name: `Sorry, But You Do Not Have Enough Credits To Use This Command.`,
                        value: ''
                    }]);
                    return;
                }

                const query = interaction.options.getString('song');
                if (query) {
                    const results = await SpotifyAutocomplete(query);
                    if (results.length > 0) {
                        await interaction.respond(results.map((song) => ({
                            name: `${song.title} - ${song.artist}`.slice(0, 100),
                            value: `${song.title} ${song.artist}`.slice(0, 100)
                        })));
                    } else {
                        await interaction.respond([]);
                    }
                } else {
                    await interaction.respond([]);
                }
            }
        }
    } catch (e) {
        await statusWebhook.send(`Exception in interactionCreate handler: ${e}`);
        console.error('Exception in interactionCreate handler:', e);
    }
});

client.on('guildCreate', postBotStats);
client.on('guildDelete', postBotStats);

dbh.connect()
    .then(() => dbh.prepareDatabase())
    .then(() => client.login(process.env.BOTTOKEN))
    .then(() => {
        setInterval(greetingInterval, 10000);
        return statusWebhook.send('Bot restarted.')
    })
    .catch((e) => {
        console.error('Exception while connecting to database:', e);
    });