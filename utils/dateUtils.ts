/** Trả về YYYY-MM-DD theo múi giờ địa phương, không bị lệch ngày do UTC. */
export const localDateKey = (date: Date = new Date()): string => {
    const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
    return new Date(localTime).toISOString().slice(0, 10);
};
