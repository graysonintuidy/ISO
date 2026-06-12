import { NextResponse } from 'next/server';
import vantage from '@/lib/vantage';

/**
 * POST /api/chat
 * AI Chat — accepts a natural language query, executes it against
 * the facility database via Vantage AI workflow, returns response.
 *
 * Body: { message: string, facilityId: number }
 */
export async function POST(request) {
  try {
    const { message, facilityId = 1 } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // The AI Chat workflow in Vantage would:
    // 1. Receive the natural language query
    // 2. Use an AI node to interpret intent and generate SQL
    // 3. Execute the SQL via DB Query node
    // 4. Use an AI node to format results into natural language
    // 5. Return the response
    const chatWorkflowId = process.env.VANTAGE_CHAT_WORKFLOW_ID;

    if (!chatWorkflowId) {
      // Workflow not yet configured — return a helpful message
      return NextResponse.json({
        response: `I'm not fully configured yet. The AI Chat workflow needs to be set up in Vantage to process your query: "${message}"\n\nOnce configured, I'll be able to:\n- Query incident reports and safety data\n- Show production line status and throughput\n- Look up employee information and shift schedules\n- Analyze alert patterns and trends\n- Generate compliance summaries`,
        workflowConfigured: false,
      });
    }

    const result = await vantage.executeWorkflow(chatWorkflowId, {
      query: message,
      facilityId,
      context: 'dashboard_chat',
    });

    return NextResponse.json({
      response: result?.response || result?.output || 'No response received from the AI engine.',
      data: result?.data || null,
      queryGenerated: result?.sql || null,
      workflowConfigured: true,
    });
  } catch (error) {
    console.error('[API] Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', response: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
