import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { z } from "zod";

// Initialize Ollama client
const ollama = new Ollama({
    host: "http://localhost:11434",
});

// Define response schemas for structured output
const CommandResponseSchema = {
    type: "object",
    properties: {
        type: {
            type: "string",
            enum: ["command", "explanation", "error"],
        },
        content: {
            type: "string",
        },
        commands: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    target: { type: "string" },
                    parameters: {
                        type: "object",
                        additionalProperties: true,
                    },
                    description: { type: "string" },
                },
                required: ["action", "description"],
            },
        },
        networkChanges: {
            type: "object",
            properties: {
                nodes: {
                    type: "array",
                    items: { type: "object" },
                },
                connections: {
                    type: "array",
                    items: { type: "object" },
                },
                rules: {
                    type: "array",
                    items: { type: "string" },
                },
            },
        },
    },
    required: ["type", "content"],
};

const TextResponseSchema = {
    type: "object",
    properties: {
        type: { type: "string", enum: ["text"] },
        content: { type: "string" },
    },
    required: ["type", "content"],
};

export async function POST(request: NextRequest) {
    try {
        const { message, context } = await request.json();

        // Determine if this is a command request or general query
        const commandKeywords = [
            "command",
            "execute",
            "run",
            "apply",
            "block",
            "allow",
            "rule",
            "iptables",
            "add",
            "remove",
            "delete",
            "create",
            "configure",
            "set",
            "enable",
            "disable",
            "drop",
            "accept",
            "reject",
            "forward",
            "input",
            "output",
            "chain",
            "table",
            "flush",
            "policy",
            "insert",
            "append",
            "firewall",
            "route",
            "redirect",
            "nat",
            "masquerade",
            "port",
            "protocol",
            "tcp",
            "udp",
            "icmp",
            "ssh",
            "http",
            "https",
            "connect",
            "disconnect",
            "link",
            "unlink",
            "bridge",
            "subnet",
            "vlan",
            "interface",
        ];

        const isCommandRequest = commandKeywords.some((keyword) =>
            message.toLowerCase().includes(keyword)
        );

        if (isCommandRequest) {
            // Generate structured response for commands
            const prompt = `You are an expert network security assistant for LLMGuard. 

Current network context: ${JSON.stringify(context)}

Analyze the request and provide a structured response with specific commands that can be executed on the network topology. Focus on iptables rules, network configuration, or topology changes.
After generating the request, generate a quick summary of the changes being made.

For iptables commands, provide the exact command syntax.
For network changes, specify node IDs and connection modifications.
Always include a clear description of what each command does.

Respond in JSON format with:
- type: "command"
- content: A brief explanation of what you're doing
- commands: Array of command objects with action, target, parameters, and description

Example response format:
{
  "type": "command",
  "content": "I'll create iptables rules to block traffic between the specified nodes.",
  "commands": [
    {
      "action": "iptables",
      "target": "fw-1",
      "parameters": {
        "rule": "iptables -A FORWARD -s 172.20.3.10 -d 172.20.3.11 -j DROP"
      },
      "description": "Block traffic from user-1 to user-2"
    }
  ]
}`;

            const response = await ollama.generate({
                model: "qwen3:4b",
                prompt: prompt,
                system: message,
                format: CommandResponseSchema,
                options: {
                    temperature: 0.1,
                },
            });

            try {
                const parsedResponse = JSON.parse(response.response);

                return NextResponse.json({
                    success: true,
                    data: parsedResponse,
                    type: "structured",
                });
            } catch (parseError) {
                // Fallback to text response if JSON parsing fails
                return NextResponse.json({
                    success: true,
                    data: {
                        type: "explanation",
                        content: response.response,
                    },
                    type: "text",
                });
            }
        } else {
            // Use regular text generation for explanations
            const prompt = `You are an expert network security assistant for LLMGuard.

    Current network context: ${JSON.stringify(context)}

Provide a helpful, detailed explanation about network security, firewall rules, or topology analysis. Be specific and technical when appropriate. Keep responses concise but informative.
Be friendly but still professional.
`;

            const response = await ollama.chat({
                model: "qwen3:4b",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: message },
                ],
                options: {
                    temperature: 0.3,
                },
                format: TextResponseSchema,
            });

            return NextResponse.json({
                success: true,
                data: {
                    type: "explanation",
                    content: JSON.parse(response.message.content).content,
                },
                type: "text",
            });
        }
    } catch (error) {
        console.error("LLM API Error:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to process request",
            },
            { status: 500 }
        );
    }
}
