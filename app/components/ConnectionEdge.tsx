"use client";

import React from "react";
import { EdgeProps, getBezierPath } from "@xyflow/react";
import { motion } from "framer-motion";

interface ConnectionEdgeData {
    type: "wan" | "lan" | "suspicious";
    status: "active" | "warning" | "error" | "inactive";
    bandwidth?: string;
    latency?: string;
}

const getEdgeColor = (type: string, status: string) => {
    if (status === "error") return "#ef4444";
    if (status === "warning") return "#f59e0b";

    switch (type) {
        case "wan":
            return "#3b82f6";
        case "lan":
            return "#10b981";
        case "suspicious":
            return "#ef4444";
        default:
            return "#6b7280";
    }
};

const getEdgeWidth = (type: string) => {
    switch (type) {
        case "wan":
            return 3;
        case "lan":
            return 2;
        case "suspicious":
            return 2;
        default:
            return 1;
    }
};

export const ConnectionEdge: React.FC<EdgeProps> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}) => {
    const edgeData = data as any;
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const color = getEdgeColor(
        edgeData?.type || "lan",
        edgeData?.status || "active"
    );
    const width = getEdgeWidth(edgeData?.type || "lan");

    return (
        <>
            {/* Main edge path */}
            <path
                id={id}
                style={{
                    stroke: color,
                    strokeWidth: width,
                    filter: selected
                        ? "drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))"
                        : undefined,
                }}
                className="fill-none"
                d={edgePath}
            />

            {/* Animated flow for active connections */}
            {edgeData?.status === "active" && (
                <motion.circle
                    r="3"
                    fill={color}
                    initial={{ offsetDistance: "0%" }}
                    animate={{ offsetDistance: "100%" }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    style={{
                        offsetPath: `path('${edgePath}')`,
                        offsetRotate: "auto",
                    }}
                />
            )}

            {/* Edge label */}
            {edgeData && (
                <foreignObject
                    width={120}
                    height={40}
                    x={labelX - 60}
                    y={labelY - 20}
                    className="pointer-events-none"
                >
                    <div className="bg-white border rounded px-2 py-1 shadow-sm text-xs">
                        <div className="text-gray-600 font-bold">
                            {edgeData.type?.toUpperCase()}
                        </div>
                        {edgeData.bandwidth && (
                            <div className="text-gray-600">
                                {edgeData.bandwidth}
                            </div>
                        )}
                    </div>
                </foreignObject>
            )}
        </>
    );
};

export default ConnectionEdge;
