import { useEffect, useRef, useState } from "react";

type UseClusterPlacePopupOptions = {
    selected: boolean;
    onClose: () => void;
};

export const useClusterPlacePopup = ({
    selected,
    onClose,
}: UseClusterPlacePopupOptions) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const [popupPosition, setPopupPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);

    useEffect(() => {
        if (!selected) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (
                containerRef.current?.contains(target) ||
                popupRef.current?.contains(target)
            ) {
                return;
            }

            onClose();
        };

        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener(
                "click",
                handleClickOutside,
            );
        };
    }, [selected, onClose]);

    useEffect(() => {
        if (!selected || !buttonRef.current) {
            return;
        }

        const updatePopupPosition = () => {
            const button = buttonRef.current;

            if (!button) {
                return;
            }

            const isDesktop = window.matchMedia(
                "(min-width: 640px)",
            ).matches;

            if (!isDesktop) {
                setPopupPosition(null);
                return;
            }

            const rect = button.getBoundingClientRect();

            const popupWidth = 224;
            const gap = 16;
            const viewportPadding = 16;

            let left = rect.right + gap;

            if (
                left + popupWidth >
                window.innerWidth - viewportPadding
            ) {
                left = Math.max(
                    viewportPadding,
                    rect.left - gap - popupWidth,
                );
            }

            setPopupPosition({
                top: rect.top + rect.height / 2,
                left,
            });
        };

        updatePopupPosition();

        window.addEventListener(
            "resize",
            updatePopupPosition,
        );

        window.addEventListener(
            "scroll",
            updatePopupPosition,
            true,
        );

        return () => {
            window.removeEventListener(
                "resize",
                updatePopupPosition,
            );

            window.removeEventListener(
                "scroll",
                updatePopupPosition,
                true,
            );
        };
    }, [selected]);

    useEffect(() => {
        if (!selected) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener(
            "keydown",
            handleKeyDown,
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown,
            );
        };
    }, [selected, onClose]);

    return {
        containerRef,
        buttonRef,
        popupRef,
        popupPosition,
    };
};
