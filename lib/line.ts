import { Client, middleware } from '@line/bot-sdk'
import { env } from './env'

export const lineConfig = {
  channelSecret: env.LINE_CHANNEL_SECRET,
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
}

export const lineClient = new Client(lineConfig)
export const lineMiddleware = middleware(lineConfig)
