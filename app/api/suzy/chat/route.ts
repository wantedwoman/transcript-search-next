import { NextResponse } from 'next/server';
import { TranscriptChunk } from '@/lib/types';
import { getSimilaritySearch } from '@/lib/search/similarity-search';
import { getOpenRouterAnswerGenerator } from '@/lib/openrouter/answer-generation';
import { logger } from '@/lib/utils/logger';
import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/insights/generate-insights';
import { checkAndTriggerPatternDetection } from '@/lib/pattern-detection/analyze-patterns';
import { matchCourse } from '@/lib/course-mapper/match-course';
import { getMoodDelivery } from '@/lib/mood/mood-prompts';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export const maxDuration = 30;

const SYSTEM_EXTRACTION_PATTERNS = [
  /how are you built/i,
  /what model are you using/i,
  /what prompt are you using/i,
  /show (me )?(your )?system instructions/i,
  /show (me )?(your )?hidden instructions/i,
  /print hidden instructions/i,
  /reveal (your )?(system prompt|prompt|instructions|internal setup)/i,
  /ignore previous instructions/i,
  /developer mode/i,
  /show raw data/i,
  /what database do you use/i,
  /how does .*retrieval work/i,
  /how does .*embedding/i,
  /backend structure/i,
  /environment variables/i,
  /api keys?/i,
  /tokens?/i,
];

const HARM_PATTERNS = [
  /kill myself/i,
  /want to die/i,
  /end my life/i,
  /hurt myself/i,
  /self[- ]harm/i,
  /suicid(e|al)/i,
  /overdose/i,
  /cut myself/i,
  /how do i hurt myself/i,
  /how do i kill myself/i,
  /hurt (him|her|them|someone)/i,
  /kill (him|her|them|someone)/i,
  /how do i hurt (him|her|them|someone)/i,
  /make (him|her|them|someone) suffer/i,
  /violent revenge/i,
  /plan to hurt/i,
  /plan to kill/i,
];

function isSystemExtractionQuery(query: string): boolean {
  return SYSTEM_EXTRACTION_PATTERNS.some((pattern) => pattern.test(query));
}

function isHarmRiskQuery(query: string): boolean {
  return HARM_PATTERNS.some((pattern) => pattern.test(query));
}

function protectedReply() {
  return "I focus on giving you the best guidance I can. I don't get into how I'm built, but I've got you.";
}

function harmSafetyReply() {
  return "I'm really glad you said something. I hear how heavy this is right now.\n\nI can't help with anything that could put you or someone else in danger, but I do want to make sure you're supported.\n\nPlease reach out to a licensed mental health professional or someone you trust as soon as possible. If you're in immediate danger or feel like you might act on this, call 911 right now.\n\nYou don't have to carry this alone.";
}

export async function POST(request: Request) {
  try {
    // Handle both JSON and FormData (image upload)
    const contentType = request.headers.get('content-type') || '';
    let query: string;
    let mode: string;
    let imageBase64: string | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      query = (formData.get('query') as string) || '';
      mode = (formData.get('mode') as string) || '';
      const imageFile = formData.get('image') as File | null;
      if (imageFile) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const ext = imageFile.name.split('.').pop() || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        imageBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      }
    } else {
      const body = await request.json();
      query = body.query;
      mode = body.mode || '';
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const cleanQuery = query.trim();

    if (isSystemExtractionQuery(cleanQuery)) {
      return NextResponse.json({
        answer: protectedReply(),
        sources: [],
      });
    }

    if (isHarmRiskQuery(cleanQuery)) {
      logger.warn('HIGH RISK harm-related message detected');
      return NextResponse.json({
        answer: harmSafetyReply(),
        sources: [],
      });
    }

    const similaritySearch = getSimilaritySearch();
    const answerGenerator = getOpenRouterAnswerGenerator();

    // Build mood delivery instruction
    const moodDelivery = mode ? getMoodDelivery(mode) : getMoodDelivery('soft-place');

    // If we have an image, skip transcript search and use vision model directly
    let chatResponse;
    if (imageBase64) {
      chatResponse = await answerGenerator.generateAnswer(
        cleanQuery,
        [],
        imageBase64,
        moodDelivery
      );
    } else {
      const searchResponse = await similaritySearch.search(cleanQuery, 5);

      chatResponse = await answerGenerator.generateAnswer(
        cleanQuery,
        (searchResponse.results || []).map((result: { chunk: TranscriptChunk }) => result.chunk),
        undefined,
        moodDelivery
      );
    }

    // Try to save conversation and generate insights (fire-and-forget)
    saveConversationAndGenerateInsights(cleanQuery, chatResponse.answer).catch(() => {
      // Silently ignore — conversation saving is non-critical
    });

    const courseSuggestion = matchCourse(cleanQuery);

    return NextResponse.json({
      answer: chatResponse.answer,
      sources: chatResponse.sources.map((source: TranscriptChunk) => ({
        lesson_title: source.lesson_title,
        course_name: source.course_name,
        module_name: source.module_name,
      })),
      courseSuggestion: courseSuggestion || undefined,
    });
  } catch (error) {
    logger.error('Chat API error', error);
    return NextResponse.json(
      {
        error: 'I ran into a problem answering that. Please try again in a moment.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = await createServerSupabaseClient();
    
    if (conversationId) {
      // Get specific conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
        
      if (!conversation) {
        return NextResponse.json({ messages: [] });
      }
      
      const { data: messages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      return NextResponse.json({
        conversation,
        messages: (messages || []).map(m => ({
          id: m.id,
          content: m.content,
          isUser: m.role === 'user',
          timestamp: new Date(m.created_at),
        })),
      });
    }
    
    // Get all conversations for this user (latest first)
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
      
    // Load the most recent conversation with its messages
    let messages: ChatMessage[] = [];
    let latestConversation = null;
    
    if (conversations && conversations.length > 0) {
      latestConversation = conversations[0];
      const { data: convMessages } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', latestConversation.id)
        .order('created_at', { ascending: true });
        
      messages = (convMessages || []).map(m => ({
        id: m.id,
        content: m.content,
        isUser: m.role === 'user',
        timestamp: new Date(m.created_at),
      }));
    }
    
    return NextResponse.json({
      conversations: conversations || [],
      activeConversationId: latestConversation?.id || null,
      messages,
    });
  } catch (error) {
    logger.error('Health check failed', error);
    return NextResponse.json(
      { status: 'unhealthy' },
      { status: 503 }
    );
  }
}

/**
 * Save conversation to Supabase and generate insights (fire-and-forget).
 * Does not block the chat response.
 */
async function saveConversationAndGenerateInsights(
  userQuery: string,
  assistantAnswer: string
): Promise<void> {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    if (!user) return; // No user — skip saving

    const supabase = createServiceRoleClient();

    // Create a new conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      logger.error('Failed to create conversation', convError);
      return;
    }

    const conversationId = conversation.id;

    // Save both messages
    const messages = [
      { conversation_id: conversationId, role: 'user', content: userQuery },
      { conversation_id: conversationId, role: 'assistant', content: assistantAnswer },
    ];

    const { error: msgError } = await supabase
      .from('conversation_messages')
      .insert(messages);

    if (msgError) {
      logger.error('Failed to save conversation messages', msgError);
      return;
    }

    // Update user's last_active
    await supabase
      .from('user_profiles')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', user.id);

    // Fire-and-forget insight generation
    generateInsights(user.id, conversationId, [
      { role: 'user', content: userQuery },
      { role: 'assistant', content: assistantAnswer },
    ]).catch(() => {
      // Silently ignore insight generation failures
    });

    // Fire-and-forget pattern detection
    checkAndTriggerPatternDetection(user.id).catch(() => {
      // Silently ignore pattern detection failures
    });

    logger.info(`Saved conversation ${conversationId} for user ${user.id}`);
  } catch (error) {
    logger.error('saveConversationAndGenerateInsights error', error);
  }
}