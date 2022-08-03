import { logging } from "near-sdk-as";

type EventData = Map<string, string>;

const STANDARD = "RPS";
const VERSION = "1.0.0";

export function emitEvent(
  eventName: string,
  eventData: EventData,
  standard: string = STANDARD,
  version: string = VERSION
): void {
  const serializedElements = new Array<string>();

  for (let index = 0; index < eventData.size; index++) {
    const key = eventData.keys()[index];
    const element = eventData.get(key);

    if (isBoolean(element)) {
      serializedElements.push(`"${key}": ${element}`);
    }

    if (isInteger(element)) {
      serializedElements.push(`"${key}": ${element}`);
    }

    if (isNull(element)) {
      serializedElements.push(`"${key}": null`);
    }

    if (isString(element)) {
      serializedElements.push(`"${key}": "${element}"`);
    }
  }

  const eventPayload = `EVENT_JSON:{"standard": "${standard}", "version": "${version}", "event": "${eventName}", "data": {${serializedElements.join(
    ","
  )}}}`;

  logging.log(eventPayload);
}
