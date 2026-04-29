import { useCallback, useRef } from 'react';

interface Options {
    onLongPress: () => void;
    onClick?: () => void;
    delayMs?: number;
}

/**
 * Touch + mouse long-press handler. Returns props you spread onto the button.
 * Click fires only if the gesture released BEFORE the long-press timer.
 */
export function useLongPress({ onLongPress, onClick, delayMs = 500 }: Options) {
    const timerRef = useRef<number | null>(null);
    const longFiredRef = useRef(false);

    const start = useCallback(() => {
        longFiredRef.current = false;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            longFiredRef.current = true;
            onLongPress();
        }, delayMs);
    }, [onLongPress, delayMs]);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const release = useCallback(() => {
        cancel();
        if (!longFiredRef.current && onClick) onClick();
    }, [cancel, onClick]);

    return {
        onMouseDown: start,
        onMouseUp: release,
        onMouseLeave: cancel,
        onTouchStart: start,
        onTouchEnd: release,
        onTouchCancel: cancel,
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
}
