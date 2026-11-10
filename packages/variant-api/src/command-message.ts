/** A shell command on the log stream: plus, then the command as a JSON string. */
export const commandMessage = (command: string): string => `+${JSON.stringify(command)}`;
