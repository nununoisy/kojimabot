import ESpeakNG from "./espeakng";
import * as wanakana from 'wanakana';

const espeakng = new ESpeakNG();

interface ITranscriptionResult {
    hiragana: string,
    katakana: string,
    romaji: string
}

const transcribe = (term: string): ITranscriptionResult | null => {
    if (wanakana.isKana(wanakana.toKana(term.replace(/[\s_]/g,''))) || wanakana.isKanji(term)) {
        return {
            hiragana: wanakana.toHiragana(term),
            katakana: wanakana.toKatakana(term),
            romaji: term
        }
    } else return null;
}

const katakanaize = async (term: string): Promise<string> => {
    if (!term) {
        return '';
    }

    const oterm = term;

    term = term
        .replace(/[0-9]{3,}/g, (num) => num.split('').join(' '))
        .replace(/_/g,'');

    const naiveTranscription = transcribe(term);
    if (naiveTranscription != null) {
        return naiveTranscription.katakana;
    }

    const transcription = await espeakng.synthesizeIPA(term);
    if (!transcription) {
        return `【${oterm}】`;
    }

    const phonemes = `${transcription}*`
        // Initial preprocessing:
        .replace(/[ˈˌ]/gu,'')   // Remove stress marks
        .replace(/\s/gu,'*@')   // Replace word boundaries with emphasized separators
        .replace(/ŋ@k/gu,'nk')  // Replace certain impossible sounds with functional equivalents
        .replace(/ŋ@ɡ/gu,'ŋ')
        .replace(/k@æ/gu,'kya')
        .replace(/j@?uː/gu,'yuu')
        // Now break into phonemes and transcribe
        .split('@').map(
            (ph) => ph
                .replace(/eɪ/gu,'ei')             // diphthongs
                .replace(/aɪ/gu,'aii')
                .replace(/ɔɪ/gu,'oi')
                .replace(/oʊ/gu,'oo')
                .replace(/əʊ/gu,'ou')
                .replace(/aʊ/gu,'au')
                .replace(/ɪə/gu,'ia')
                .replace(/ɛə/gu,'ea')
                .replace(/ʊə/gu,'uaa')
                .replace(/ə\*/gu,'aa*')
                .replace(/[ɑɐə]/gu,'a')           // vowels
                .replace(/æ/gu,'a')
                .replace(/ɜː/gu,'uur')
                .replace(/ɜ/gu,'er')
                .replace(/ɛ/gu,'e')
                .replace(/i\*/gu,'ii')
                .replace(/[ɪi]/gu,'i')
                .replace(/ɔː/gu,'ou')
                .replace(/[ɔɒ]/gu,'o')
                .replace(/[ʌʊu]/gu,'u')
                .replace(/([aeiou])ː/gu,'$1$1')   // long vowels
                .replace(/tʃ|dʒ/gu,'ch')          // consonants
                .replace(/θ/gu,'s')
                .replace(/ð/gu,'z')
                .replace(/ʃ/gu,'shi')
                .replace(/ʒ/gu,'sha')
                .replace(/ŋ/gu,'ngu')
                .replace(/ɡ/gu,'g')
                .replace(/[lɬɹ]/gu,'r')
                .replace(/hw/g,'w')
                .replace(/x/gu, 'ga')
                .replace(/ʔ/gu, '')               // transcription rules adapted from rules by Ben Bullock
        );

    // Final postprocessing before transliteration
    // Adds neutral vowels in between consonant pairs
    // and fixes impossible sound pairings
    const postprocessed = phonemes.join('').replace(/\*/g,' ')
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

    const transliteration = transcribe(postprocessed);

    if (transliteration && transliteration.katakana) {
        // Replace double vowels with vowel and vowel extender
        transliteration.katakana = transliteration.katakana
            .replace(/([アイウエオ])\1/gu,'$1ー')
            .replace(/(.)([アイウエオ])/gu,(_, ch, vowel) => {
                const chr = wanakana.toRomaji(ch).split('').pop();
                const vr = wanakana.toRomaji(vowel);
                if (chr !== vr)
                    return `${ch}${vowel}`
                return `${ch}ー`
            });
    }

    return transliteration?.katakana || `【${oterm}】`;
}

export default katakanaize;