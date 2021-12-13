import nlp from 'compromise';
import nlpSyllables from "compromise-syllables";

const nlpx = nlp.extend(nlpSyllables);

const capitalize = (s: string): string => s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '';

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
        const halfSplit = Math.ceil(value.length / 2);
        return `${capitalize(value.substring(0, halfSplit))} ${capitalize(value.substring(halfSplit))}`;
    }

    const halfSplit = Math.ceil(syllables.length / 2);
    const firstHalf = syllables.splice(0, halfSplit);

    return `${capitalize(firstHalf.join(''))} ${capitalize(syllables.join(''))}`;
}

export default kojimaize;