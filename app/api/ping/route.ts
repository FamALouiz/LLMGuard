import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface PingRequest {
    sourceNodeId: string;
    targetIp: string;
    count?: number;
}

export async function POST(request: NextRequest) {
    try {
        const {
            sourceNodeId,
            targetIp,
            count = 3,
        }: PingRequest = await request.json();

        if (!sourceNodeId || !targetIp) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Source node ID and target IP are required",
                },
                { status: 400 }
            );
        }

        // Validate IP address format (basic validation)
        const ipRegex =
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(targetIp)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid IP address format",
                },
                { status: 400 }
            );
        }

        // Execute ping command in the Docker container
        const pingCommand = `docker exec ${sourceNodeId} ping -c ${count} -W 3 ${targetIp}`;

        try {
            const { stdout, stderr } = await execAsync(pingCommand, {
                timeout: 15000,
            });

            // Parse ping output
            const output = stdout.trim();
            const isSuccessful =
                !stderr &&
                output.includes("packets transmitted") &&
                !output.includes("100% packet loss");

            // Extract latency information
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

            return NextResponse.json({
                success: true,
                data: {
                    success: isSuccessful,
                    sourceNodeId,
                    targetIp,
                    output,
                    error: stderr || null,
                    statistics: {
                        packetLoss,
                        avgLatency,
                        minLatency,
                        maxLatency,
                    },
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (execError: any) {
            // Handle execution errors (timeouts, container not found, etc.)
            const errorMessage = execError.message || "Unknown execution error";

            return NextResponse.json({
                success: true,
                data: {
                    success: false,
                    sourceNodeId,
                    targetIp,
                    output: "",
                    error: errorMessage,
                    statistics: {
                        packetLoss: 100,
                        avgLatency: undefined,
                        minLatency: undefined,
                        maxLatency: undefined,
                    },
                    timestamp: new Date().toISOString(),
                },
            });
        }
    } catch (error: any) {
        console.error("Ping API error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal server error",
            },
            { status: 500 }
        );
    }
}

// GET endpoint to retrieve ping history (if needed in the future)
export async function GET(request: NextRequest) {
    return NextResponse.json({
        success: true,
        message: "Ping history not implemented yet",
        data: [],
    });
}
