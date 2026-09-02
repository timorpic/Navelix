"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] p-6">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-xs text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              页面遇到了意外错误
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              请刷新页面重试，或返回首页。
            </p>
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 bg-[#00C776] text-white text-xs font-bold rounded-lg hover:bg-[#00B068] transition-colors cursor-pointer"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}