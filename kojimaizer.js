const nlp = require('compromise');
nlp.extend(require('compromise-syllables'));

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

module.exports = word => {
    word = word.replace(/([^_])_([^_])/g,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2');
    let syllables = nlp(word).terms().syllables().reduce((acc,cv)=>{
        return [
            ...acc,
            '',             // blank string adds emphasis to word boundaries over syllable boundaries
            ...cv.syllables
        ];
    }, []);
    syllables.shift();      // remove leading blank string

    console.log('Input:', word);

    console.log(syllables);
    let len = Math.ceil(syllables.length / 2);
    console.log(len)

    if (syllables.length === 1) {
        let value = syllables[0];
        let index = Math.ceil(value.length / 2);
        syllables = [value.substring(0, index), value.substring(index)];
    }

    let begin = '';

    for (let i=0;i<len;i++) {
        begin += syllables.shift();
    }

    return `Hi ${capitalize(begin)} ${capitalize(syllables.join(''))}`;
}