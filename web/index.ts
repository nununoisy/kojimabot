import express from 'express';
import bodyParser from "body-parser";
import path from 'path';

import dbHelper from '../helpers/db';

import kojimaize from "../kojimaizer";
import katakanaize from "../katakanaizer";

const dbh = new dbHelper();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/kojimaize', async (req, res) => {
    if (!req.body || typeof req.body !== 'string') {
        return res
            .status(400)
            .send("Missing/invalid request body");
    }

    const result = await kojimaize(req.body);

    res.send(`Hi ${result}`);
});

app.post('/katakanaize', async (req, res) => {
    if (!req.body || typeof req.body !== 'string') {
        return res
            .status(400)
            .send("Missing/invalid request body");
    }

    const result = await katakanaize(req.body);

    res.send(`こんにちは ${result}`);
});

app.post('/webhooks/dbl', async (req, res) => {
    console.log('Received Top.gg webhook');

    if (!req.body || !req.body.user) {
        return res
            .status(400)
            .send("Missing/invalid request body");
    }

    if (req.headers.authorization !== process.env.DBLWEBHOOKAUTH) {
        return res
            .status(401)
            .send("Unauthorized");
    }
    const increment = req.body.isWeekend ? 2 : 1;

    if (req.body.type === 'test')
        console.log('Test webhook - not modifying database');
    else
        await dbh.giveCredits(req.body.user, increment);

    res.send("Success");
});

app.post('/webhooks/dbotlist', async (req, res) => {
    console.log('Received Discord Bot List webhook');

    if (!req.body || !req.body.id)
        return res
            .status(400)
            .send("Missing/invalid request body");

    if (req.headers.authorization !== process.env.DBOTWEBHOOKAUTH)
        return res
            .status(401)
            .send("Unauthorized");

    await dbh.giveCredits(req.body.id, 1);

    res.send("Success");
});

const port = process.env.PORT || 3000;
dbh.connect()
    .then(() => dbh.prepareDatabase())
    .then(() => app.listen(port, () => {
        console.log("[WEB] Running on port", port);
    }));