import { Effect } from "effect";

export class FeatureFlagService extends Effect.Service<FeatureFlagService>()(
  "FeatureFlagService",
  {
    effect: Effect.gen(function* () {
      const flags = {
        /**
         * When true, search for an existing short link before creating.
         * Disabled because the search API is currently broken and
         * the deduplication check is low-value.
         */
        ENABLE_SHORTLINK_SEARCH: false,
        /**
         * When true, show "Post to X" and "Post to LinkedIn" buttons
         * on the social page.
         */
        ENABLE_SOCIAL_SHARE_BUTTONS: false,
      } as const;

      const isEnabled = (flag: keyof typeof flags): boolean => flags[flag];

      return { isEnabled };
    }),
  }
) {}
