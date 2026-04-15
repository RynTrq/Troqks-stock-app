'use client'

import { useEffect, useMemo, useRef } from "react"

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height: number) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

    useEffect(
        () => {
            const container = containerRef.current;

            if(!container) return;

            container.replaceChildren();

            const widget = document.createElement("div");
            widget.className = "tradingview-widget-container__widget";
            widget.style.width = "100%";
            widget.style.height = `${height}px`;
            container.appendChild(widget);

            const script = document.createElement("script");
            script.src = scriptUrl;
            script.async = true;
            script.textContent = serializedConfig;
            script.onerror = () => {
                const errorMessage = document.createElement("p");

                errorMessage.className = "p-4 text-sm text-red-500";
                errorMessage.textContent = "Market widget could not be loaded. Check your network connection or content blocker.";
                container.replaceChildren(errorMessage);
                container.dataset.error = "true";
            };

            container.appendChild(script);
            container.dataset.loaded = 'true';
            delete container.dataset.error;

            return () => {
                container.replaceChildren();
                delete container.dataset.loaded;
                delete container.dataset.error;
            }

        }, [scriptUrl, serializedConfig, height]);
    return containerRef;
}

export default useTradingViewWidget
