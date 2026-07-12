// src/hooks/useSearchAndPaginate.ts
// Shared client-side search + pagination for the companies and skills list
// pages, which fetch their full (small) list in one call and filter/page it
// in the browser rather than adding backend query params.
"use client";

import { useMemo, useState } from "react";

const PAGE_SIZE = 5;

export function useSearchAndPaginate<T>(items: T[], getSearchText: (item: T) => string) {
  const [query, setQueryState] = useState("");
  const [page, setPage] = useState(1);

  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }, [items, query, getSearchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Search results ignore pagination entirely (show every match); only the
  // unfiltered browse view is paginated.
  const results = isSearching
    ? filtered
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Changing the search query resets to page 1 so a stale page number never
  // strands the user on an empty page once they clear the search.
  const setQuery = (value: string) => {
    setQueryState(value);
    setPage(1);
  };

  return { query, setQuery, isSearching, results, matchCount: filtered.length, page, setPage, totalPages };
}
