import nlp from 'compromise';
import nlpSyllables from "compromise-syllables";
import * as stringz from 'stringz';

const nlpx = nlp.extend(nlpSyllables);

/**
 * Capitalizes the first letter of a string
 * @param s The string to capitalize
 */
const capitalize = (s: string): string =>
    s ? stringz.substr(s, 0, 1).toUpperCase() + stringz.substr(s, 1) : '';

interface SyllablesResult {
    text: string,
    syllables: string[]
}

/**
 * Try to "Kojima Ize" a string
 * @param phrase String to kojimaize
 */
const kojimaize = async (phrase: string): Promise<string> => {
    // To kojimaize a string, the following steps are performed:
    // - Split the string into syllables
    // - Try to find the middle syllable without splitting words
    // - If the middle syllable is not found or there is only one syllable, split the phrase in half
    // - Coerce each half into lowercase and capitalize them
    // - Add a space between the two halves

    // Word-splitting heuristics to help Compromise find syllables more easily
    phrase = phrase
        .replace(/([^_])_+([^_])/gu,'$1 $2') // Replace underscores at word boundaries with spaces
        .replace(/([a-z])([A-Z])/gu,'$1 $2'); // Add spaces at lowercase->uppercase boundaries

    // Break phrase into syllables
    const syllables = (nlpx(phrase)
        .terms()
        .syllables() as SyllablesResult[])
        // Flatten the syllables() result array with added word boundary emphasis
        .reduce((a, c) => [
            ...a,
            '', // Add emphasis to word boundaries over syllable boundaries
            ...c.syllables
        ], ([] as string[]));

    syllables.shift(); // Remove leading empty string

    // If there aren't enough syllables:
    if (syllables.length < 2) {
        // Split the phrase in half manually
        const value = syllables[0] || '';
        if (!value)
            return '';
        const halfSplit = Math.ceil(stringz.length(value) / 2);
        return `${capitalize(stringz.substring(value, 0, halfSplit))} ${capitalize(stringz.substring(value, halfSplit))}`;
    }

    // Find the midpoint in the syllables, join and return
    const halfSplit = Math.ceil(syllables.length / 2);
    const firstHalf = syllables.splice(0, halfSplit);

    return `${capitalize(firstHalf.join(''))} ${capitalize(syllables.join(''))}`;
}

export default kojimaize;