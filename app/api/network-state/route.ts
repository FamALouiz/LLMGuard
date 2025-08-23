import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
    try {
        // Read the state.json file from the public directory
        const statePath = path.join(
            process.cwd(),
            "public",
            "simplified_state.json"
        );
        const stateContent = await readFile(statePath, "utf-8");
        const networkState = JSON.parse(stateContent);

        return NextResponse.json({
            success: true,
            data: networkState,
        });
    } catch (error) {
        console.error("Error reading network state:", error);

        // Return a default/empty state if file doesn't exist
        return NextResponse.json({
            success: false,
            error: "Failed to load network state",
            data: {
                network: {
                    name: "Default Network",
                    nodes: [],
                    connections: [],
                },
            },
        });
    }
}
