import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const { commands, nodeId } = await request.json();

        if (!commands || !Array.isArray(commands)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid commands format",
                },
                { status: 400 }
            );
        }

        const results = [];

        for (const command of commands) {
            try {
                let dockerCommand = "";

                if (command.action === "iptables") {
                    // Execute iptables command in specific container
                    const targetNode = nodeId || command.target;
                    if (!targetNode) {
                        results.push({
                            command: command.action,
                            success: false,
                            error: "No target node specified for iptables command",
                        });
                        continue;
                    }

                    dockerCommand = `docker exec ${targetNode} ${command.parameters.rule}`;
                } else if (command.action === "network_config") {
                    // Execute network configuration
                    const targetNode = nodeId || command.target;
                    if (!targetNode) {
                        results.push({
                            command: command.action,
                            success: false,
                            error: "No target node specified for network config",
                        });
                        continue;
                    }

                    dockerCommand = `docker exec ${targetNode} ${command.parameters.command}`;
                } else if (command.action === "ping_test") {
                    // Execute ping test
                    const targetNode = nodeId || command.target;
                    if (!targetNode) {
                        results.push({
                            command: command.action,
                            success: false,
                            error: "No target node specified for ping test",
                        });
                        continue;
                    }

                    dockerCommand = `docker exec ${targetNode} ping -c 3 ${command.parameters.destination}`;
                } else if (command.action === "topology_change") {
                    // Handle topology changes (would require updating state.json and reinitializing)
                    results.push({
                        command: command.action,
                        success: false,
                        message:
                            "Topology changes require manual approval and system restart",
                    });
                    continue;
                } else {
                    // Generic docker exec command
                    const targetNode = nodeId || command.target;
                    if (!targetNode) {
                        results.push({
                            command: command.action,
                            success: false,
                            error: "No target node specified",
                        });
                        continue;
                    }

                    dockerCommand = `docker exec ${targetNode} ${
                        command.parameters?.command || command.action
                    }`;
                }

                if (dockerCommand) {
                    const { stdout, stderr } = await execAsync(dockerCommand);
                    results.push({
                        command: command.action,
                        description: command.description,
                        target: command.target,
                        success: true,
                        output: stdout.trim(),
                        error: stderr.trim() || null,
                    });
                }
            } catch (error: any) {
                console.error(`Command execution failed:`, error);
                results.push({
                    command: command.action,
                    description: command.description,
                    target: command.target,
                    success: false,
                    error: error.message || "Unknown error occurred",
                });
            }
        }

        return NextResponse.json({
            success: true,
            results,
        });
    } catch (error) {
        console.error("Execute command API error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
