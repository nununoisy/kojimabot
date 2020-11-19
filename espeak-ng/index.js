const worker = require('./espeakng.worker');

module.exports = async word => {
    console.log('Katakanifier start...')
    const espeakng = await Promise.resolve(worker);
    console.log('Resolved espeak-ng...')
    const res = espeakng.synthesize_ipa(word);
    console.log('Espeak-ng finished...')
    if (res.code === 0) return res.ipa;
    console.log('ESPEAK-NG ERROR');
    throw new Error(`espeak-ng failed with code ${res.code}`);
}