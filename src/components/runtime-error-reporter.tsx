"use client";
import { useEffect } from "react";
import { reportFrontendError } from "@/lib/client/error-report";
/** Only event codes leave the browser; errors, URLs and rejection values stay local. */
export default function RuntimeErrorReporter() {
  useEffect(() => {
    const error = () => reportFrontendError("unhandled-error");
    const rejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error && event.reason.name === "AbortError") return;
      reportFrontendError("unhandled-rejection");
    };
    window.addEventListener("error", error); window.addEventListener("unhandledrejection", rejection);
    return () => { window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", rejection); };
  }, []);
  return null;
}
