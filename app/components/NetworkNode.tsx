"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { Globe, Monitor, Network, Router, Server, Shield } from "lucide-react";
import React from "react";

interface NetworkNodeData {
    id: string;
    type: string;
    name: string;
    status: "active" | "warning" | "error" | "inactive";
    config: Record<string, any>;
}

const getNodeIcon = (type: string) => {
    switch (type) {
        case "firewall":
            return Shield;
        case "server":
            return Server;
        case "router":
            return Router;
        case "switch":
            return Network;
        case "user":
            return Monitor;
        case "external":
            return Globe;
        default:
            return Network;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case "active":
            return "border-green-400 bg-green-50 text-green-700";
        case "warning":
            return "border-yellow-400 bg-yellow-50 text-yellow-700";
        case "error":
            return "border-red-400 bg-red-50 text-red-700";
        case "inactive":
            return "border-gray-400 bg-gray-50 text-gray-700";
        default:
            return "border-blue-400 bg-blue-50 text-blue-700";
    }
};

export const NetworkNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as any;
    const Icon = getNodeIcon(nodeData.type);
    const statusColor = getStatusColor(nodeData.status);

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
            className={`relative min-w-[180px] rounded-lg border-2 p-4 shadow-lg transition-all duration-200 ${statusColor} ${
                selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
            }`}
        >
            {/* Handles for connections */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-blue-500 border-2 border-white"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-blue-500 border-2 border-white"
            />
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-blue-500 border-2 border-white"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 bg-blue-500 border-2 border-white"
            />

            {/* Node content */}
            <div className="flex items-center gap-3 mb-2">
                <Icon className="w-6 h-6" />
                <div>
                    <h3 className="font-semibold text-sm">{nodeData.name}</h3>
                    <p className="text-xs opacity-75 capitalize">
                        {nodeData.type}
                    </p>
                </div>
            </div>

            {/* Node metrics */}
            <div className="space-y-1 text-xs">
                {Object.entries(nodeData.config || {})
                    .slice(0, 2)
                    .map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                            <span className="opacity-75">
                                {key.replace(/_/g, " ")}:
                            </span>
                            <span className="font-medium">
                                {value as string}
                            </span>
                        </div>
                    ))}
            </div>

            {/* Pulse animation for active nodes */}
            {nodeData.status === "active" && (
                <motion.div
                    className="absolute inset-0 rounded-lg border-2 border-green-400"
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            )}
        </motion.div>
    );
};

export default NetworkNode;
