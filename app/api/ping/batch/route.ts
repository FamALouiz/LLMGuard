import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface BatchPingRequest {
    requests: Array<{
        sourceNodeId: string;
        targetIp: string;
        targetNodeId: string;
    }>;
    count?: number;
}

interface BatchPingResult {
    sourceNodeId: string;
    targetNodeId: string;
    targetIp: string;
    success: boolean;
    output?: string;
    error?: string;
    statistics?: {
        packetLoss?: number;
        avgLatency?: number;
        minLatency?: number;
        maxLatency?: number;
    };
    timestamp: string;
}

export async function POST(request: NextRequest) {
    try {
        const { requests, count = 1 }: BatchPingRequest = await request.json();

        if (!requests || !Array.isArray(requests) || requests.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Requests array is required and must not be empty",
                },
                { status: 400 }
            );
        }

        // Validate IP address format
        const ipRegex =
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

        const results: BatchPingResult[] = [];

        // Process requests in parallel with a concurrency limit
        const concurrencyLimit = 3;
        const chunks = [];

        for (let i = 0; i < requests.length; i += concurrencyLimit) {
            chunks.push(requests.slice(i, i + concurrencyLimit));
        }

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (req) => {
                const { sourceNodeId, targetIp, targetNodeId } = req;

                // Validate inputs
                if (!sourceNodeId || !targetIp || !targetNodeId) {
                    return {
                        sourceNodeId: sourceNodeId || "unknown",
                        targetNodeId: targetNodeId || "unknown",
                        targetIp: targetIp || "unknown",
                        success: false,
                        error: "Missing required fields",
                        timestamp: new Date().toISOString(),
                    };
                }

                if (!ipRegex.test(targetIp)) {
                    return {
                        sourceNodeId,
                        targetNodeId,
                        targetIp,
                        success: false,
                        error: "Invalid IP address format",
                        timestamp: new Date().toISOString(),
                    };
                }

                try {
                    // Execute ping command with shorter timeout for batch operations
                    const pingCommand = `docker exec ${sourceNodeId} ping -c ${count} -W 2 ${targetIp}`;

                    const { stdout, stderr } = await execAsync(pingCommand, {
                        timeout: 8000, // Shorter timeout for batch operations
                    });

                    const output = stdout.trim();
                    const isSuccessful =
                        !stderr &&
                        output.includes("packets transmitted") &&
                        !output.includes("100% packet loss");

                    // Parse statistics
                    let avgLatency: number | undefined;
                    let minLatency: number | undefined;
                    let maxLatency: number | undefined;
                    let packetLoss: number | undefined;

                    if (isSuccessful) {
                        // Extract packet loss percentage
                        const lossMatch = output.match(/([0-9]+)% packet loss/);
                        if (lossMatch) {
                            packetLoss = parseInt(lossMatch[1]);
                        }

                        // Extract latency statistics (min/avg/max)
                        const latencyMatch = output.match(
                            /min\/avg\/max[^=]*=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)/
                        );
                        if (latencyMatch) {
                            minLatency = parseFloat(latencyMatch[1]);
                            avgLatency = parseFloat(latencyMatch[2]);
                            maxLatency = parseFloat(latencyMatch[3]);
                        }
                    }

                    return {
                        sourceNodeId,
                        targetNodeId,
                        targetIp,
                        success: isSuccessful,
                        output,
                        error: stderr || undefined,
                        statistics: {
                            packetLoss,
                            avgLatency,
                            minLatency,
                            maxLatency,
                        },
                        timestamp: new Date().toISOString(),
                    };
                } catch (execError: any) {
                    return {
                        sourceNodeId,
                        targetNodeId,
                        targetIp,
                        success: false,
                        error: execError.message || "Execution failed",
                        statistics: {
                            packetLoss: 100,
                        },
                        timestamp: new Date().toISOString(),
                    };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);

            // Small delay between chunks to avoid overwhelming the system
            if (chunks.length > 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                results,
                totalRequests: requests.length,
                completedRequests: results.length,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error("Batch ping API error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal server error",
            },
            { status: 500 }
        );
    }
}

// GET endpoint for health check
export async function GET(request: NextRequest) {
    return NextResponse.json({
        success: true,
        message: "Batch ping API is operational",
        timestamp: new Date().toISOString(),
    });
}
