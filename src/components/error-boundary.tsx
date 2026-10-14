"use client";

import React from "react";
import { useTranslations } from "next-intl";

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
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

function ErrorFallback() {
  const tx = useTranslations();
  return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] p-6">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-xs text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              {tx("something_went_wrong_92171117")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
              {tx("refresh_the_page_or_return_home_1d7ddecc")}
            </p>
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-hover transition-colors cursor-pointer"
            >
              {tx("refresh_page_9366e178")}
            </button>
          </div>
        </div>
      );
}
