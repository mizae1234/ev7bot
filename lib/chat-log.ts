import { prisma } from '@/lib/prisma'

export async function logChatToDb(
  sourceType: string,
  sourceId: string | null,
  userName: string | undefined,
  userMessage: string,
  botReply: string
) {
  try {
    await prisma.chatLog.create({
      data: {
        sourceType,
        sourceId: sourceId || null,
        userName: userName || null,
        userMessage: userMessage.substring(0, 2000),
        botReply: botReply.substring(0, 5000),
      },
    })
  } catch (err) {
    console.error('[DB Error] Failed to log chat:', err)
  }
}
