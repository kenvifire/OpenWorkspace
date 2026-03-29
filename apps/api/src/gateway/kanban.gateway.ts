import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type KanbanEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'comment:created';

export interface KanbanPayload {
  projectId: string;
  data: Record<string, unknown>;
}

const KANBAN_CHANNEL = 'kanban:events';

/**
 * Clients join a room per project: `project:{projectId}`.
 * Events emitted locally (by TasksService) are forwarded directly.
 * Events emitted by apps/runner are received via Redis pub/sub and forwarded here.
 */
@WebSocketGateway({
  cors: { origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true },
  namespace: '/kanban',
})
export class KanbanGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KanbanGateway.name);
  private subscriber: Redis;

  constructor(private readonly config: ConfigService) {}

  afterInit() {
    this.subscriber = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
    });

    this.subscriber.subscribe(KANBAN_CHANNEL, (err) => {
      if (err) this.logger.error('Redis subscribe error', err);
      else this.logger.log(`Subscribed to Redis channel: ${KANBAN_CHANNEL}`);
    });

    this.subscriber.on('message', (_channel, message) => {
      try {
        const { event, payload } = JSON.parse(message) as { event: KanbanEvent; payload: KanbanPayload };
        this.emit(event, payload);
      } catch (err) {
        this.logger.error('Failed to parse Kanban event from Redis', err);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:project')
  handleJoinProject(@MessageBody() projectId: string, @ConnectedSocket() client: Socket) {
    client.join(`project:${projectId}`);
    return { event: 'joined', data: projectId };
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(@MessageBody() projectId: string, @ConnectedSocket() client: Socket) {
    client.leave(`project:${projectId}`);
  }

  /** Emit to all clients in the project room (used by TasksService and Redis subscriber) */
  emit(event: KanbanEvent, payload: KanbanPayload) {
    this.server?.to(`project:${payload.projectId}`).emit(event, payload.data);
  }
}
