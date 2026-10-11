"use client";

import { Clock, Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import type { SuggestionItem, SuggestionResponse } from "@repo/types";
import MediaImage from "@/components/MediaImage";

const SEARCH_SERVICE_URL =
  process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";
const SUGGESTION_LIMIT = 6;
const DEBOUNCE_MS = 250;
const RECENT_SEARCHES_KEY = "larekmart:recent-searches";
const MAX_RECENT_SEARCHES = 5;

type Option =
  | { kind: "recent"; label: string }
  | { kind: "suggestion"; item: SuggestionItem };

/** Reads recent searches from localStorage, tolerating unavailable storage. */
const readRecentSearches = (): string[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const writeRecentSearches = (searches: string[]): void => {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Storage can be unavailable (private mode, quota) — recents are best-effort.
  }
};

const SearchBar = () => {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { userId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // Hydrate recent searches after mount (localStorage is not available on the server).
  useEffect(() => {
    setRecents(readRecentSearches());
  }, []);

  // Debounced autocomplete against search-service. Results are fetched from the
  // service directly (no gateway) and cached there in Redis.
  useEffect(() => {
    const query = value.trim();

    if (!SEARCH_SERVICE_URL || query.length === 0) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const headers: Record<string, string> = {
          "x-request-id":
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `req-${Date.now()}`,
        };
        if (userId) {
          headers["x-user-id"] = userId;
        }

        const res = await fetch(
          `${SEARCH_SERVICE_URL}/api/v1/search/suggestions?q=${encodeURIComponent(query)}&limit=${SUGGESTION_LIMIT}`,
          {
            signal: controller.signal,
            headers,
          },
        );
        if (!res.ok)
          throw new Error(`Suggestions request failed (${res.status})`);

        const body = (await res.json()) as SuggestionResponse;
        setSuggestions(Array.isArray(body.data) ? body.data : []);
        setActiveIndex(-1);
        setIsOpen(true);
      } catch (error) {
        // Aborted requests are expected whenever the query changes; stay silent.
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, userId]);

  // Close the dropdown when clicking outside the search bar.
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const rememberSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecents((previous) => {
      const next = [
        trimmed,
        ...previous.filter(
          (item) => item.toLowerCase() !== trimmed.toLowerCase(),
        ),
      ].slice(0, MAX_RECENT_SEARCHES);
      writeRecentSearches(next);
      return next;
    });
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const submitSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    rememberSearch(trimmed);
    const params = new URLSearchParams(searchParams);
    params.set("search", trimmed);
    closeDropdown();
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  const openProduct = (id: string) => {
    closeDropdown();
    router.push(`/products/${id}`);
  };

  const clearRecents = () => {
    setRecents([]);
    writeRecentSearches([]);
  };

  const options: Option[] =
    value.trim().length === 0
      ? recents.map((label) => ({ kind: "recent", label }))
      : suggestions.map((item) => ({ kind: "suggestion", item }));

  const showRecentsHeader = value.trim().length === 0 && recents.length > 0;
  const showDropdown = isOpen && options.length > 0;

  const activateOption = (option: Option) => {
    if (option.kind === "recent") submitSearch(option.label);
    else openProduct(option.item.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (options.length === 0) return;
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const highlighted = activeIndex >= 0 ? options[activeIndex] : undefined;
      if (highlighted) activateOption(highlighted);
      else submitSearch(value);
    } else if (event.key === "Escape") {
      closeDropdown();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative hidden sm:flex items-center gap-2 rounded-md ring-1 ring-gray-200 px-2 py-1 shadow-md"
    >
      <Search className="w-4 h-4 text-gray-500" />
      <input
        id="search"
        placeholder="Search..."
        className="text-sm outline-0"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isLoading && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md bg-white text-sm shadow-lg ring-1 ring-gray-200">
          {showRecentsHeader && (
            <div className="flex items-center justify-between px-3 pt-2 text-xs uppercase tracking-wide text-gray-400">
              <span>Recent</span>
              <button
                type="button"
                onClick={clearRecents}
                className="normal-case underline"
              >
                Clear
              </button>
            </div>
          )}

          <ul id={listboxId} role="listbox" className="py-1">
            {options.map((option, index) => (
              <li
                key={
                  option.kind === "recent"
                    ? `recent-${option.label}`
                    : `suggestion-${option.item.id}`
                }
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-1.5 ${index === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activateOption(option)}
              >
                {option.kind === "recent" ? (
                  <span className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    {option.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    {(() => {
                      const image = option.item.images
                        ? Object.values(option.item.images)[0]
                        : undefined;
                      return image ? (
                        <MediaImage
                          src={image}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded bg-gray-100" />
                      );
                    })()}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.item.name}</span>
                      {option.item.brand && (
                        <span className="block truncate text-xs text-gray-400">
                          {option.item.brand}
                        </span>
                      )}
                    </span>
                    {typeof option.item.price === "number" && (
                      <span className="text-xs text-gray-500">
                        ${option.item.price.toFixed(2)}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
