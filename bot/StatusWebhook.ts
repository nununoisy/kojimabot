import * as Discord from "discord.js";

export default class StatusWebhook {
    webhook?: Discord.WebhookClient;

    constructor() {
        if (!process.env.STATUS_WEBHOOK_ID || !process.env.STATUS_WEBHOOK_TOKEN)
            return;

        this.webhook = new Discord.WebhookClient({
            id: process.env.STATUS_WEBHOOK_ID,
            token: process.env.STATUS_WEBHOOK_TOKEN
        });
    }

    async send(message: string) {
        if (!this.webhook)
            return;

        await this.webhook.send(message);
    }
}