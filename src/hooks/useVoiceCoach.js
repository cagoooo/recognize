import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for Text-to-Speech (TTS) functionality
 * Uses the browser's SpeechSynthesis API
 */
export const useVoiceCoach = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [voices, setVoices] = useState([]);
    const [preferredVoice, setPreferredVoice] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            setIsSupported(true);

            const loadVoices = () => {
                const allVoices = window.speechSynthesis.getVoices();
                setVoices(allVoices);

                // Priority: zh-TW > zh-CN > any zh > default
                // "Google 國語" (Android/Chrome) is usually good
                // "Mei-Jia" (Mac) is good
                // "Microsoft Hanhan" (Windows) is good
                const zhTw = allVoices.find(v => v.lang === 'zh-TW');
                const zhCn = allVoices.find(v => v.lang === 'zh-CN');
                const zh = allVoices.find(v => v.lang.startsWith('zh'));

                setPreferredVoice(zhTw || zhCn || zh || null);
            };

            loadVoices();

            // Chrome loads voices asynchronously
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    const speak = useCallback((text, rate = 0.9, pitch = 1) => {
        if (!isSupported || !text) return;

        // Cancel any current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Fallback lang if voice not found, but utterance.lang should match voice.lang usually
        utterance.lang = preferredVoice ? preferredVoice.lang : 'zh-TW';

        utterance.rate = rate; // 0.9 is slightly slower for better clarity
        utterance.pitch = pitch;

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Speech synthesis error:", e);
            setSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    }, [isSupported, preferredVoice]);

    const cancel = useCallback(() => {
        if (isSupported) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
        }
    }, [isSupported]);

    return {
        speak,
        cancel,
        speaking,
        isSupported,
        currentVoice: preferredVoice
    };
};
