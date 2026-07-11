/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as biomarkers from "../biomarkers.js";
import type * as chat from "../chat.js";
import type * as dna from "../dna.js";
import type * as etl from "../etl.js";
import type * as habits from "../habits.js";
import type * as lib_auth from "../lib/auth.js";
import type * as notes from "../notes.js";
import type * as profile from "../profile.js";
import type * as push from "../push.js";
import type * as reminders from "../reminders.js";
import type * as reports from "../reports.js";
import type * as supplements from "../supplements.js";
import type * as symptoms from "../symptoms.js";
import type * as wearables from "../wearables.js";
import type * as weekly from "../weekly.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  biomarkers: typeof biomarkers;
  chat: typeof chat;
  dna: typeof dna;
  etl: typeof etl;
  habits: typeof habits;
  "lib/auth": typeof lib_auth;
  notes: typeof notes;
  profile: typeof profile;
  push: typeof push;
  reminders: typeof reminders;
  reports: typeof reports;
  supplements: typeof supplements;
  symptoms: typeof symptoms;
  wearables: typeof wearables;
  weekly: typeof weekly;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
