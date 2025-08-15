"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import React, { useRef, useState } from "react";

interface Message {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface ChatInterfaceProps {
    onMessageSend?: (message: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    onMessageSend,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            type: "assistant",
            content:
                "Welcome to LLM Guard! I can help you analyze network security, explain firewall rules, and provide insights about your network topology. What would you like to know?",
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
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
        setInputValue("");
        setIsLoading(true);

        // Call the callback if provided
        onMessageSend?.(inputValue);

        // Simulate LLM response (replace with actual LLM integration later)
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: "assistant",
                content: `I received your query: "${userMessage.content}". This is a simulated response. In the actual implementation, this would be processed by the LLM and provide real network security insights.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setIsLoading(false);
        }, 1500);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
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
                <AnimatePresence>
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className={`flex gap-3 ${
                                message.type === "user"
                                    ? "justify-end"
                                    : "justify-start"
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
                                <p className="text-sm leading-relaxed">
                                    {message.content}
                                </p>
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
                    ))}
                </AnimatePresence>

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
                        placeholder="Ask about your network or firewall"
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

                {/* Quick suggestions */}
                <div className="mt-2 flex flex-wrap gap-2">
                    {[
                        "Analyze current threats",
                        "Show firewall rules",
                        "Network performance",
                        "Security recommendations",
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
