import walkmanize from "./index";
import readline from "readline";
import fs from "fs";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Song: ", (query) => {
    walkmanize(query).then((out) => {
        if (out?.image)
            fs.writeFileSync("final.png", out?.image);
        console.log(`${out?.url} - ${out?.source}`);
        rl.close();
    });
});
