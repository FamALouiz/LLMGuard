"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Play, Send, Terminal, Trash2, User } from "lucide-react";
import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
    data?: any; // For structured responses
    commandResults?: any[]; // For command execution results
}

interface ChatInterfaceProps {
    onMessageSend?: (message: string) => void;
    networkContext?: any; // Current network state
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    onMessageSend,
    networkContext,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            type: "assistant",
            content:
                "Welcome to LLM Guard! I'll be your personal assistant. What would you like to know?",
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    React.useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            type: "user",
            content: inputValue,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue("");
        setIsLoading(true);

        onMessageSend?.(currentInput);

        try {
            // Send to LLM API
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: currentInput,
                    context: networkContext,
                }),
            });

            const result = await response.json();

            if (result.success) {
                console.log(result.data);
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: "assistant",
                    content: result.data.content,
                    timestamp: new Date(),
                    data: result.data,
                };

                setMessages((prev) => [...prev, assistantMessage]);
            } else {
                throw new Error(result.error || "Failed to get response");
            }
        } catch (error: any) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: "assistant",
                content: `Error: ${error.message}`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const executeCommands = async (messageId: string, commands: any[]) => {
        setIsExecuting(true);

        try {
            const response = await fetch("/api/execute-command", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    commands: commands,
                }),
            });

            const result = await response.json();

            // Update the message with execution results
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === messageId
                        ? { ...msg, commandResults: result.results }
                        : msg
                )
            );
        } catch (error) {
            console.error("Command execution failed:", error);
        } finally {
            setIsExecuting(false);
        }
    };

    const clearChat = () => {
        setMessages([
            {
                id: "1",
                type: "assistant",
                content:
                    "Chat cleared. How can I help you with network security analysis?",
                timestamp: new Date(),
            },
        ]);
    };

    const renderMessage = (message: Message) => {
        const hasCommands =
            message.data?.commands && message.data.commands.length > 0;

        return (
            <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${
                    message.type === "user" ? "justify-end" : "justify-start"
                }`}
            >
                {message.type === "assistant" && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                )}

                <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                        message.type === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-800"
                    }`}
                >
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                        <ReactMarkdown>
                            {message.content
                                .replace(/<think>[\s\S]*?<\/think>/g, "")
                                .trim()}
                        </ReactMarkdown>
                    </div>

                    {/* Command display and execution */}
                    {hasCommands && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">
                                    <Terminal className="w-3 h-3 inline mr-1" />
                                    Commands Found
                                </span>
                                <button
                                    onClick={() =>
                                        executeCommands(
                                            message.id,
                                            message.data.commands
                                        )
                                    }
                                    disabled={isExecuting}
                                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    <Play className="w-3 h-3" />
                                    Execute
                                </button>
                            </div>

                            {message.data.commands.map(
                                (cmd: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="text-xs mb-2 last:mb-0"
                                    >
                                        <div className="font-mono bg-black text-green-400 p-2 rounded">
                                            <div className="text-white text-xs mb-1">
                                                {cmd.description}
                                            </div>
                                            <div>
                                                {cmd.action}
                                                {cmd.target
                                                    ? ` (${cmd.target})`
                                                    : ""}
                                            </div>
                                            {cmd.parameters?.rule && (
                                                <div className="text-yellow-300">
                                                    {cmd.parameters.rule}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* Command results display */}
                    {message.commandResults && (
                        <div className="mt-3 p-3 bg-green-50 rounded border">
                            <span className="text-xs font-medium text-green-700 block mb-2">
                                Execution Results:
                            </span>
                            {message.commandResults.map(
                                (result: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="text-xs mb-2 last:mb-0"
                                    >
                                        <div
                                            className={`p-2 rounded ${
                                                result.success
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                            }`}
                                        >
                                            <strong>{result.command}:</strong>{" "}
                                            {result.success
                                                ? "Success"
                                                : "Failed"}
                                            {result.output && (
                                                <div className="mt-1 font-mono text-xs">
                                                    {result.output}
                                                </div>
                                            )}
                                            {result.error && (
                                                <div className="mt-1 text-red-600 text-xs">
                                                    {result.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    <span className="text-xs opacity-70 mt-1 block">
                        {message.timestamp.toLocaleTimeString()}
                    </span>
                </div>

                {message.type === "user" && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-600" />
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                    <Bot className="w-6 h-6 text-blue-600" />
                    <h2 className="font-semibold text-gray-800">
                        LLM Assistant
                    </h2>
                </div>
                <button
                    onClick={clearChat}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Clear chat"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence>{messages.map(renderMessage)}</AnimatePresence>

                {/* Loading indicator */}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 justify-start"
                    >
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                <span className="text-sm text-gray-500">
                                    Thinking...
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Prompt here!"
                        className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[40px] max-h-[120px] text-black"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                {/* Updated suggestions for command-oriented prompts */}
                <div className="mt-2 flex flex-wrap gap-2">
                    {[
                        "Show me current iptables rules",
                        "Analyze network security posture",
                    ].map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => setInputValue(suggestion)}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                            disabled={isLoading}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
