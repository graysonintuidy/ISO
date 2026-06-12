import { NextResponse } from 'next/server';
import vantage from '@/lib/vantage';

/**
 * GET /api/vantage/workflows
 * Lists all workflows configured in Vantage.
 */
export async function GET() {
  try {
    const workflows = await vantage.listWorkflows();
    return NextResponse.json(workflows);
  } catch (error) {
    console.error('[API] Workflows list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows', details: error.message },
      { status: error.status || 500 }
    );
  }
}

/**
 * POST /api/vantage/workflows
 * Execute a workflow by ID.
 * Body: { workflowId, input: {} }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { workflowId, input } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    const result = await vantage.executeWorkflow(workflowId, input || {});
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Workflow execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow', details: error.message },
      { status: error.status || 500 }
    );
  }
}
