"use client";

import { motion } from "framer-motion";
import {
    Activity,
    Bell,
    Maximize2,
    Minimize2,
    PlusCircle,
    RefreshCw,
    Settings,
    Shield,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { NetworkTopology } from "./NetworkTopology";

interface NetworkDashboardProps {
    className?: string;
}

export const NetworkDashboard: React.FC<NetworkDashboardProps> = ({
    className = "",
}) => {
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [selectedEdge, setSelectedEdge] = useState<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showInsertComponent, setShowInsertComponent] = useState(false);
    const [networkContext, setNetworkContext] = useState<any>(null);

    useEffect(() => {
        loadNetworkState();
    }, []);

    const loadNetworkState = async () => {
        try {
            const response = await fetch("/api/network-state");
            const result = await response.json();
            if (result.success) {
                setNetworkContext(result.data);
            } else {
                console.error("Failed to load network state:", result.error);
            }
        } catch (error) {
            console.error("Error loading network state:", error);
        }
    };

    const handleNodeSelect = (node: any) => {
        setSelectedNode(node);
        console.log("Selected node:", node);
    };

    const handleEdgeSelect = (edge: any) => {
        setSelectedEdge(edge);
        console.log("Selected edge:", edge);
    };

    const handleMessageSend = (message: string) => {
        console.log("User message:", message);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const refreshNetwork = () => {
        loadNetworkState();
        window.location.reload();
    };

    return (
        <div className={`h-screen flex flex-col bg-gray-50 ${className}`}>
            {/* Header */}
            <motion.header
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Shield className="w-8 h-8 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">
                                    LLM Guard
                                </h1>
                                <p className="text-sm text-gray-600">
                                    Network Security Firewall
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-8">
                            <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                <Activity className="w-4 h-4" />
                                <span className="font-medium">
                                    System Active
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Insert Component Button */}
                        <button
                            onClick={() => {
                                setShowInsertComponent(true);
                            }}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Insert Component"
                        >
                            <PlusCircle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() =>
                                setShowNotifications(!showNotifications)
                            }
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors relative"
                            title="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs"></span>
                        </button>

                        <button
                            onClick={refreshNetwork}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Refresh Network"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title={
                                isFullscreen ? "Exit Fullscreen" : "Fullscreen"
                            }
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-5 h-5" />
                            ) : (
                                <Maximize2 className="w-5 h-5" />
                            )}
                        </button>

                        <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </motion.header>

            {/* Main Content */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1 flex overflow-hidden"
            >
                {/* Network Topology */}
                <div
                    className={`${isFullscreen ? "w-full" : "flex-1"} relative`}
                >
                    <NetworkTopology
                        onNodeSelect={handleNodeSelect}
                        onEdgeSelect={handleEdgeSelect}
                    />
                </div>

                {/* Chat Interface */}
                {!isFullscreen && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="w-[500px] flex-shrink-0"
                    >
                        <ChatInterface
                            onMessageSend={handleMessageSend}
                            networkContext={networkContext}
                        />
                    </motion.div>
                )}
            </motion.div>

            {/* Notification Panel */}
            {showNotifications && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-16 right-6 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
                >
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-800">
                            Security Notifications
                        </h3>
                    </div>
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                            <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                            <div>
                                <p className="text-sm font-medium text-red-800">
                                    High Priority Alert
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                    Multiple failed authentication attempts
                                    detected from 192.168.1.100
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    2 minutes ago
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                            <div>
                                <p className="text-sm font-medium text-yellow-800">
                                    Policy Violation
                                </p>
                                <p className="text-xs text-yellow-600 mt-1">
                                    Unauthorized outbound connection attempt
                                    blocked
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    5 minutes ago
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                            <div>
                                <p className="text-sm font-medium text-green-800">
                                    System Update
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                    Firewall rules updated successfully
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    10 minutes ago
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 border-t border-gray-200">
                        <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                            View All Notifications
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Overlay for closing notifications */}
            {showNotifications && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                />
            )}
        </div>
    );
};

export default NetworkDashboard;
