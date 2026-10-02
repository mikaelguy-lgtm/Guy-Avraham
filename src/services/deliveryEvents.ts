import type {Response} from "express";

interface Subscriber {userId: number; advisorId: number | null; isAdmin: boolean; response: Response}

export class DeliveryEventBroker {
  private readonly subscribers = new Set<Subscriber>();

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber.response.write(`event: ready\ndata: {}\n\n`);
    return () => this.subscribers.delete(subscriber);
  }

  publish(event: {type: string; advisorId: number; clientId: number; submissionPublicId: string}): void {
    const data = JSON.stringify(event);
    for (const subscriber of this.subscribers) {
      if (subscriber.isAdmin || subscriber.advisorId === event.advisorId) subscriber.response.write(`event: delivery\ndata: ${data}\n\n`);
    }
  }
}
