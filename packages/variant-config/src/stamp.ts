/** Local wall time `YYYY-MM-DD_HH:MM:SS`: zero-padded, 24-hour, underscore, no offset. */
const LOCAL_STAMP = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])_([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

/** Epoch milliseconds of a local stamp, or nothing when it is not that form or not a real calendar time. */
export const parseLocalStamp = (value: string): number | undefined => {
  const match = LOCAL_STAMP.exec(value);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined;
  }
  return date.getTime();
};

/** `date` as a local stamp. */
export const formatLocalStamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
