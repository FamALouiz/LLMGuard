"use client";

import {
    Background,
    Connection,
    ConnectionMode,
    Controls,
    Edge,
    MiniMap,
    Node,
    Panel,
    ReactFlow,
    addEdge,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import {
    Activity,
    AlertTriangle,
    Eye,
    Server,
    Shield,
    Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ConnectionEdge } from "./ConnectionEdge";
import { NetworkNode } from "./NetworkNode";

interface NetworkState {
    network: {
        name: string;
        id: string;
        nodes: any[];
        connections: any[];
        traffic_flows: any[];
        security_events: any[];
    };
}

const nodeTypes = {
    networkNode: NetworkNode as any,
};

const edgeTypes = {
    connectionEdge: ConnectionEdge as any,
};

interface NetworkTopologyProps {
    onNodeSelect?: (node: any) => void;
    onEdgeSelect?: (edge: any) => void;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
    onNodeSelect,
    onEdgeSelect,
}) => {
    const [networkState, setNetworkState] = useState<NetworkState | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Load network state from JSON file
    useEffect(() => {
        const loadNetworkState = async () => {
            try {
                const response = await fetch("/simplified_state.json");
                const data = await response.json();
                setNetworkState(data);

                // Convert nodes
                const reactFlowNodes: Node[] = data.network.nodes.map(
                    (node: any) => ({
                        id: node.id,
                        type: "networkNode",
                        position: node.position,
                        data: {
                            id: node.id,
                            type: node.type,
                            name: node.name,
                            status: node.status,
                            config: node.config,
                        },
                    })
                );

                // Convert edges
                const reactFlowEdges: Edge[] = data.network.connections.map(
                    (conn: any) => ({
                        id: conn.id,
                        source: conn.source,
                        target: conn.target,
                        type: "connectionEdge",
                        data: {
                            type: conn.type,
                            status: conn.status,
                            bandwidth: conn.bandwidth,
                            latency: conn.latency,
                        },
                    })
                );

                setNodes(reactFlowNodes);
                setEdges(reactFlowEdges);
                setLoading(false);
            } catch (error) {
                console.error("Failed to load network state:", error);
                setLoading(false);
            }
        };

        loadNetworkState();
    }, [setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Function to update node position in the backend
    const updateNodePosition = useCallback(
        async (nodeId: string, position: { x: number; y: number }) => {
            try {
                const response = await fetch("/api/update-node-position", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ nodeId, position }),
                });

                if (!response.ok) {
                    console.error(
                        "Failed to update node position:",
                        await response.text()
                    );
                }
            } catch (error) {
                console.error("Error updating node position:", error);
            }
        },
        []
    );

    // Handle node position changes with debouncing
    const onNodesChangeWithPositionUpdate = useCallback(
        (changes: any[]) => {
            onNodesChange(changes);

            // Check for position changes and update backend
            changes.forEach((change) => {
                if (
                    change.type === "position" &&
                    change.position &&
                    !change.dragging
                ) {
                    // Only update when dragging ends (not during drag)
                    updateNodePosition(change.id, change.position);
                }
            });
        },
        [onNodesChange, updateNodePosition]
    );

    const onNodeClick = useCallback(
        (event: React.MouseEvent, node: Node) => {
            const nodeData = networkState?.network.nodes.find(
                (n) => n.id === node.id
            );
            setSelectedNode(nodeData);
            onNodeSelect?.(nodeData);
        },
        [networkState, onNodeSelect]
    );

    const onEdgeClick = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            const edgeData = networkState?.network.connections.find(
                (c) => c.id === edge.id
            );
            onEdgeSelect?.(edgeData);
        },
        [networkState, onEdgeSelect]
    );

    // Calculate network statistics
    const stats = networkState
        ? {
              totalNodes: networkState.network.nodes.length,
              activeNodes: networkState.network.nodes.filter(
                  (n) => n.status === "active"
              ).length,
              warningNodes: networkState.network.nodes.filter(
                  (n) => n.status === "warning"
              ).length,
              securityEvents: networkState.network.security_events.length,
              activeConnections: networkState.network.connections.filter(
                  (c) => c.status === "active"
              ).length,
          }
        : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">
                        Loading network topology...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full bg-gray-50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChangeWithPositionUpdate}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                attributionPosition="bottom-left"
                className="bg-gradient-to-br from-blue-50 to-indigo-100"
            >
                <Background color="#e0e7ff" gap={20} />
                <Controls className="bg-white border border-gray-200 rounded-lg shadow-sm" />
                <MiniMap
                    className="bg-white border border-gray-200 rounded-lg shadow-sm"
                    nodeColor={(node) => {
                        const nodeData = node.data as any;
                        switch (nodeData?.status) {
                            case "active":
                                return "#10b981";
                            case "warning":
                                return "#f59e0b";
                            case "error":
                                return "#ef4444";
                            default:
                                return "#6b7280";
                        }
                    }}
                />

                {/* Network Statistics Panel */}
                <Panel
                    position="top-left"
                    className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 m-4"
                >
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Network Overview
                    </h3>
                    {stats && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-gray-600" />
                                <span className="text-gray-600">Nodes:</span>
                                <span className="text-gray-600 font-medium">
                                    {stats.totalNodes}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-green-600" />
                                <span className="text-gray-600">Active:</span>
                                <span className="font-medium text-green-600">
                                    {stats.activeNodes}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                <span className="text-gray-600">Warnings:</span>
                                <span className="font-medium text-yellow-600">
                                    {stats.warningNodes}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-red-600" />
                                <span className="text-gray-600">Events:</span>
                                <span className="font-medium text-red-600">
                                    {stats.securityEvents}
                                </span>
                            </div>
                        </div>
                    )}
                </Panel>

                {/* Legend */}
                <Panel
                    position="bottom-left"
                    className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 m-4 text-gray-600"
                >
                    <h4 className="font-semibold text-gray-800 mb-2">Legend</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            <span>Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span>Warning</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <span>Error</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-blue-500"></div>
                            <span>WAN</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-green-500"></div>
                            <span>LAN</span>
                        </div>
                    </div>
                </Panel>

                {/* Selected Node Details */}
                {selectedNode && (
                    <Panel
                        position="top-right"
                        className="bg-white rounded-lg shadow-lg border border-gray-200 px-6 py-4 my-4 max-w-xs min-w-56"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Node Details
                                </h4>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-medium text-gray-600">
                                        Name:
                                    </span>
                                    <p className="px-1 inline-block text-gray-800">
                                        {selectedNode.name}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-600">
                                        Type:
                                    </span>
                                    <p className="px-1 inline-block text-gray-800 capitalize">
                                        {selectedNode.type}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-600">
                                        Status:
                                    </span>
                                    <p
                                        className={`px-1 inline-block capitalize ${
                                            selectedNode.status === "active"
                                                ? "text-green-600"
                                                : selectedNode.status ===
                                                  "warning"
                                                ? "text-yellow-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        {selectedNode.status}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-600">
                                        Configuration:
                                    </span>
                                    <div className="mt-1 space-y-1">
                                        {Object.entries(
                                            selectedNode.config
                                        ).map(([key, value]) => (
                                            <div
                                                key={key}
                                                className="flex justify-between text-xs"
                                            >
                                                <span className="text-gray-500">
                                                    {key.replace(/_/g, " ")}:
                                                </span>
                                                <span className="text-gray-700">
                                                    {Array.isArray(value)
                                                        ? `${
                                                              value.length
                                                          } item${
                                                              value.length === 1
                                                                  ? ""
                                                                  : "s"
                                                          }`
                                                        : typeof value ===
                                                          "boolean"
                                                        ? value
                                                            ? "Yes"
                                                            : "No"
                                                        : (value as string)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
};

export default NetworkTopology;
