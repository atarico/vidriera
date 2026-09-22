import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import type { IngestQueue } from '../ports'

/**
 * IngestQueue adapter over Amazon SQS. The only file allowed to import
 * @aws-sdk/client-sqs in this service.
 *
 * Per AWS SDK v3 Lambda best practice, the client is constructed once,
 * outside the handler code path, and reused across warm invocations.
 */
export function createSqsIngestQueue(queueUrl: string, client: SQSClient = new SQSClient({})): IngestQueue {
  return {
    async enqueue(message) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            operation: { DataType: 'String', StringValue: message.operation },
          },
        }),
      )
    },
  }
}
