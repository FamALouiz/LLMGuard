"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    X,
    Zap,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    Network,
    Monitor,
    Server,
} from "lucide-react";
import React, { useState, useEffect } from "react";

interface PingResult {
    success: boolean;
    output?: string;
    error?: string;
    latency?: number;
    packetsLost?: number;
    timestamp: Date;
}

interface Node {
    id: string;
    name: string;
    type: string;
    status: string;
    ip?: string; // Add IP field
    config?: {
        ip_address?: string;
        [key: string]: any;
    };
}

interface PingModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceNode?: Node;
    nodes: Node[];
    onPingExecuted?: (
        sourceId: string,
        targetId: string,
        result: PingResult
    ) => void;
}

export const PingModal: React.FC<PingModalProps> = ({
    isOpen,
    onClose,
    sourceNode,
    nodes,
    onPingExecuted,
}) => {
    const [selectedSource, setSelectedSource] = useState<string>("");
    const [selectedTarget, setSelectedTarget] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [pingResults, setPingResults] = useState<PingResult[]>([]);
    const [currentResult, setCurrentResult] = useState<PingResult | null>(null);

    // Set initial source node when modal opens
    useEffect(() => {
        if (sourceNode && isOpen) {
            setSelectedSource(sourceNode.id);
        }
    }, [sourceNode, isOpen]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCurrentResult(null);
            setPingResults([]);
            if (!sourceNode) {
                setSelectedSource("");
                setSelectedTarget("");
            }
        }
    }, [isOpen, sourceNode]);

    const getNodeIcon = (type: string) => {
        switch (type) {
            case "server":
                return Server;
            case "firewall":
            case "router":
                return Network;
            default:
                return Monitor;
        }
    };

    const executePing = async () => {
        if (!selectedSource || !selectedTarget) {
            return;
        }

        if (selectedSource === selectedTarget) {
            setCurrentResult({
                success: false,
                error: "Cannot ping the same node",
                timestamp: new Date(),
            });
            return;
        }

        setIsLoading(true);
        setCurrentResult(null);

        try {
            // Get target node IP
            const targetNode = nodes.find((n) => n.id === selectedTarget);
            const targetIp = targetNode?.config?.ip_address || targetNode?.ip;

            if (!targetIp) {
                throw new Error("Target node IP address not found");
            }

            // Execute ping command via new ping API
            const response = await fetch("/api/ping", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sourceNodeId: selectedSource,
                    targetIp: targetIp,
                    count: 3,
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                const pingData = result.data;

                const pingResult: PingResult = {
                    success: pingData.success,
                    output: pingData.output,
                    error: pingData.error,
                    latency: pingData.statistics?.avgLatency,
                    packetsLost: pingData.statistics?.packetLoss,
                    timestamp: new Date(),
                };

                setCurrentResult(pingResult);
                setPingResults((prev) => [pingResult, ...prev].slice(0, 10)); // Keep last 10 results

                // Notify parent component
                onPingExecuted?.(selectedSource, selectedTarget, pingResult);
            } else {
                throw new Error(result.error || "Ping command failed");
            }
        } catch (error: any) {
            const pingResult: PingResult = {
                success: false,
                error: error.message || "Failed to execute ping",
                timestamp: new Date(),
            };

            setCurrentResult(pingResult);
            setPingResults((prev) => [pingResult, ...prev].slice(0, 10));
        } finally {
            setIsLoading(false);
        }
    };

    const formatLatency = (latency?: number) => {
        if (latency === undefined) return "N/A";
        return `${latency.toFixed(1)}ms`;
    };

    const formatPacketLoss = (packetsLost?: number) => {
        if (packetsLost === undefined) return "N/A";
        return `${packetsLost}%`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Zap className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Network Connectivity Test
                                </h2>
                                <p className="text-sm text-gray-600">
                                    Test communication between network hosts
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                        {/* Node Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Source Node */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Source Node
                                </label>
                                <select
                                    value={selectedSource}
                                    onChange={(e) =>
                                        setSelectedSource(e.target.value)
                                    }
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                                    disabled={!!sourceNode} // Disable if sourceNode is predefined
                                >
                                    <option value="">
                                        Select source node...
                                    </option>
                                    {nodes
                                        .filter(
                                            (node) => node.status === "active"
                                        )
                                        .map((node) => {
                                            const Icon = getNodeIcon(node.type);
                                            const nodeIp =
                                                node.config?.ip_address ||
                                                node.ip;
                                            return (
                                                <option
                                                    key={node.id}
                                                    value={node.id}
                                                    className="text-black"
                                                >
                                                    {node.name} ({node.type}){" "}
                                                    {nodeIp
                                                        ? `- ${nodeIp}`
                                                        : ""}
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>

                            {/* Target Node */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Target Node
                                </label>
                                <select
                                    value={selectedTarget}
                                    onChange={(e) =>
                                        setSelectedTarget(e.target.value)
                                    }
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                                >
                                    <option value="">
                                        Select target node...
                                    </option>
                                    {nodes
                                        .filter(
                                            (node) =>
                                                node.status === "active" &&
                                                node.id !== selectedSource
                                        )
                                        .map((node) => {
                                            const Icon = getNodeIcon(node.type);
                                            const nodeIp =
                                                node.config?.ip_address ||
                                                node.ip;
                                            return (
                                                <option
                                                    key={node.id}
                                                    value={node.id}
                                                    className="text-black"
                                                >
                                                    {node.name} ({node.type}){" "}
                                                    {nodeIp
                                                        ? `- ${nodeIp}`
                                                        : ""}
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>
                        </div>

                        {/* Execute Button */}
                        <div className="mb-6">
                            <button
                                onClick={executePing}
                                disabled={
                                    !selectedSource ||
                                    !selectedTarget ||
                                    isLoading
                                }
                                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Testing connectivity...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-5 h-5" />
                                        Execute Ping Test
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Current Result */}
                        {currentResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6"
                            >
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                    Latest Result
                                </h3>
                                <div
                                    className={`p-4 rounded-lg border-2 ${
                                        currentResult.success
                                            ? "border-green-200 bg-green-50"
                                            : "border-red-200 bg-red-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        {currentResult.success ? (
                                            <CheckCircle className="w-6 h-6 text-green-600" />
                                        ) : (
                                            <XCircle className="w-6 h-6 text-red-600" />
                                        )}
                                        <div>
                                            <p
                                                className={`font-medium ${
                                                    currentResult.success
                                                        ? "text-green-800"
                                                        : "text-red-800"
                                                }`}
                                            >
                                                {currentResult.success
                                                    ? "Connection Successful"
                                                    : "Connection Failed"}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                <Clock className="w-4 h-4 inline mr-1" />
                                                {currentResult.timestamp.toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>

                                    {currentResult.success && (
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div className="text-sm">
                                                <span className="text-gray-600">
                                                    Latency:
                                                </span>
                                                <span className="ml-2 font-medium text-green-700">
                                                    {formatLatency(
                                                        currentResult.latency
                                                    )}
                                                </span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-gray-600">
                                                    Packet Loss:
                                                </span>
                                                <span className="ml-2 font-medium text-green-700">
                                                    {formatPacketLoss(
                                                        currentResult.packetsLost
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {(currentResult.output ||
                                        currentResult.error) && (
                                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
                                            {currentResult.output ||
                                                currentResult.error}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Previous Results */}
                        {pingResults.length > 1 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                    Previous Results
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {pingResults
                                        .slice(1)
                                        .map((result, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {result.success ? (
                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-600" />
                                                    )}
                                                    <span className="text-sm font-medium">
                                                        {result.success
                                                            ? "Success"
                                                            : "Failed"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    {result.success && (
                                                        <span>
                                                            {formatLatency(
                                                                result.latency
                                                            )}
                                                        </span>
                                                    )}
                                                    <span>
                                                        {result.timestamp.toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PingModal;
