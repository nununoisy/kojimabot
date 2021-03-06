const espeakng = require('./espeak-ng');
const wanakana = require('wanakana');
const converter = { convert: term=>{
    if (wanakana.isKana(wanakana.toKana(term.replace(/[\s_]/g,''))) || wanakana.isKanji(term)) {
        return {
            hiragana: wanakana.toHiragana(term),
            katakana: wanakana.toKatakana(term),
            romaji: term
        }
    } else return false
}};

const katakanaifier = term => new Promise((resolve,reject)=>{
    if (!term) {
        resolve('');
        return;
    }
    console.log('Input:',term);

    let oterm = term;

    term = term.replace(/[0-9]{3,}/g, num=>num.split('').join(' ')).replace(/_/g,'');

    let conversion = converter.convert(term);
    if (conversion) {
        console.log(conversion);
        resolve(conversion.katakana);
        return;
    } else {
        console.log('Not romaji, appling algorithm...')
    }

    console.log('Preprocess:',term);

    espeakng(term).then(transcription=>{
        if (!transcription) {
            resolve(`【${oterm}】`);
            return;
        }
        console.log('espeak-ng IPA:',transcription.replace(/@/gu,''));
        let phonemes = `${transcription}*`.replace(/[ˈˌ]/gu,'').replace(/\s/gu,'*@').replace(/ŋ@k/gu,'nk').replace(/ŋ@ɡ/gu,'ŋ').replace(/k@æ/gu,'kya').replace(/j@?uː/gu,'yuu').split('@').map(
            ph=>ph.replace(/eɪ/gu,'ei')             // diphthongs
                  .replace(/aɪ/gu,'aii')
                  .replace(/ɔɪ/gu,'oi')
                  .replace(/oʊ/gu,'oo')
                  .replace(/əʊ/gu,'ou')
                  .replace(/aʊ/gu,'au')
                  .replace(/ɪə/gu,'ia')
                  .replace(/ɛə/gu,'ea')
                  .replace(/ʊə/gu,'uaa')
                  .replace(/ə\*/gu,'aa*')
                  .replace(/ɑ|ɐ|ə/gu,'a')           // vowels
                  .replace(/æ/gu,'a')
                  .replace(/ɜː/gu,'uur')
                  .replace(/ɜ/gu,'er')
                  .replace(/ɛ/gu,'e')
                  .replace(/i\*/gu,'ii')
                  .replace(/ɪ|i/gu,'i')
                  .replace(/ɔː/gu,'ou')
                  .replace(/ɔ|ɒ/gu,'o')
                  .replace(/ʌ|ʊ|u/gu,'u')
                  .replace(/([aeiou])ː/gu,'$1$1')   // long vowels
                  .replace(/tʃ|dʒ/gu,'ch')          // consonants
                  .replace(/θ/gu,'s')
                  .replace(/ð/gu,'z')
                  .replace(/ʃ/gu,'shi')
                  .replace(/ʒ/gu,'sha')
                  .replace(/ŋ/gu,'ngu')
                  .replace(/ɡ/gu,'g')
                  .replace(/l|ɬ|ɹ/gu,'r')
                  .replace(/hw/g,'w')
                  .replace(/x/gu, 'ga')
                  .replace(/ʔ/gu, '')               // transcription rules adapted from rules by Ben Bullock
        );
        console.log('espeak-ng phonemes:', phonemes);

        let postprocessed = phonemes.join('').replace(/\*/g,' ')
                                             .replace(/([kgsznhbpmyrf])(\s|$)/g,'$1u$2')
                                             .replace(/t(\s|$)/g,'to$1')
                                             .replace(/v(\s|$)/g,'fu$1')
                                             .replace(/w(\s|$)/g,'wa$1')
                                             .replace(/d(\s|$)/g,'do$1')
                                             .replace(/v/g,'bu')
                                             .replace(/uur+/g,'uur')
                                             .replace(/s([^aeiou])/g,'se$1')
                                             .replace(/t([^aeiou])/g,'ta$1')
                                             .replace(/d([^aeiou])/g,'da$1')
                                             .replace(/p([^aeiou])/g,'pu$1')
                                             .replace(/k([^aeiou])/g,'ku$1')
                                             .replace(/f([^aeiou])/g,'fu$1')
                                             .replace(/z([^aeiou])/g,'ze$1')
                                             .replace(/m([^aeiou])/g,'ma$1')
                                             .replace(/r([^aeiou])/g,'ra$1')
                                             .replace(/b([^aeiou])/g,'ba$1')
                                             .replace(/di/g,'dei')
                                             .replace(/hu+/g,'ha')
                                             .replace(/si/g,'shi')
                                             .replace(/si+/g,'shii')
                                             .replace(/gua/g,'ga')
                                             .replace(/che/g,'chi')
                                             .replace(/faa/g,'fua')
                                             .replace(/rd/g,'rud')
                                             .replace(/g([^aeiou])/g,'gu$1')
                                             .trim();

        console.log('Postprocess:', postprocessed);

        conversion = converter.convert(postprocessed);

        if (conversion.katakana) {
            conversion.katakana = conversion.katakana.replace(/([アイウエオ])\1/gu,'$1ー').replace(/(.)([アイウエオ])/gu,(_,ch,vowel)=>{
                console.log(ch, vowel);
                let chr = wanakana.toRomaji(ch).split('').pop();
                let vr = wanakana.toRomaji(vowel);
                console.log(chr, vr);
                if (chr!==vr) return `${ch}${vowel}`
                return `${ch}ー`
            });
        }

        console.log(conversion);
        resolve(conversion.katakana);
    });
});

module.exports = katakanaifier;