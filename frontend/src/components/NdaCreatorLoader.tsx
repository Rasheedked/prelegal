"use client";

import dynamic from "next/dynamic";

/**
 * Renders the creator in the browser only. Its initial state depends on the
 * visitor's local date, which the server cannot know when it prerenders.
 */
export const NdaCreatorLoader = dynamic(() => import("./NdaCreator"), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-6 text-sm text-zinc-500">
      Loading the Mutual NDA creator…
    </p>
  ),
});
