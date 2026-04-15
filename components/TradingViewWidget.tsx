'use client';

import React, { memo } from 'react';
import useTradingViewWidget from "@/hooks/usetradingviewwidget";
import {cn} from "@/lib/utils";

interface TradingViewWidgetProps {
    title?: string;
    scriptUrl: string;
    config: Record<string, unknown>;
    height: number;
    className?: string;
}

const TradingViewWidget = ({title, scriptUrl, config, height, className}: TradingViewWidgetProps) => {
    const containerRef = useTradingViewWidget(scriptUrl, config, height);

    return (
        <div className="w-full">
            {title && <h3 className="font-semibold text-2xl text-gray-100 mb-5">{title}</h3>}
            <div
                aria-label={title ?? "TradingView market widget"}
                className={cn("tradingview-widget-container", className)}
                ref={containerRef}
            />
        </div>
    );
}

export default memo(TradingViewWidget);
