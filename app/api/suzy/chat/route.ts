import { POST as ChatHandler, GET as HealthHandler } from '../../../api/chat/route';

export const POST = ChatHandler;
export const GET = HealthHandler;
export const maxDuration = 30;
