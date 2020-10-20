function minToInterval(min) {
    const unitStrings = ["Week", "Day", "Hour", "Minute"];

    min = Math.round(min);

    let week = Math.floor(min / 10080);
    min -= week * 10080;

    let day = Math.floor(min / 1440);
    min -= day * 1440;

    let hour = Math.floor(min / 60);
    min -= hour * 60;

    let valArray = [week, day, hour, min];
    let excludeOne = valArray.filter(x => x > 0).length === 1;

    let strings = valArray.map((n, i) => (
        n > 0 ? ((excludeOne && n === 1) ? '' : n + ' ') + unitStrings[i] + (n === 1 ? '' : 's') : ''
    )).filter(x => x);

    let top = strings.shift();
    if (strings.length === 0) return top;

    return strings.reduce((a, c, i, ar) => (
        a + (ar.length > 1 ? ', ' : ' ') + (i === ar.length - 1 ? 'And ' : '') + c
    ), top)
}

function intervalToMin(intval) {
    const intvalRegex = /([0-9]+)(m|h|d|w|)/g;
    let matches, multiplier, min = 0;

    while ((matches = intvalRegex.exec(intval)) !== null) {
        switch (matches[2]) {
            case 'w':
                multiplier = 10080;
                break;
            case 'd':
                multiplier = 1440;
                break;
            case 'h':
                multiplier = 60;
                break;
            case 'm':
            case '':
                multiplier = 1;
                break;
            default:
                multiplier = 0;
        }
        min += multiplier * parseInt(matches[1], 10);
    }
    return min;
}

module.exports = {
    minToInterval,
    intervalToMin
}