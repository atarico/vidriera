/**
 * A message read back from the DLQ, with its own replay counter already
 * decoded from the queue's message attributes. `id` is an opaque handle
 * the adapter needs to remove it later (e.g. an SQS receipt handle) — the
 * domain never interprets it.
 */
export interface ReplayableMessage {
  id: string
  body: string
  replayCount: number
}

export interface DeadLetterSource {
  /** Receives up to maxMessages currently available in the DLQ. */
  receive(maxMessages: number): Promise<ReplayableMessage[]>
  /** Removes a message from the DLQ once it has been redriven. */
  remove(message: ReplayableMessage): Promise<void>
}

export interface MainQueue {
  /** Sends body back to the main queue, carrying the bumped replay count. */
  send(body: string, replayCount: number): Promise<void>
}
