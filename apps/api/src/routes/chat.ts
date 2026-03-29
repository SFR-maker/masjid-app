import { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { prisma } from '@masjid/database'
import { requireAuth } from '../plugins/auth'
import { generateEmbedding, cosineSimilarity, SIMILARITY_THRESHOLD } from '../lib/embeddings'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Masjidly AI, an Islamic educational assistant integrated into a mosque community app.

Your purpose:
- Answer questions about Islam in a respectful, scholarly, and balanced way
- Help users understand Islamic practices, history, and concepts
- Provide information about mosque services and the app
- Cite Quran (format: Surah Name, Chapter:Verse) and authentic Hadith (format: Source - Book/Number) when relevant

Your boundaries:
- You are an educational tool, NOT a mufti or scholar issuing fatwas
- For complex fiqh questions or sensitive rulings, ALWAYS say: "For a definitive ruling on this, I'd recommend consulting your local imam or a qualified Islamic scholar."
- Do NOT take sides in sectarian debates (Sunni vs Shia, madhab differences)
- Do NOT discuss politically controversial topics
- Maintain a calm, dignified, and spiritually uplifting tone
- If asked something outside Islamic knowledge or app help, politely redirect

Always respond as an educational resource, never as a religious authority.`

export async function chatRoutes(app: FastifyInstance) {
  // POST /chat/conversations — start conversation
  app.post('/conversations', { preHandler: [requireAuth] }, async (req, reply) => {
    const conversation = await prisma.chatConversation.create({
      data: { userId: req.userId! },
    })
    return reply.status(201).send({ success: true, data: conversation })
  })

  // GET /chat/conversations/:id
  app.get('/conversations/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const conversation = await prisma.chatConversation.findFirst({
      where: { id, userId: req.userId! },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    if (!conversation) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' })
    }

    return reply.send({ success: true, data: conversation })
  })

  // GET /chat/conversations — list user's conversations
  app.get('/conversations', { preHandler: [requireAuth] }, async (req, reply) => {
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return reply.send({ success: true, data: conversations })
  })

  // POST /chat/conversations/:id/messages — send message
  app.post('/conversations/:id/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id: conversationId } = req.params as { id: string }
    const { content } = z.object({ content: z.string().min(1).max(2000) }).parse(req.body)

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId: req.userId! },
      include: {
        // Take the most recent 19 messages so we can append the new one within the 20-message window
        messages: { orderBy: { createdAt: 'desc' }, take: 19 },
      },
    })

    if (!conversation) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' })
    }

    // Reverse to chronological order
    const recentMessages = conversation.messages.slice().reverse()

    // Save user message
    await prisma.chatMessage.create({
      data: { conversationId, role: 'USER', content },
    })

    // Build a strictly alternating history for the Anthropic API.
    // If previous calls partially failed (user msg saved, no assistant response),
    // the raw DB history may have consecutive USER turns — fix by collapsing them.
    const rawHistory: Anthropic.MessageParam[] = recentMessages.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }))
    rawHistory.push({ role: 'user', content })

    const history: Anthropic.MessageParam[] = []
    for (const msg of rawHistory) {
      if (history.length > 0 && history[history.length - 1].role === msg.role) {
        // Merge consecutive same-role messages to satisfy Anthropic's alternating constraint
        const prev = history[history.length - 1]
        prev.content = `${prev.content}\n${msg.content}`
      } else {
        history.push({ ...msg })
      }
    }

    // Anthropic requires the last message to be from the user
    if (history[history.length - 1]?.role !== 'user') {
      history.push({ role: 'user', content })
    }

    // ── Cache check (exact match first, then semantic) ───────────────────────
    const normalizedQuestion = content.trim().toLowerCase()
    let cachedAnswer: string | null = null
    let cacheHitId: string | null = null

    // 1. Exact match — instant, no API call needed
    const exactHit = await prisma.chatCache.findFirst({
      where: { question: { equals: normalizedQuestion, mode: 'insensitive' } },
      orderBy: { hitCount: 'desc' },
      select: { id: true, answer: true },
    })

    if (exactHit) {
      cachedAnswer = exactHit.answer
      cacheHitId = exactHit.id
    }

    // 2. Semantic match — only if exact miss and Voyage AI key is configured
    if (!cachedAnswer) {
      const queryEmbedding = await generateEmbedding(content)

      if (queryEmbedding) {
        const cacheEntries = await prisma.chatCache.findMany({
          orderBy: { hitCount: 'desc' },
          take: 500,
          select: { id: true, answer: true, embedding: true },
        })

        let bestScore = 0

        for (const entry of cacheEntries) {
          if (entry.embedding.length === 0) continue
          const score = cosineSimilarity(queryEmbedding, entry.embedding)
          if (score > bestScore) {
            bestScore = score
            cacheHitId = entry.id
            cachedAnswer = entry.answer
          }
        }

        if (bestScore < SIMILARITY_THRESHOLD) {
          cachedAnswer = null
          cacheHitId = null
        }

        // On a miss, call Anthropic then store result for future lookups
        if (!cachedAnswer) {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: history,
          })

          cachedAnswer = response.content[0].type === 'text' ? response.content[0].text : ''

          prisma.chatCache
            .create({
              data: { question: normalizedQuestion, answer: cachedAnswer, embedding: queryEmbedding },
            })
            .catch(() => {})

          const assistantMessage = await prisma.chatMessage.create({
            data: { conversationId, role: 'ASSISTANT', content: cachedAnswer, tokensUsed: response.usage.output_tokens },
          })
          await prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
          if (cacheHitId) prisma.chatCache.update({ where: { id: cacheHitId }, data: { hitCount: { increment: 1 } } }).catch(() => {})
          return reply.send({ success: true, data: assistantMessage })
        }
      } else {
        // No Voyage AI key — fall back to direct Anthropic call
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: history,
        })

        const assistantContent = response.content[0].type === 'text' ? response.content[0].text : ''
        const assistantMessage = await prisma.chatMessage.create({
          data: { conversationId, role: 'ASSISTANT', content: assistantContent, tokensUsed: response.usage.output_tokens },
        })
        await prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
        return reply.send({ success: true, data: assistantMessage })
      }
    }

    if (cacheHitId) {
      prisma.chatCache.update({ where: { id: cacheHitId }, data: { hitCount: { increment: 1 } } }).catch(() => {})
    }
    // ────────────────────────────────────────────────────────────────────────

    const assistantContent = cachedAnswer ?? ''
    const tokensUsed = undefined

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: assistantContent,
        tokensUsed,
      },
    })

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return reply.send({ success: true, data: assistantMessage })
  })
}
