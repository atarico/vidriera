import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import type { DeadLetterSource, MainQueue, ReplayableMessage } from '../ports'

/** SQS hard limit: at most 10 messages per ReceiveMessage call. */
const MAX_RECEIVE_PER_CALL = 10

interface SqsMessageAttributeValue {
  StringValue?: string
}

/**
 * Pure: decodes the custom ReplayCount message attribute this adapter sets
 * on every redrive. Absent (first time in the DLQ) or malformed values
 * default to 0 rather than throwing — SQS's own ApproximateReceiveCount is
 * not used here because it does not survive a cross-queue redrive.
 */
export function parseReplayCount(attributes: Record<string, SqsMessageAttributeValue> | undefined): number {
  const raw = attributes?.ReplayCount?.StringValue
  if (!raw) {
    return 0
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/**
 * DeadLetterSource adapter over Amazon SQS. Loops ReceiveMessage calls (10
 * messages per call is SQS's hard limit) until maxMessages is reached or
 * the DLQ is exhausted.
 */
export function createSqsDeadLetterSource(dlqUrl: string, client: SQSClient = new SQSClient({})): DeadLetterSource {
  return {
    async receive(maxMessages) {
      const messages: ReplayableMessage[] = []

      while (messages.length < maxMessages) {
        const batchSize = Math.min(MAX_RECEIVE_PER_CALL, maxMessages - messages.length)
        const response = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: dlqUrl,
            MaxNumberOfMessages: batchSize,
            MessageAttributeNames: ['ReplayCount'],
            WaitTimeSeconds: 0,
          }),
        )

        const received = response.Messages ?? []
        if (received.length === 0) {
          break
        }

        for (const raw of received) {
          if (!raw.ReceiptHandle || raw.Body === undefined) {
            continue
          }
          messages.push({
            id: raw.ReceiptHandle,
            body: raw.Body,
            replayCount: parseReplayCount(raw.MessageAttributes),
          })
        }

        if (received.length < batchSize) {
          // Fewer than requested came back: the DLQ is exhausted for now.
          break
        }
      }

      return messages
    },
    async remove(message) {
      await client.send(new DeleteMessageCommand({ QueueUrl: dlqUrl, ReceiptHandle: message.id }))
    },
  }
}

/** MainQueue adapter over Amazon SQS. */
export function createSqsMainQueue(queueUrl: string, client: SQSClient = new SQSClient({})): MainQueue {
  return {
    async send(body, replayCount) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: body,
          MessageAttributes: {
            ReplayCount: { DataType: 'Number', StringValue: String(replayCount) },
          },
        }),
      )
    },
  }
}
