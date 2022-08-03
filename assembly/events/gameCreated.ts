import { emitEvent } from "../util/event";

export function EMIT_GAME_CREATED(pin: string): void {
  const eventData: Map<string, string> = new Map<string, string>();

  eventData.set("pin", pin);

  emitEvent("create_game", eventData);
}
