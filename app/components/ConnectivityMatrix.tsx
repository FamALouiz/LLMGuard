"use client";

import { motion } from "framer-motion";
import {
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Zap,
    AlertTriangle,
    Network,
    Monitor,
    Server,
    Shield,
    Router,
    Globe,
    Play,
    Pause,
    Download,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

interface Node {
    id: string;
    name: string;
    type: string;
    status: string;
    ip?: string;
    config?: {
        ip_address?: string;
        [key: string]: any;
    };
}

interface ConnectivityResult {
    sourceId: string;
    targetId: string;
    success: boolean;
    latency?: number;
    packetLoss?: number;
    error?: string;
    timestamp: Date;
}

interface ConnectivityMatrixProps {
    className?: string;
}

export const ConnectivityMatrix: React.FC<ConnectivityMatrixProps> = ({
    className = "",
}) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [connectivityResults, setConnectivityResults] = useState<
        Map<string, ConnectivityResult>
    >(new Map());
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
    const [filterType, setFilterType] = useState<string>("all");

    useEffect(() => {
        loadNetworkNodes();
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoRefresh) {
            interval = setInterval(() => {
                startConnectivityScan();
            }, refreshInterval * 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, refreshInterval]);

    const loadNetworkNodes = async () => {
        try {
            const response = await fetch("/api/network-state");
            const result = await response.json();
            if (result.success && result.data?.network?.nodes) {
                const activeNodes = result.data.network.nodes.filter(
                    (node: Node) => node.status === "active"
                );
                setNodes(activeNodes);
            }
        } catch (error) {
            console.error("Failed to load network nodes:", error);
        }
    };

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

    const pingNode = async (
        sourceNode: Node,
        targetNode: Node
    ): Promise<ConnectivityResult> => {
        const targetIp = targetNode.config?.ip_address || targetNode.ip;

        if (!targetIp) {
            return {
                sourceId: sourceNode.id,
                targetId: targetNode.id,
                success: false,
                error: "Target IP not found",
                timestamp: new Date(),
            };
        }

        try {
            const response = await fetch("/api/ping", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sourceNodeId: sourceNode.id,
                    targetIp: targetIp,
                    count: 1, // Use fewer pings for matrix scan
                }),
            });

            const result = await response.json();

            if (result.success && result.data) {
                const pingData = result.data;
                return {
                    sourceId: sourceNode.id,
                    targetId: targetNode.id,
                    success: pingData.success,
                    latency: pingData.statistics?.avgLatency,
                    packetLoss: pingData.statistics?.packetLoss,
                    error: pingData.error,
                    timestamp: new Date(),
                };
            } else {
                throw new Error(result.error || "Ping failed");
            }
        } catch (error: any) {
            return {
                sourceId: sourceNode.id,
                targetId: targetNode.id,
                success: false,
                error: error.message || "Network error",
                timestamp: new Date(),
            };
        }
    };

    const startConnectivityScan = useCallback(async () => {
        if (nodes.length === 0) return;

        setIsScanning(true);
        setScanProgress(0);
        setConnectivityResults(new Map());

        // Prepare batch ping requests
        const batchRequests = [];
        for (const sourceNode of nodes) {
            for (const targetNode of nodes) {
                if (sourceNode.id !== targetNode.id) {
                    const targetIp =
                        targetNode.config?.ip_address || targetNode.ip;
                    if (targetIp) {
                        batchRequests.push({
                            sourceNodeId: sourceNode.id,
                            targetNodeId: targetNode.id,
                            targetIp: targetIp,
                        });
                    }
                }
            }
        }

        const totalTests = batchRequests.length;

        try {
            // Use batch ping API for better performance
            const response = await fetch("/api/ping/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requests: batchRequests,
                    count: 1, // Use fewer pings for matrix scan
                }),
            });

            const result = await response.json();

            if (result.success && result.data?.results) {
                const newResults = new Map<string, ConnectivityResult>();

                result.data.results.forEach((pingResult: any) => {
                    const connectivityResult: ConnectivityResult = {
                        sourceId: pingResult.sourceNodeId,
                        targetId: pingResult.targetNodeId,
                        success: pingResult.success,
                        latency: pingResult.statistics?.avgLatency,
                        packetLoss: pingResult.statistics?.packetLoss,
                        error: pingResult.error,
                        timestamp: new Date(pingResult.timestamp),
                    };

                    const key = `${connectivityResult.sourceId}-${connectivityResult.targetId}`;
                    newResults.set(key, connectivityResult);
                });

                setConnectivityResults(newResults);
                setScanProgress(100);
            } else {
                throw new Error(result.error || "Batch ping failed");
            }
        } catch (error: any) {
            console.error("Connectivity scan failed:", error);
            // Fallback to individual pings if batch fails
            await performIndividualPingsScan(batchRequests, totalTests);
        }

        setIsScanning(false);
        setLastScanTime(new Date());
    }, [nodes]);

    // Fallback method for individual pings
    const performIndividualPingsScan = async (
        batchRequests: any[],
        totalTests: number
    ) => {
        let completedTests = 0;
        const newResults = new Map<string, ConnectivityResult>();

        // Process in smaller batches to avoid overwhelming the system
        const batchSize = 3;
        for (let i = 0; i < batchRequests.length; i += batchSize) {
            const batch = batchRequests.slice(i, i + batchSize);
            const batchPromises = batch.map(async (req) => {
                const sourceNode = nodes.find((n) => n.id === req.sourceNodeId);
                const targetNode = nodes.find((n) => n.id === req.targetNodeId);

                if (sourceNode && targetNode) {
                    return await pingNode(sourceNode, targetNode);
                }

                return {
                    sourceId: req.sourceNodeId,
                    targetId: req.targetNodeId,
                    success: false,
                    error: "Node not found",
                    timestamp: new Date(),
                };
            });

            try {
                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach((result) => {
                    const key = `${result.sourceId}-${result.targetId}`;
                    newResults.set(key, result);
                });

                completedTests += batch.length;
                setScanProgress((completedTests / totalTests) * 100);
                setConnectivityResults(new Map(newResults));
            } catch (error) {
                console.error("Batch ping failed:", error);
            }

            // Small delay between batches
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    };

    const getConnectivityStatus = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return "self";

        const key = `${sourceId}-${targetId}`;
        const result = connectivityResults.get(key);

        if (!result) return "unknown";
        return result.success ? "connected" : "disconnected";
    };

    const getConnectivityResult = (sourceId: string, targetId: string) => {
        const key = `${sourceId}-${targetId}`;
        return connectivityResults.get(key);
    };

    const getCellColor = (status: string) => {
        switch (status) {
            case "self":
                return "bg-gray-100 border-gray-300";
            case "connected":
                return "bg-green-100 border-green-300 hover:bg-green-200";
            case "disconnected":
                return "bg-red-100 border-red-300 hover:bg-red-200";
            default:
                return "bg-gray-50 border-gray-200";
        }
    };

    const getCellIcon = (status: string) => {
        switch (status) {
            case "connected":
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case "disconnected":
                return <XCircle className="w-4 h-4 text-red-600" />;
            case "self":
                return <Network className="w-4 h-4 text-gray-400" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const exportResults = () => {
        const exportData = {
            scanTime: lastScanTime?.toISOString(),
            nodes: nodes.map((n) => ({
                id: n.id,
                name: n.name,
                type: n.type,
                ip: n.ip || n.config?.ip_address,
            })),
            connectivity: Array.from(connectivityResults.entries()).map(
                ([key, result]) => ({
                    source: result.sourceId,
                    target: result.targetId,
                    connected: result.success,
                    latency: result.latency,
                    packetLoss: result.packetLoss,
                    error: result.error,
                })
            ),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `connectivity-matrix-${
            new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const filteredNodes = nodes.filter(
        (node) => filterType === "all" || node.type === filterType
    );

    const getConnectivityStats = () => {
        if (connectivityResults.size === 0) return null;

        const totalConnections = connectivityResults.size;
        const successfulConnections = Array.from(
            connectivityResults.values()
        ).filter((r) => r.success).length;
        const avgLatency = Array.from(connectivityResults.values())
            .filter((r) => r.success && r.latency)
            .reduce((sum, r, _, arr) => sum + (r.latency || 0) / arr.length, 0);

        return {
            total: totalConnections,
            successful: successfulConnections,
            failed: totalConnections - successfulConnections,
            successRate: (successfulConnections / totalConnections) * 100,
            avgLatency: avgLatency,
        };
    };

    const stats = getConnectivityStats();

    return (
        <div className={`p-6 bg-gray-50 min-h-screen ${className} text-black`}>
            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mb-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <Network className="w-8 h-8 text-blue-600" />
                            Network Connectivity Matrix
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Visual representation of network connectivity
                            between all devices
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={exportResults}
                            disabled={connectivityResults.size === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>

                        <button
                            onClick={startConnectivityScan}
                            disabled={isScanning}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {isScanning ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            {isScanning ? "Scanning..." : "Start Scan"}
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Filter by type:
                        </label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-1 text-sm"
                        >
                            <option value="all">All Devices</option>
                            <option value="firewall">Firewalls</option>
                            <option value="router">Routers</option>
                            <option value="server">Servers</option>
                            <option value="user">Hosts</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Auto-refresh:
                        </label>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`p-1 rounded transition-colors ${
                                autoRefresh ? "text-green-600" : "text-red-400"
                            }`}
                        >
                            {autoRefresh ? (
                                <Play className="w-4 h-4" />
                            ) : (
                                <Pause className="w-4 h-4" />
                            )}
                        </button>
                        <select
                            value={refreshInterval}
                            onChange={(e) =>
                                setRefreshInterval(Number(e.target.value))
                            }
                            className={`border border-gray-300 rounded px-2 py-1 text-sm ${
                                autoRefresh ? "text-green-600" : "text-red-400"
                            }`}
                            disabled={!autoRefresh}
                        >
                            <option value={15}>15s</option>
                            <option value={30}>30s</option>
                            <option value={60}>1m</option>
                            <option value={300}>5m</option>
                        </select>
                    </div>

                    {lastScanTime && (
                        <div className="text-sm text-gray-600">
                            Last scan: {lastScanTime.toLocaleTimeString()}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Statistics */}
            {stats && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
                >
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <Network className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-700">
                                Total Tests
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                            {stats.total}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-gray-700">
                                Successful
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                            {stats.successful}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-gray-700">
                                Failed
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-red-600 mt-1">
                            {stats.failed}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-600" />
                            <span className="font-medium text-gray-700">
                                Success Rate
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                            {stats.successRate.toFixed(1)}%
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Progress Bar */}
            {isScanning && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-6"
                >
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 mb-2">
                            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                            <span className="font-medium text-gray-700">
                                Scanning network connectivity...
                            </span>
                            <span className="text-sm text-gray-500">
                                {scanProgress.toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${scanProgress}%` }}
                            />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Connectivity Matrix */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
                {filteredNodes.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="p-3 text-left font-medium text-gray-700 min-w-48">
                                        Source → Target
                                    </th>
                                    {filteredNodes.map((targetNode) => {
                                        const Icon = getNodeIcon(
                                            targetNode.type
                                        );
                                        return (
                                            <th
                                                key={targetNode.id}
                                                className="p-3 text-center font-medium text-gray-700 min-w-24"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <Icon className="w-5 h-5" />
                                                    <span className="text-xs">
                                                        {targetNode.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {targetNode.ip ||
                                                            targetNode.config
                                                                ?.ip_address}
                                                    </span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNodes.map((sourceNode) => {
                                    const SourceIcon = getNodeIcon(
                                        sourceNode.type
                                    );
                                    return (
                                        <tr
                                            key={sourceNode.id}
                                            className="border-t border-gray-200"
                                        >
                                            <td className="p-3 font-medium text-gray-700 bg-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <SourceIcon className="w-5 h-5" />
                                                    <div>
                                                        <div>
                                                            {sourceNode.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {sourceNode.ip ||
                                                                sourceNode
                                                                    .config
                                                                    ?.ip_address}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            {filteredNodes.map((targetNode) => {
                                                const status =
                                                    getConnectivityStatus(
                                                        sourceNode.id,
                                                        targetNode.id
                                                    );
                                                const result =
                                                    getConnectivityResult(
                                                        sourceNode.id,
                                                        targetNode.id
                                                    );

                                                return (
                                                    <td
                                                        key={targetNode.id}
                                                        className={`p-3 text-center border-l border-gray-200 cursor-pointer transition-colors ${getCellColor(
                                                            status
                                                        )}`}
                                                        title={
                                                            result
                                                                ? `${
                                                                      result.success
                                                                          ? "Connected"
                                                                          : "Failed"
                                                                  } - ${
                                                                      result.latency
                                                                          ? `${result.latency.toFixed(
                                                                                1
                                                                            )}ms`
                                                                          : ""
                                                                  }${
                                                                      result.error
                                                                          ? ` (${result.error})`
                                                                          : ""
                                                                  }`
                                                                : status ===
                                                                  "self"
                                                                ? "Same device"
                                                                : "Not tested"
                                                        }
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            {getCellIcon(
                                                                status
                                                            )}
                                                            {result &&
                                                                result.success &&
                                                                result.latency && (
                                                                    <span className="text-xs text-green-700 font-medium">
                                                                        {result.latency.toFixed(
                                                                            0
                                                                        )}
                                                                        ms
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <Network className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>
                            No active nodes found. Please check your network
                            configuration.
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Legend */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-6 bg-white p-4 rounded-lg border border-gray-200"
            >
                <h3 className="font-medium text-gray-700 mb-3">Legend</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Connected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span>Failed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-gray-400" />
                        <span>Same Device</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>Not Tested</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ConnectivityMatrix;
