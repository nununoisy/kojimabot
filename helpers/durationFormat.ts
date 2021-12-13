/**
 * Format a duration in minutes into a format that includes days, hours, and minutes.
 * @param duration Duration in minutes
 */
const durationFormat = (duration: number): string => {
    const days = Math.floor(duration / 1440);
    const hours = Math.floor((duration % 1440) / 60);
    const minutes = duration % 60;
    const result = [];
    if (days > 0) {
        result.push(`${days} Day${days > 1 ? 's' : ''}`);
    }
    if (hours > 0) {
        result.push(`${hours} Hour${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        result.push(`${minutes} Minute${minutes > 1 ? 's' : ''}`);
    }
    if (result.length === 0) {
        return 'Instant';
    } else if (result.length > 1) {
        result[result.length - 1] = `and ${result[result.length - 1]}`;
    }
    return result.join(result.length > 2 ? ', ' : ' ');
};

export default durationFormat;