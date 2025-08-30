import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { commandKeywords } from "@/data/keywords";

const execAsync = promisify(exec);

// Initialize Ollama client
const ollama = new Ollama({
    host: "http://localhost:11434",
});

// Function to get current iptables rules from firewall container
async function getCurrentIptablesRules(context?: any): Promise<string> {
    try {
        // Try to find firewall node from context, fallback to default
        let firewallNodeId = "fw-001";

        if (context?.nodes) {
            const firewallNode = context.nodes.find(
                (node: any) =>
                    node.type === "firewall" || node.id.startsWith("fw-")
            );
            if (firewallNode) {
                firewallNodeId = firewallNode.id;
            }
        }

        // Get all iptables rules with detailed information
        const commands = [
            `docker exec ${firewallNodeId} iptables -L -n -v --line-numbers`,
            `docker exec ${firewallNodeId} iptables -t nat -L -n -v --line-numbers`,
            `docker exec ${firewallNodeId} iptables -t mangle -L -n -v --line-numbers`,
        ];

        const results = [];

        for (const command of commands) {
            try {
                const { stdout } = await execAsync(command);
                results.push(stdout.trim());
            } catch (error) {
                console.warn(`Failed to execute: ${command}`, error);
                results.push(
                    `Failed to retrieve rules for ${
                        command.split(" ")[4]
                    } table`
                );
            }
        }

        return `FILTER TABLE:\n${results[0]}\n\nNAT TABLE:\n${results[1]}\n\nMANGLE TABLE:\n${results[2]}`;
    } catch (error) {
        console.error("Failed to get iptables rules:", error);
        return "Failed to retrieve current iptables rules. Container may not be running or accessible.";
    }
}

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
        const isCommandRequest = commandKeywords.some((keyword) =>
            message.toLowerCase().includes(keyword)
        );

        if (isCommandRequest) {
            // Get current iptables rules before generating response
            const currentIptablesRules = await getCurrentIptablesRules(context);

            // Generate structured response for commands
            const prompt = `You are an expert network security assistant for LLMGuard. 

Current network context: ${JSON.stringify(context)}

CURRENT IPTABLES RULES ON FIREWALL:
${currentIptablesRules}

IMPORTANT: Before adding any new iptables rules, you MUST:
1. Check if any existing rules conflict with the new rule you want to add
2. If there are conflicting rules, remove them first using the appropriate iptables -D command
3. Then add the new rule
4. Ensure rules don't overlap or create contradictions

Analyze the request and provide a structured response with specific commands that can be executed on the network topology. Focus on iptables rules, network configuration, or topology changes.
After generating the request, generate a quick summary of the changes being made.

For iptables commands, provide the exact command syntax. Make sure to ALWAYS include the target DEVICE.
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
                    temperature: 0.05,
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
