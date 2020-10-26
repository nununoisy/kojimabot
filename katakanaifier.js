const { spawn } = require('child_process');
const wanakana = require('wanakana');
const converter = { convert: term=>{
    if (wanakana.isKana(wanakana.toKana(term.replace(/\s/g,'')))) {
        return {
            hiragana: wanakana.toHiragana(term),
            katakana: wanakana.toKatakana(term),
            romaji: term
        }
    } else return false
}};

const katakanaifier = term => new Promise((resolve,reject)=>{
    console.log('Input:',term);

    let oterm = term;

    term = term.replace(/[0-9]+/g, num=>num.split('').join(' '));

    let conversion = converter.convert(term);
    if (conversion) {
        console.log(conversion);
        resolve(conversion.katakana);
        return;
    } else {
        console.log('Not romaji, appling algorithm...')
    }

    console.log('Preprocess:',term);

    let trbuffer = null;
    let transcription = '';

    const transcriber = spawn('espeak-ng', ['-x','--ipa','-q','--sep=@', term]);
    transcriber.stdout.on('data', (data) => {
        if (trbuffer) {
            trbuffer = Buffer.concat([trbuffer, data], trbuffer.length+data.length)
        } else {
            trbuffer = Buffer.from(data);
        }
    });
    transcriber.stdout.on('close', () => {
        if (!trbuffer) {
            resolve(`【${oterm}】`);
            return;
        }
        transcription = trbuffer.toString('utf-8').trim();
        console.log('espeak-ng IPA:',transcription.replace(/@/gu,''));
        let phonemes = transcription.replace(/[ˈˌ]/gu,'').replace(/\s/g,'@').replace(/ŋ@ɡ/gu,'ŋ').split('@').map(
            ph=>ph.replace(/ɔɪ/gu,'oii')            // diphthongs
                  .replace(/əʊ|oʊ/gu,'o')
                  .replace(/aʊ/gu,'au')
                  .replace(/aɪ/gu,'aii')
                  .replace(/eɪ/gu,'ei')
                  .replace(/ɑ|ɒ|ɐ|ɔ|ə/gu,'a')       // vowels
                  .replace(/æ/gu,'aa')
                  .replace(/ɛ/gu,'e')
                  .replace(/ɪ|i/,'i')
                  .replace(/ʌ|ʊ|u/gu,'u')
                  .replace(/([aeiou])ː/gu,'$1$1')   // long vowels
                  .replace(/tʃ|dʒ/gu,'ch')          // consonants
                  .replace(/θ|ð/gu,'t')
                  .replace(/ʃ/gu,'shi')
                  .replace(/ʒ/gu, 'sha')
                  .replace(/ŋ/gu,'ngu')
                  .replace(/ɡ/gu,'g')
                  .replace(/l|ɬ|ɹ/gu,'r')
                  .replace(/hw/g,'w')
                  .replace(/x/gu, 'ga')
                  .replace(/ʔ/gu, '')

        );
        console.log('espeak-ng phonemes:', phonemes);

        let postprocessed = phonemes.join('').replace(/s([^aeiou])/g,'se$1')
                                             .replace(/t([^aeiou])/g,'ta$1')
                                             .replace(/d([^aeiou])/g,'da$1')
                                             .replace(/p([^aeiou])/g,'pu$1')
                                             .replace(/k([^aeiou])/g,'ku$1')
                                             .replace(/z([^aeiou])/g,'ze$1')
                                             .replace(/hu+/g,'ha')
                                             .replace(/si+/g,'shi')
                                             .replace(/gua/g,'ga')
                                             .replace(/che/g,'chi')
                                             .replace(/([kgsztdnhbpmyrwf])(\s|$)/g,'$1u$2');

        console.log('Postprocess:', postprocessed);

        conversion = converter.convert(postprocessed);
        console.log(conversion);
        resolve(conversion.katakana);
    });
});

module.exports = katakanaifier;