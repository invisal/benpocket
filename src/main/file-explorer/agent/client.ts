import { getAiGatewayCredential } from '../aiGatewayCredential';
import { AGENT_TOOLS } from './tools';
import type { AgentMessage, AgentSendResult } from './types';

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

interface OpenAiChatCompletionResponse {
  choices?: { message?: OpenAiMessage }[];
  usage?: OpenAiUsage;
}

function toWireMessage(message: AgentMessage): OpenAiMessage {
  const wire: OpenAiMessage = { role: message.role, content: message.content };
  if (message.toolCalls) {
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments }
    }));
  }
  if (message.toolCallId) wire.tool_call_id = message.toolCallId;
  if (message.name) wire.name = message.name;
  return wire;
}

/**
 * One request, one response -- no streaming. Provider API keys are expected to
 * already be configured as BYOK on the gateway itself; this only needs the
 * Cloudflare account/gateway credentials.
 */
export async function sendChatCompletion(messages: AgentMessage[]): Promise<AgentSendResult> {
  const credential = getAiGatewayCredential();
  if (!credential) return { error: 'AI Gateway is not connected.' };

  const url = `https://api.cloudflare.com/client/v4/accounts/${credential.accountId}/ai/v1/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiToken}`,
        'cf-aig-gateway-id': credential.gatewayId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: credential.model,
        messages: messages.map(toWireMessage),
        tools: AGENT_TOOLS.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters }
        }))
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return { error: `AI Gateway request failed (${response.status}): ${body.slice(0, 500)}` };
    }

    const data = (await response.json()) as OpenAiChatCompletionResponse;
    const message = data.choices?.[0]?.message;
    if (!message) return { error: 'AI Gateway returned an empty response.' };

    return {
      message: {
        role: 'assistant',
        content: message.content ?? null,
        toolCalls: message.tool_calls?.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments
        }))
      },
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0
          }
        : undefined
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
