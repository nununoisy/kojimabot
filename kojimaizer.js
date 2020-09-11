const nlp = require('compromise');
nlp.extend(require('compromise-syllables'));

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

module.exports = word => {
    let syllables = nlp(word).terms().syllables().reduce((acc,cv)=>{
        return [
            ...acc,
            ...cv.syllables
        ];
    }, []);

    console.log('Input:', word);

    console.log(syllables);
    let len = Math.ceil(syllables.length / 2);
    console.log(len)

    let begin = '';

    for (let i=0;i<len;i++) {
        begin += syllables.shift();
    }

    return `Hi ${capitalize(begin)} ${capitalize(syllables.join(''))}`;
}