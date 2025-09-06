"use client";

import ConnectivityMatrix from "@/app/components/ConnectivityMatrix";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function ConnectivityPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to Dashboard</span>
                    </Link>

                    <div className="flex items-center gap-2 text-gray-400">
                        <span>/</span>
                        <Home className="w-4 h-4" />
                        <span>Dashboard</span>
                        <span>/</span>
                        <span className="text-gray-700 font-medium">
                            Connectivity Matrix
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <ConnectivityMatrix />
        </div>
    );
}
