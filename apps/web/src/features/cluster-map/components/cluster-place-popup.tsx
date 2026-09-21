import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { ClusterMapPlaceCell } from "../model/cluster-map-view";

type PopupPosition = {
  top: number;
  left: number;
};

type ClusterPlacePopupProps = {
  place: ClusterMapPlaceCell;
  selected: boolean;
  popupPosition: PopupPosition | null;
  popupRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

export const ClusterPlacePopup = ({
  place,
  selected,
  popupPosition,
  popupRef,
  onClose,
}: ClusterPlacePopupProps) => {
  if (!selected || !place.peer) {
    return null;
  }

  return createPortal(
    <div
      ref={popupRef}
      id={`peer-${place.id}`}
      className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-cluster-border bg-cluster-surface p-4 shadow-lg duration-150 animate-in fade-in zoom-in-95 sm:inset-x-auto sm:bottom-auto sm:w-56 sm:-translate-y-1/2"
      style={
        popupPosition
          ? {
              top: popupPosition.top,
              left: popupPosition.left,
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close peer details"
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-secondary"
      >
        ×
      </button>

      <div className="mb-3 pr-8">
        <div className="text-sm font-semibold text-primary">
          Place {place.number}
        </div>

        <div className="mt-0.5 text-xs text-tertiary">Occupied</div>
      </div>

      <div className="mb-4 border-t border-secondary" />

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-tertiary">
          {place.peer.photo ? (
            <img
              src={place.peer.photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span>
              {place.peer.displayName?.charAt(0).toUpperCase() ??
                place.peer.intraName?.charAt(0).toUpperCase() ??
                "?"}
            </span>
          )}
        </div>

        <div className="min-w-0">
          {place.peer.displayName && (
            <div className="truncate text-sm font-semibold text-primary">
              {place.peer.displayName}
            </div>
          )}

          {place.peer.intraName && (
            <div className="truncate text-xs text-tertiary">
              @{place.peer.intraName}
            </div>
          )}

          {!place.peer.displayName && !place.peer.intraName && (
            <div className="text-xs text-tertiary">
              Peer information unavailable
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
