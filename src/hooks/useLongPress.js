import { useState, useRef, useCallback } from 'react';

/**
 * 長按交互 Hook
 * @param {Function} onLongPress 長按觸發的回調
 * @param {Function} onClick 普通點擊觸發的回調 (選填)
 * @param {Object} options 設定項 (delay: 長按延遲, ms)
 */
export const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const timerRef = useRef();
    const isLongPressActive = useRef(false);

    const start = useCallback((event) => {
        // 阻止預設選單出現
        if (event.target && event.target.tagName === 'IMG') {
            // event.preventDefault(); // 這裡不輕易 prevent，以免干擾其他邏輯，但在 QuickPreview 顯示時會需要
        }

        isLongPressActive.current = true;
        setLongPressTriggered(false);

        timerRef.current = setTimeout(() => {
            if (isLongPressActive.current) {
                onLongPress(event);
                setLongPressTriggered(true);

                // 震動回饋 (Haptic Feedback)
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
            }
        }, delay);
    }, [onLongPress, delay]);

    const stop = useCallback((event) => {
        isLongPressActive.current = false;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (!longPressTriggered && onClick) {
            onClick(event);
        }
    }, [onClick, longPressTriggered]);

    return {
        onMouseDown: (e) => start(e),
        onMouseUp: (e) => stop(e),
        onMouseLeave: () => {
            isLongPressActive.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        onTouchStart: (e) => start(e),
        onTouchEnd: (e) => stop(e),
    };
};
