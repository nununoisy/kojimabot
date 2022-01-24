import readline from 'readline';

import kojimaize from "../kojimaizer";
import katakanaize from "../katakanaizer";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.setPrompt('> ');

rl.on('line', async (line) => {
  const katakanaized = await katakanaize(line);
  const kojimaized = await kojimaize(line);
  console.log(`(kojimaized)   ${kojimaized}`);
  console.log(`(katakanaized) ${katakanaized}`);
  rl.prompt();
});

rl.prompt();