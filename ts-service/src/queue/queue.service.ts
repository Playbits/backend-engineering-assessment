import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class QueueService {
  constructor(@InjectQueue("summarization") private readonly queue: Queue) {}

  async enqueue<TPayload>(name: string, payload: TPayload): Promise<void> {
    await this.queue.add(name, payload, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }
}
