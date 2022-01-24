import nlp from 'compromise';
import nlpSyllables from "compromise-syllables";
import * as stringz from 'stringz';

const nlpx = nlp.extend(nlpSyllables);

const capitalize = (s: string): string =>
    s ? stringz.substr(s, 0, 1).toUpperCase() + stringz.substr(s, 1) : '';

interface SyllablesResult {
    text: string,
    syllables: string[]
}

const kojimaize = async (phrase: string): Promise<string> => {
    phrase = phrase
        .replace(/([^_])_+([^_])/gu,'$1 $2') // Replace underscores at word boundaries with spaces
        .replace(/([a-z])([A-Z])/gu,'$1 $2'); // Add spaces at lowercase->uppercase boundaries

    const syllables = (nlpx(phrase)
        .terms()
        .syllables() as SyllablesResult[])
        .reduce((a, c) => [
            ...a,
            '', // Add emphasis to word boundaries over syllable boundaries
            ...c.syllables
        ], ([] as string[]));

    syllables.shift(); // Remove leading empty string

    if (syllables.length < 2) {
        const value = syllables[0] || '';
        if (!value)
            return '';
        const halfSplit = Math.ceil(stringz.length(value) / 2);
        return `${capitalize(stringz.substring(value, 0, halfSplit))} ${capitalize(stringz.substring(value, halfSplit))}`;
    }

    const halfSplit = Math.ceil(syllables.length / 2);
    const firstHalf = syllables.splice(0, halfSplit);

    return `${capitalize(firstHalf.join(''))} ${capitalize(syllables.join(''))}`;
}

export default kojimaize;