import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const { nodeId, position } = await request.json();

        if (
            !nodeId ||
            !position ||
            typeof position.x !== "number" ||
            typeof position.y !== "number"
        ) {
            return NextResponse.json(
                { error: "Invalid node ID or position" },
                { status: 400 }
            );
        }

        // Read the current state file
        const stateFilePath = path.join(
            process.cwd(),
            "public",
            "simplified_state.json"
        );
        const stateData = JSON.parse(fs.readFileSync(stateFilePath, "utf8"));

        // Find and update the node position
        const nodeIndex = stateData.network.nodes.findIndex(
            (node: any) => node.id === nodeId
        );

        if (nodeIndex === -1) {
            return NextResponse.json(
                { error: "Node not found" },
                { status: 404 }
            );
        }

        // Update the position
        stateData.network.nodes[nodeIndex].position = {
            x: Math.round(position.x),
            y: Math.round(position.y),
        };

        // Write back to file
        fs.writeFileSync(stateFilePath, JSON.stringify(stateData, null, 4));

        return NextResponse.json({
            success: true,
            nodeId,
            position: stateData.network.nodes[nodeIndex].position,
        });
    } catch (error) {
        console.error("Error updating node position:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
